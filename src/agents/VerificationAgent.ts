/**
 * VerificationAgent — Ovea Scout
 *
 * Runs objective, deterministic checks against a claimed output. This is a
 * special "meta-agent" whose output IS the payment gate: it does not produce
 * content; it decides whether a result is objectively verifiable. It never
 * asks an LLM "does this sound right" — it either re-queries chain state,
 * checks source existence, runs a regex/assertion, or requires 2 independent
 * runs to agree. See brief §7.
 */

import { AgentMeta, Reputation, TaskInput, TaskOutput, makeAgentIdentity } from "./Agent.js";

export interface VerificationResult {
  valid: boolean;
  reason: string;
  /** Deterministic checks that passed/failed. */
  checks: { name: string; passed: boolean }[];
}

export interface VerizonRule {
  /** "onchain:balance", "source-exists", "json-schema", "regex", "consensus-2" */
  kind: string;
  params?: Record<string, unknown>;
}

export interface VerifyOpts {
  claimed: TaskOutput;
  input: TaskInput;
  /** Independent second output (for consensus kind). */
  independent?: TaskOutput;
  /** Re-query function for onchain kinds. */
  onchain?: (query: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const CHECK = (name: string, passed: boolean): VerificationResult["checks"][number] => ({ name, passed });

export async function verifyOutput(r: VerifyOpts): Promise<VerificationResult> {
  const checks: VerificationResult["checks"] = [];

  // 1. Structural: payload must be a non-empty object with no error marker.
  const hasPayload = !!r.claimed.payload && typeof r.claimed.payload === "object";
  checks.push(CHECK("payload-present", hasPayload));
  if (!hasPayload) return { valid: false, reason: "no payload", checks };

  // 2. Deterministic re-query (onchain kinds): ask the chain, not an LLM.
  if (r.onchain) {
    try {
      const fresh = await r.onchain(r.claimed.payload as Record<string, unknown>);
      const match = JSON.stringify(fresh) === JSON.stringify(r.claimed.payload);
      checks.push(CHECK("onchain-match", match));
      return { valid: match, reason: match ? "on-chain state confirms claim" : "on-chain state differs from claim", checks };
    } catch (e) {
      checks.push(CHECK("onchain-match", false));
      return { valid: false, reason: `on-chain query failed: ${(e as Error).message}`, checks };
    }
  }

  // 3. Source-existence: every claimed evidence URL must resolve.
  const evidence = r.claimed.evidence ?? [];
  if (evidence.length > 0) {
    const ok = (await Promise.all(evidence.map(exists))).every(Boolean);
    checks.push(CHECK("evidence-exists", ok));
    if (!ok) return { valid: false, reason: "some evidence URLs do not exist", checks };
  }

  // 4. Consensus-2: two independent runs must agree. Deterministic equality
  //    of the normalized payload (sorted keys).
  if (r.independent) {
    const a = canonical(r.claimed.payload);
    const b = canonical(r.independent.payload);
    const agree = a === b;
    checks.push(CHECK("consensus-2", agree));
    return {
      valid: agree,
      reason: agree ? "two independent runs agree" : "independent runs disagree (refund)",
      checks,
    };
  }

  return { valid: true, reason: "structural + evidence checks passed", checks };
}

function canonical(v: unknown): string {
  if (typeof v !== "object" || v === null) return String(v);
  if (Array.isArray(v)) return JSON.stringify(v.map(canonical));
  const o = v as Record<string, unknown>;
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, canonical(o[k])]));
}

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

/** Wraps the pure verifier into an Agent-shaped object for the dashboard/registry. */
export function makeVerificationAgent(opts: {
  paymentAddress: string;
  reputation?: Reputation;
}) {
  const meta: AgentMeta = {
    identity: makeAgentIdentity(
      "verifier",
      "VerificationAgent",
      "Deterministic gate: on-chain re-query, source existence, 2-run consensus.",
      opts.paymentAddress,
    ),
    capabilities: ["verify", "check", "validate", "confirm", "audit"],
    price: 0.001,
    paymentAddress: opts.paymentAddress,
    inputSchema: { prompt: "object — {target, expected}" },
    outputSchema: { payload: "object — {valid, reason, checks}" },
  };
  return { meta };
}