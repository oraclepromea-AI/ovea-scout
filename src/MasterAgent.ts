/**
 * MasterAgent — Ovea Scout orchestrator
 *
 * Accepts a task, routes it to the best specialist based on capabilities &
 * price, runs deterministic verification, splits payment atomically, and
 * records the timeline. The human/agent-facing facade (brief §12 + §5).
 */

import { Agent, AgentRegistry, TaskInput, TaskOutput } from "./agents/Agent.js";
import { verifyOutput } from "./agents/VerificationAgent.js";
import { SuiSettlement } from "./sui/SuiSettlement.js";
import { Oracle } from "./sui/Oracle.js";
import { JobLedger } from "./ledger/JobLedger.js";
import { hashJSON } from "./util/hash.js";

export interface JobOutcome {
  jobId: string;
  agentId: string;
  ok: boolean;
  verified: boolean;
  reason: string;
  inputHash: string;
  outputHash: string | null;
  costUsdc: number;
  paymentMist: string;
  digest?: string;
  status: "accepted" | "executing" | "verified" | "failed" | "refunded";
}

/** Platform fee share taken from total task value before paying specialist. */
let platformFee = 0.1;
export function setPlatformFee(f: number) { platformFee = Math.max(0, Math.min(0.5, f)); }

/** USDC on Sui uses 6 decimals. Price is in whole USDC; 1 USDC = 1e6 mist-equivalent. */
function mistFor(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1e6));
}
function ledgerJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class MasterAgent {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly oracle: Oracle,
    private readonly settle: SuiSettlement,
    private readonly ledger: JobLedger,
    private readonly platformFeeAddress: string,
  ) {}

  /** Run a human-provided task end-to-end. */
  async runHumanTask(prompt: string, budgetUsdc: number, context?: Record<string, unknown>): Promise<JobOutcome> {
    const ranked = this.registry.routeTo(prompt);
    const agent = ranked[0];
    if (!agent) {
      return this.fail("none", prompt, "no agent matches task");
    }
    if (agent.meta.price > budgetUsdc) {
      return this.fail(agent.meta.identity.id, prompt, `agent price ${agent.meta.price} > budget ${budgetUsdc}`);
    }

    const jobId = ledgerJobId();
    const agentId = agent.meta.identity.id;
    const input: TaskInput = { prompt, context };
    this.log(jobId, "accepted", agentId, { prompt });

    const result = await agent.execute(input).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    if (!result.ok || !result.output) {
      const err = result.error ?? "execution failed";
      this.log(jobId, "failed", agentId, err);
      return this.outcome(jobId, agentId, prompt, false, err, null, err, agent.meta.price, "0", "failed");
    }
    const output = result.output;
    this.log(jobId, "executed", agentId, { outputHash: hashJSON(output) });

    const verification = await verifyOutput({
      claimed: output,
      input,
      onchain: this.isDataAgent(agent)
        ? async (q: Record<string, unknown>) => {
            const addr = (q.address as string) ?? (input.context?.address as string) ?? "";
            const qtype = (q.type as string) ?? (input.context?.queryType as string);
            return this.oracle.query(qtype, addr);
          }
        : undefined,
    });
    this.log(jobId, "verify-result", agentId, { valid: verification.valid, checks: verification.checks, reason: verification.reason });

    let paymentMist = "0";
    let digest: string | undefined;
    if (verification.valid) {
      const totalMist = mistFor(agent.meta.price);
      const fee = BigInt(Math.round(Number(totalMist) * platformFee));
      const net = totalMist - fee;
      try {
        digest = await this.settle.settle({
          payoutCoinType: this.settle.payoutCoinType,
          totalMist: totalMist.toString(),
          recipients: [
            [this.platformFeeAddress, fee.toString()],
            [agent.meta.paymentAddress, net.toString()],
          ],
          jobId,
        });
        paymentMist = net.toString();
        this.log(jobId, "settled", agentId, { digest, netMist: paymentMist });
      } catch (e) {
        this.log(jobId, "settle-failed", agentId, (e as Error).message);
        return this.outcome(jobId, agentId, prompt, true, `verify passed but settle failed: ${(e as Error).message}`, output, verification.reason, agent.meta.price, "0", "refunded");
      }
    } else {
      this.log(jobId, "rejected", agentId, { reason: verification.reason });
    }

    return this.outcome(
      jobId, agentId, prompt, true,
      verification.reason, output,
      verification.reason, agent.meta.price, paymentMist,
      verification.valid ? "verified" : "refunded",
      digest,
    );
  }

  private isDataAgent(agent: Agent): boolean {
    return agent.meta.identity.role === "DataAgent";
  }

  private fail(agentId: string, prompt: string, reason: string): JobOutcome {
    return this.outcome(ledgerJobId(), agentId, prompt, false, reason, null, reason, 0, "0", "failed");
  }

  private outcome(
    jobId: string, agentId: string, prompt: string, ok: boolean,
    reason: string, output: TaskOutput | null,
    _detail: string, costUsdc: number, paymentMist: string,
    status: JobOutcome["status"], digest?: string,
  ): JobOutcome {
    return {
      jobId, agentId, ok, verified: status === "verified", reason,
      inputHash: hashJSON(prompt), outputHash: output ? hashJSON(output) : null,
      costUsdc, paymentMist, digest, status,
    };
  }

  private log(jobId: string, event: string, agentId: string, detail?: Record<string, unknown> | string): void {
    this.ledger.record({ ts: Date.now(), jobId, event, agentId, detail });
  }
}