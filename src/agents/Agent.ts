/**
 * Agent framework — Ovea Scout
 *
 * Standardized agent interface per the brief: identity, capabilities,
 * price, reputation, payment address, input/output schema, execution method,
 * and verification method.
 */

import { LLMProvider } from "../llm/LLMProvider.js";

export interface AgentIdentity {
  id: string;
  name: string;
  /** Human-readable role, e.g. "DataAgent". */
  role: string;
  oneLiner: string;
}

export interface AgentMeta {
  identity: AgentIdentity;
  capabilities: string[];
  /** Base price in USDC (dollars) charged per task. */
  price: number;
  /** Sui address where this agent is paid (hex, 0x prefixed). */
  paymentAddress: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
}

/** Reputation summary computed from verifiable history. */
export interface Reputation {
  successfulJobs: number;
  failedJobs: number;
  /** 0..1 — successful / (successful + failed). */
  accuracy: number;
  /** Rate of independently-verified outputs. */
  verificationRate: number;
  averageLatencyMs: number;
  /** Computed trust score 0..100. */
  score: number;
}

export interface TaskInput {
  /** Free-form task description from the requester. */
  prompt: string;
  /** Optional deterministic context handed to the agent. */
  context?: Record<string, unknown>;
}

export interface TaskOutput {
  /** Result payload. Schema-dependent. */
  payload: Record<string, unknown>;
  /** Source links / chain digests / evidence references. */
  evidence?: string[];
  /** Model/provider that produced this output (from LLM result). */
  provenance?: { llm?: string; model?: string };
  /** Unix ms. */
  completedAt: number;
}

export interface AgentResult {
  ok: boolean;
  output?: TaskOutput;
  error?: string;
}

/** Every agent must implement execute(meta strips identity) + verify. */
export interface Agent {
  readonly meta: AgentMeta;
  /** Perform the task. Must never throw; return ok=false on failure. */
  execute(input: TaskInput): Promise<AgentResult>;
  /**
   * Deterministic nativé verification for THIS agent's output type.
   * Returns {valid, reason}. For DataAgent this re-queries chain state.
   * For ResearchAgent this runs 2-run source consensus / source existence.
   */
  verify(input: TaskInput, output: TaskOutput): Promise<{ valid: boolean; reason: string }>;
}

/** Registry of all known agents keyed by agent id. */
export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    this.agents.set(agent.meta.identity.id, agent);
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }

  /** Route a task to the best agent by capability keyword matching. */
  routeTo(taskPrompt: string): Agent[] {
    const lower = taskPrompt.toLowerCase();
    const scored = this.list().map((a) => {
      let score = 0;
      for (const cap of a.meta.capabilities) {
        if (lower.includes(cap.toLowerCase())) score += 1;
      }
      return { a, score };
    });
    return scored.sort((x, y) => y.score - x.score).map((s) => s.a);
  }
}

export function makeAgentIdentity(role: string, name: string, oneLiner: string, seed: string): AgentIdentity {
  // Stable id derived from role+seed so an agent keeps reputation across runs.
  const id = [
    "agent",
    role.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    seed.slice(0, 12),
  ].join("-");
  return { id, name, role, oneLiner };
}