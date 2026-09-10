/**
 * LLMProvider abstraction — Ovea Scout
 *
 * Every agent calls LLMs through this interface so any provider can be
 * swapped or failed over at runtime. The MVP ships with an OmniRoute (free)
 * provider and a deterministic "none" fallback so verified microtasks keep
 * working even when every generator disappears.
 */

export interface LLMProvider {
  readonly name: string;

  /** Deterministic-ish single completion. Returns null on hard failure (never throws). */
  complete(opts: CompletionOpts): Promise<CompletionResult | null>;
}

export interface CompletionOpts {
  system?: string;
  prompt: string;
  /** Requested model id; null = provider default. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
  /** Optional provider-reported usage. */
  usage?: { promptTokens?: number; completionTokens?: number };
  /** Time to first content, ms. */
  latencyMs: number;
}

/** OpenAI-compatible HTTP chat-completions client (used by OmniRoute/OpenRouter). */
class OpenAICompatProvider implements LLMProvider {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {}

  async complete(opts: CompletionOpts): Promise<CompletionResult | null> {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model ?? this.defaultModel,
          messages: [
            ...(opts.system ? [{ role: "system", content: opts.system }] : []),
            { role: "user", content: opts.prompt },
          ],
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.2,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[llm:${this.name}] HTTP ${res.status}: ${body.slice(0, 300)}`);
        return null;
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      let text = json.choices?.[0]?.message?.content ?? "";
      // Some routers put the whole answer in reasoning_content and
      // leave content empty. Fall back to it when content is blank.
      if (!text.trim()) {
        text = json.choices?.[0]?.message?.reasoning_content ?? "";
      }
      if (!text.trim()) return null;
      return {
        text,
        provider: this.name,
        model: opts.model ?? this.defaultModel,
        usage: {
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
        },
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      console.error(`[llm:${this.name}] error: ${(e as Error).message}`);
      return null;
    }
  }
}

/**
 * Greedy fallback chain. Tries providers in order until one returns text.
 * If none succeed, returns null — callers decide how to degrade.
 */
export class FallbackProvider implements LLMProvider {
  public readonly name = "fallback";

  constructor(private readonly providers: LLMProvider[]) {}

  async complete(opts: CompletionOpts): Promise<CompletionResult | null> {
    const errors: string[] = [];
    for (const p of this.providers) {
      const r = await p.complete(opts);
      if (r) return r;
      errors.push(p.name);
    }
    console.warn(`[llm:fallback] all providers failed (${errors.join(", ")})`);
    return null;
  }
}

/**
 * Deterministic provider — no model at all. Used for the verification path:
 * returns a canned, structured completion so the settlement flow never
 * depends on a live generator for objective checks.
 */
export class DeterministicProvider implements LLMProvider {
  public readonly name = "deterministic";

  constructor(private readonly resolver: (prompt: string) => string) {}

  async complete(opts: CompletionOpts): Promise<CompletionResult | null> {
    return {
      text: this.resolver(opts.prompt),
      provider: this.name,
      model: "deterministic",
      latencyMs: 0,
    };
  }
}

export function createDefaultProvider(env: Record<string, string | undefined>): LLMProvider {
  const chain: LLMProvider[] = [];

  const baseUrl = env.OMNIROUTE_URL ?? process.env.OMNIROUTE_URL ?? "http://127.0.0.1:20128/v1";
  const key = env.OMNIROUTE_KEY ?? process.env.OMNIROUTE_KEY;

  if (key) {
    chain.push(
      new OpenAICompatProvider(
        "omniroute",
        baseUrl,
        key,
        env.OMNIROUTE_MODEL ?? "auto",
      ),
    );
  }

  // OpenRouter free-tier fallback if a token is present.
  const orKey = env.OPENROUTER_KEY ?? process.env.OPENROUTER_KEY;
  if (orKey) {
    chain.push(
      new OpenAICompatProvider("openrouter", "https://openrouter.ai/api/v1", orKey, "auto"),
    );
  }

  // Deterministic provider guarantees verified microtasks never block.
  chain.push(new DeterministicProvider((p) => `[deterministic] ${p}`));

  return new FallbackProvider(chain);
}