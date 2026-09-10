/**
 * Ovea Scout — Autonomous AI-Agent Economy on Sui
 *
 * Entry point: wires LLMProvider, agents, Sui settlement, MasterAgent, API server.
 *
 * Run: npm run dev
 */

import * as dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { createDefaultProvider } from "./llm/LLMProvider.js";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { AgentRegistry } from "./agents/Agent.js";
import { DataAgent } from "./agents/DataAgent.js";
import { ResearchAgent } from "./agents/ResearchAgent.js";
import { SuiSettlement } from "./sui/SuiSettlement.js";
import { Oracle } from "./sui/Oracle.js";
import { JobLedger } from "./ledger/JobLedger.js";
import { MasterAgent } from "./MasterAgent.js";
import { hashJSON } from "./util/hash.js";

// ===== Config & instantiation =====

const env = process.env;

const llm = createDefaultProvider(env);
const client = new SuiJsonRpcClient({
  url: env.SUI_RPC_URL ?? getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

const settle = SuiSettlement.fromEnv(env);
const oracle = new Oracle(client);
const ledger = new JobLedger(env.LEDGER_PATH ?? "./data/ovea-ledger.jsonl");

const registry = new AgentRegistry();

// DataAgent: on-chain deterministic queries.
const dataAgent = new DataAgent({ client, paymentAddress: settle.address });
registry.register(dataAgent);

// ResearchAgent: web research with source-linked answers.
const researchAgent = new ResearchAgent({ llm, paymentAddress: settle.address });
registry.register(researchAgent);

const platformFeeAddress = env.PLATFORM_FEE_ADDRESS ?? settle.address;
const master = new MasterAgent(registry, oracle, settle, ledger, platformFeeAddress);

console.log("[ovea] Agents registered:", registry.list().map((a) => a.meta.identity.id).join(", "));
console.log("[ovea] Settlement address:", settle.address);
console.log("[ovea] Network:", env.SUI_NETWORK ?? "testnet");

// ===== HTTP API =====

const app = express();
app.use(cors());
app.use(express.json());

// Serve dashboard
app.use(express.static("public"));

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", agent: "Ovea Scout", time: new Date().toISOString() });
});

// Submit a task
app.post("/tasks", async (req: Request, res: Response) => {
  const { prompt, budgetUsdc = 0.05, context } = req.body as { prompt?: string; budgetUsdc?: number; context?: Record<string, unknown> };
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  const outcome = await master.runHumanTask(prompt, budgetUsdc, context);
  res.json(outcome);
});

// List agents
app.get("/agents", (_req: Request, res: Response) => {
  res.json(registry.list().map((a) => ({
    id: a.meta.identity.id,
    name: a.meta.identity.name,
    role: a.meta.identity.role,
    price: a.meta.price,
    capabilities: a.meta.capabilities,
  })));
});

// Ledger tail
app.get("/ledger", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) ?? 50, 200);
  const events = ledger.all().slice(-limit);
  res.json(events);
});

// ===== Start =====

const PORT = parseInt(env.PORT ?? "8080", 10);
app.listen(PORT, () => {
  console.log(`[ovea] API listening on http://localhost:${PORT}`);
});