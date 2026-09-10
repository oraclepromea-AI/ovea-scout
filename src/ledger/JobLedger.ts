/**
 * JobLedger — off-chain job + event timeline (brief §16 observability).
 *
 * Append-only JSONL. Stores timestamp, agent, task, input/output hashes,
 * model, cost, payment, verification result, transaction digest. Never logs
 * private keys or raw secrets.
 */

import * as fs from "node:fs";

export interface LedgerEvent {
  ts: number;
  event: string;
  agentId?: string;
  jobId?: string;
  detail?: Record<string, unknown> | string;
  [k: string]: unknown;
}

export class JobLedger {
  private file: string;
  private events: LedgerEvent[] = [];

  constructor(filePath: string) {
    this.file = filePath;
    if (fs.existsSync(filePath)) {
      try {
        const lines = fs.readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);
        this.events = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      } catch {
        this.events = [];
      }
    }
    fs.mkdirSync(require_dir(filePath), { recursive: true });
  }

  record(ev: LedgerEvent): void {
    ev.ts = ev.ts ?? Date.now();
    this.events.push(ev);
    try {
      fs.appendFileSync(this.file, JSON.stringify(ev) + "\n", "utf8");
    } catch (e) {
      console.error(`[ledger] append failed: ${(e as Error).message}`);
    }
  }

  all(): LedgerEvent[] {
    return this.events.slice();
  }

  byAgent(agentId: string): LedgerEvent[] {
    return this.events.filter((e) => e.agentId === agentId);
  }
}

function require_dir(fp: string): string {
  const idx = fp.lastIndexOf("/");
  return idx > 0 ? fp.slice(0, idx) : ".";
}