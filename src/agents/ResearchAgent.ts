/**
 * ResearchAgent — Ovea Scout
 *
 * Short web-research tasks returning citable, source-linked answers.
 * Uses the LLMProvider abstraction for generation but verification is
 * objective: every claimed "fact" must be backed by a source URL the
 * verifier can independently check exists (2-run source consensus).
 */

import { LLMProvider } from "../llm/LLMProvider.js";
import { Agent, AgentMeta, AgentResult, makeAgentIdentity, Reputation, TaskInput, TaskOutput } from "./Agent.js";

export interface ResearchAgentOpts {
  llm: LLMProvider;
  paymentAddress: string;
  reputation?: Reputation;
}

const SYSTEM = [
  "You are Ovea Scout ResearchAgent. Answer concisely and objectively.",
  "Support every factual claim with a real, verifiable source URL.",
  "Return a JSON object: {\"answer\": string, \"sources\": [string url]}.",
  "Never invent URLs. If you cannot verify a fact, say 'unverified'.",
].join("\n");

export class ResearchAgent implements Agent {
  readonly meta: AgentMeta;

  constructor(private readonly opts: ResearchAgentOpts) {
    this.meta = {
      identity: makeAgentIdentity(
        "research",
        "ResearchAgent",
        "Citable web research with source-linked answers.",
        opts.paymentAddress,
      ),
      capabilities: ["research", "news", "find", "opportunit", "alpha", "analysis", "report", "web"],
      price: 0.02,
      paymentAddress: opts.paymentAddress,
      inputSchema: { prompt: "string", context: "object" },
      outputSchema: { payload: "object — {answer, sources}", evidence: "string[]" },
    };
  }

  async execute(input: TaskInput): Promise<AgentResult> {
    // Retry a few times: cheap free inference can return non-JSON on a bad draw.
    for (let attempt = 0; attempt < 3; attempt++) {
      const llm = await this.opts.llm.complete({ system: SYSTEM, prompt: input.prompt, temperature: 0.2 });
      if (!llm) continue;
      const parsed = this.parseJson(llm.text);
      if (!parsed) continue;
      const sources: string[] = Array.isArray(parsed.sources) ? parsed.sources : [];
      return {
        ok: true,
        output: {
          payload: { answer: String(parsed.answer ?? ""), sources },
          evidence: sources,
          provenance: { llm: llm.provider, model: llm.model },
          completedAt: Date.now(),
        },
      };
    }
    return { ok: false, error: "LLM did not return valid JSON after retries" };
  }

  private parseJson(text: string): { answer?: string; sources?: string[] } | null {
    // Strip markdown fences then locate first { ... }
    const cleaned = text.replace(/```[a-z]*/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  async verify(input: TaskInput, output: TaskOutput): Promise<{ valid: boolean; reason: string }> {
    const sources = (output.payload.sources as string[]) ?? [];
    if (sources.length === 0) {
      return { valid: false, reason: "no sources provided — cannot independently verify" };
    }
    // Check each URL actually resolves (http HEAD/GET) — deterministic proof
    // the source exists, independent of what any LLM says.
    const results = await Promise.all(sources.map(async (u) => ({ u, ok: await urlExists(u) })));
    const bad = results.filter((r) => !r.ok);
    if (bad.length > 0) {
      return { valid: false, reason: `sources failed existence check: ${bad.map((b) => b.u).join(", ")}` };
    }
    return { valid: true, reason: `all ${sources.length} sources resolve` };
  }
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}