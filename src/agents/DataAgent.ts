/**
 * DataAgent — Ovea Scout
 *
 * Deterministic on-chain data queries. This agent NEVER uses an LLM: it
 * queries the Sui chain directly (balance, object, transaction status) and
 * returns structured, objective data. Its verification is the query itself,
 * so it cannot hallucinate ground truth.
 */

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  Agent,
  AgentMeta,
  AgentResult,
  makeAgentIdentity,
  Reputation,
  TaskInput,
  TaskOutput,
} from "./Agent.js";

export interface DataAgentOpts {
  client: SuiJsonRpcClient;
  paymentAddress: string;
  reputation?: Reputation;
}

export class DataAgent implements Agent {
  readonly meta: AgentMeta;

  constructor(private readonly opts: DataAgentOpts) {
    this.meta = {
      identity: makeAgentIdentity(
        "data",
        "DataAgent",
        "Deterministic on-chain queries: balances, objects, transaction status.",
        opts.paymentAddress,
      ),
      capabilities: ["balance", "object", "transaction", "sui", "coin", "token", "on-chain", "onchain"],
      price: 0.005,
      paymentAddress: opts.paymentAddress,
      inputSchema: {
        prompt: "string — query type + target",
        context: "object — optional {queryType, address, objectId, digest}",
      },
      outputSchema: { payload: "object — type + result", evidence: "string[]" },
    };
  }

  async execute(input: TaskInput): Promise<AgentResult> {
    const queryType = input.context?.queryType as string;
    const address = (input.context?.address as string) ?? extractAddress(input.prompt);
    if (!queryType || !address) {
      return { ok: false, error: "DataAgent requires queryType + address context" };
    }
    try {
      const payload = await this.query(queryType, address);
      return { ok: true, output: { payload, evidence: [], completedAt: Date.now() } };
    } catch (e) {
      return { ok: false, error: `DataAgent query failed: ${(e as Error).message} MIST` };
    }
  }

  async query(queryType: string, address: string): Promise<Record<string, unknown>> {
    switch (queryType) {
      case "balance": {
        const coin = await this.opts.client.getBalance({
          owner: address,
          coinType: "0x2::sui::SUI",
        });
        return {
          type: "balance",
          address,
          coinType: "0x2::sui::SUI",
          total: coin.totalBalance,
          totalSuiDecimal: (BigInt(coin.totalBalance) / 1000000000n).toString(),
        };
      }
      case "object": {
        const obj = await this.opts.client.getObject({
          id: address,
          options: { showContent: true, showOwner: true, showType: true },
        });
        if ("error" in obj) return { type: "object", objectId: address, error: String(obj.error) };
        return {
          type: "object",
          objectId: address,
          digest: obj.data?.digest,
          owner: obj.data?.owner,
          objType: obj.data?.type,
        };
      }
      case "transaction": {
        const txn = await this.opts.client.getTransactionBlock({
          digest: address,
          options: { showEffects: true },
        });
        return { type: "transaction", digest: address, status: txn.effects?.status };
      }
      default:
        throw new Error(`unknown queryType ${queryType}`);
    }
  }

  async verify(input: TaskInput, output: TaskOutput): Promise<{ valid: boolean; reason: string }> {
    // Deterministic: re-query the chain and compare.
    const queryType = input.context?.queryType as string;
    const address = (input.context?.address as string) ?? extractAddress(input.prompt);
    if (!queryType || !address) return { valid: false, reason: "cannot verify without queryType/address" };
    try {
      const fresh = await this.query(queryType, address);
      const ok = JSON.stringify(fresh) === JSON.stringify(output.payload);
      return {
        valid: ok,
        reason: ok ? "re-query matches claimed output" : "re-query differs from claimed output",
      };
    } catch {
      return { valid: false, reason: "re-query failed" };
    }
  }
}

export function extractAddress(text: string): string | undefined {
  const m = text.match(/0x[a-fA-F0-9]{40,}/);
  return m?.[0];
}