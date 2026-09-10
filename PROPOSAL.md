# Ovea Scout — Autonomous AI-Agent Economy on Sui

**Status:** Research + Architecture + Implementation Plan (Phase 1 deliverable)
**Date:** 2026-09-08
**Lead:** Hermes (autonomous engineering team)

---

## 1. Current Sui Ecosystem Research

### 1.1 Why Sui is the right settlement layer (verified against current docs)

| Property | Sui reality (2026) | Implication for agent micropayments |
|---|---|---|
| Finality | ~390ms (Mysticeti consensus) | Near-instant agent settlement |
| Throughput | 20K TPS / 297K CPS | Machine-scale transaction volume |
| Gas per tx | Fractions of a cent | True sub-$0.01 micropayments viable |
| Parallel execution | Object-centric, runs independent txns in parallel | High-frequency agent txns don't serialize |
| **Gasless stablecoin transfers** | ⭐ Protocol-level (mainnet live) | Stablecoin payments with **$0 gas, no SUI required** |
| **Payment Intents** | Batch up to **1024 payments in one atomic tx** | Master agent pays 10s of specialists in one settlement |
| **Sponsored transactions** | Native, documented | Users never need to hold/understand gas |
| **Address Balances** | New account-style balance system | Low-cost embedded wallets at scale |

**Key strategic finding:** Sui has already built the exact rails this project needs:
- **Gasless stablecoin transfers** (live on mainnet) — sub-cent payments with zero gas overhead.
- **Payment Intents** — atomic multi-recipient settlement (1024 payments per tx). This is *the* micropayment primitive.
- **Sponsored transactions** — gasless UX for users.
- **Sui Dollar (USDSui)** by Stripe, plus USDC native — stablecoin infrastructure mature.

**Conclusion: native USDC (or Sui Dollar) is the MVP payment medium.** No custom token needed — exactly as the brief requires. SUI only used for gas on the platform's own sponsored/settlement transactions.

### 1.2 Tooling (verified current)
- **Sui Move** — resource-oriented smart contract language (Sui flavor, not Aptos).
- **`@mysten/sui` TypeScript SDK** — primary path for PTBs. `Transaction` API (`tx.moveCall`, `tx.transferObjects`, `tx.splitCoins`).
- **Programmable Transaction Blocks (PTBs)** — multi-command atomic txns; also used to construct sponsored txns via `Transaction.fromKind(kindBytes)`, `setSender`, `setGasOwner`.
- **Shared vs owned objects** — key architectural decision (see §7).
- **Dynamic fields** — attach arbitrary data to objects (agent reputation, job metadata).
- **Events** — structured on-chain timeline for observability.
- **zkLogin** — passkey/social login, no seed phrase. Great for eventual UX.
- **SuiNS** — human-readable names ("my-agent.sui").

### 1.3 AI fair ($0/low cost) stack — aligns with brief
- **Ollama / MLX on Apple Silicon** (developer has substantial RAM) — local inference.
- **OpenRouter free tiers** — work via existing OmniRoute local gateway (`127.0.0.1:20128/v1`) for free models.
- **Hugging Face / open-source models** — `cfp/*` routes available.
- **LLMProvider abstraction** — swap any provider; FallbackProvider keeps agent alive if one disappears.

### 1.4 Competitive landscape (what exists → where the gap is)
- **x402 / Agent Payment Protocol (AP2)** — *payment execution* standards. x402 = HTTP-paywall payments on Base; AP2/MPP = authorization frameworks. These handle *settlement*, not *verification of agent work*.
- **Eliza / OpenClaw / Virtuals** — agent frameworks and launchpads. Mostly EVM; focus is agent *personas/launch*, not verifiable microtask economies.
- **Mastercard Agent Pay for Machines, Stripe MPP** — traditional-rail machine payments (permissioned, not self-serve permissionless).
- **Sui AI stack** (sui.io/ai) — explicitly targeting "trusted, verifiable AI systems" + "autonomous AI payments." Confirms the thesis but is a *platform pitch*, not a shipped marketplace.
- **AGENTS.x / Pay402 (ETHGlobal)** — hackathon-level Sui zkLogin settlements, minimal.

**The genuine gap:** Nobody ships a *verifiable, self-serve, permissionless microtask marketplace on Sui* where:
1. Deterministic/on-chain verification gates payment (LLMs NOT trusted as ground truth).
2. Buying agents can hire specialist agents with atomic multi-recipient settlement (Payment Intents).
3. Reputation is Sybil-resistant and object-anchored, built-in from day one.
4. It's cheap enough (`$0.001`) that machine-scale microtasking is economically viable.

x402 proves demand; Sui's cost/stability proves the rail. **Ovea Scout is the marketplace that connects verifiable work to Sui settlement.**

---

## 2. Twenty Candidate Business Ideas + Scoring

Scoring scale (0–10 each). Criteria:
- **MD** = Market demand, **TD** = Technical difficulty, **SA** = Sui advantage (does blockchain actually help?),
- **MP** = Micropayment value, **AF** = AI feasibility, **C** = Competition (10 = wide open), **M** = Monetization (10 = clear), **SFF** = Solo-founder fit.

| # | Use case | MD | TD | SA | MP | AF | C | M | SFF | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Sui microtask market (research/verify as-a-service)** | 8 | 6 | 10 | 10 | 9 | 8 | 8 | 8 | **67** |
| 2 | On-chain data verification oracle (address balances, txn proofs) | 8 | 7 | 10 | 10 | 8 | 6 | 8 | 7 | **64** |
| 3 | Agent reputation registry / Sybil-resistant identity | 7 | 8 | 9 | 7 | 7 | 7 | 7 | 7 | **59** |
| 4 | Machine-generated content QA / fact-check marketplace | 8 | 6 | 6 | 8 | 8 | 5 | 8 | 8 | **57** |
| 5 | Autonomous bounty market (dev bounties on Sui) | 8 | 8 | 8 | 7 | 6 | 5 | 8 | 5 | **55** |
| 6 | NFT analytics / collection intelligence service | 6 | 6 | 7 | 7 | 8 | 5 | 7 | 7 | **53** |
| 7 | DeFi yield/position monitoring agent | 8 | 7 | 7 | 6 | 7 | 4 | 8 | 6 | **53** |
| 8 | News/alpha aggregator with deterministic sourcing | 7 | 5 | 5 | 6 | 8 | 3 | 7 | 8 | **49** |
| 9 | Translation microservices for agents (i18n jobs) | 6 | 4 | 5 | 7 | 8 | 6 | 7 | 8 | **51** |
| 10 | Code review / lint microtask bounties | 7 | 6 | 5 | 6 | 7 | 3 | 8 | 7 | **49** |
| 11 | Wallet-risk scoring (a-priori for agents) | 7 | 7 | 8 | 8 | 7 | 6 | 7 | 6 | **56** |
| 12 | Price/volatility micro-alerts (buy agents) | 7 | 5 | 6 | 6 | 8 | 3 | 8 | 7 | **50** |
| 13 | Data-labeling verifiable microtasks | 7 | 4 | 5 | 8 | 6 | 4 | 5 | 7 | **46** |
| 14 | CAPTCHA / human-verification microtasks | 5 | 3 | 3 | 6 | 2 | 4 | 4 | 7 | **34** |
| 15 | Storage-notarized docs (Walrus) for agents | 6 | 7 | 8 | 6 | 5 | 6 | 6 | 5 | **49** |
| 16 | Token-launch due diligence (agents) | 7 | 7 | 7 | 7 | 8 | 5 | 8 | 5 | **54** |
| 17 | Agent-to-agent general commerce hub | 9 | 8 | 8 | 8 | 6 | 6 | 8 | 5 | **58** |
| 18 | Governed data-mart access (pay-per-query) | 7 | 6 | 6 | 8 | 7 | 6 | 7 | 6 | **53** |
| 19 | Social-reputation attester (proof-of-reputation) | 6 | 7 | 8 | 6 | 5 | 6 | 6 | 6 | **50** |
| 20 | Compliance audit trail for agent ops | 6 | 8 | 8 | 5 | 6 | 5 | 7 | 5 | **50** |

### Top 3
1. **Sui microtask marketplace** (67) — research/data/verify-as-a-service with deterministic payment gating.
2. **On-chain data verification oracle** (64) — deterministic ground-truth queries (balances, txn proofs), core primitive all agents need.
3. **Agent reputation registry** (59) — Sybil-resistant, object-anchored, portable reputation.

**Note on #17 (general agent commerce, 58):** highest demand but weakest micro-margin + hardest to sole-found — it's the *long-term* vision we approach *through* #1. This avoids building vague infrastructure before validation (per brief §13).

---

## 3. Recommended MVP: **Ovea Scout — the verifiable microtask marketplace**

### Core loop (matches brief §5 example exactly)
1. Human/agent **submits a task** with bounty (USDC) + verification rule.
2. **Master Agent** parses intent, routes to specialist agents, or a single specialist accepts.
3. **Specialist agents** (2–3 first) each perform one narrow, *deterministically-verifiable* task.
4. **Verification agent/mechanism** checks objective evidence — **on-chain query, NOT an LLM's opinion.**
5. Payment auto-settles via **Sui Payment Intent** (atomic multi-recipient: specialist 80%, verifier + platform split ~20%).

### First real vertical: **"Verify my on-chain claim" microtasks**
This is the highest-leverage wedge because:
- **Deterministic verification is natural.** "Does wallet X hold ≥ 4.31 SUI?" → query the RPC, not an LLM. This is the brief's §7 mandate, and it makes verification cheap and objective.
- **Genuine Sui advantage (score-S4).** The verification can be *anchored on-chain* — the platform publishes a claim + evidence + verdict as a Sui object, so a buying agent can trust the answer was derived from chain state, not hallucination.
- **Everyone needs it.** Every agent economy project (Eliza agents, x402 merchants, Sui AI stack) needs to verify chain facts. We become the verifier-of-record.
- **Micro-margin works.** $0.01–$0.05 task at ~$0.0000 LLM cost (free/local) + sub-$0.001 gas → positive unit economics provable.

### The three MVP specialist agents (brief §5: build 2–3 excellent first)
1. **DataAgent** — deterministic on-chain queries (SUI balance, coin holding, txn status/effects, object existence). Verification = the query itself.
2. **ResearchAgent** — short web-research tasks returning *citable, source-linked* answers. Verification = source-existence + dedup consensus (2 independent runs must agree on the cited source, else pay withheld).
3. **VerificationAgent** — runs objective checks (diff/assertion/regex/on-chain query against a claimed output). Its output IS the payment gate.

*(MarketAgent/WalletAgent/NFTAgent/DeFiAgent/NewsAgent come later; the adapter pattern makes adding them trivial.)*

---

## 4. Proposed Architecture

```
 ┌────────────────────────────────────────────────────────────┐
 │                     Ovea Scout (Node/TS)                   │
 │                                                            │
 │  human/agent → API server (Express) + Dashboard (web UI)   │
 │                                                            │
 │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
 │  │Data  │ │Research│ │Verify│ │Master│ │Route │  agents    │
 │  │Agent │ │Agent   │ │Agent │ │(orchestr│)│register/MCP   │
 │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
 │       Agent interface: identity/capabilities/price/rep/    │
 │       I/O schema/execute/verify + payment address          │
 │                                                            │
 │  ┌─────────────────────────┐   ┌────────────────────────┐  │
 │  │ LLMProvider abstraction │   │  Verification engine   │  │
 │  │  LocalMLX │ Ollama │    │   │  deterministic: onchain│  │
 │  │  OpenRouter │ Fallback  │   │  query/diff/assert/    │  │
 │  └─────────────────────────┘   │  consensus > gate      │  │
 │                                └────────────────────────┘  │
 │  ┌──────────────────────────────────────────────────────┐  │
 │  │  Sui settlement layer (@mysten/sui)                  │  │
 │  │  PTBs + Payment Intents + sponsored txns (gasless)   │  │
 │  │  Job/Rep/Result objects (Move, dynamic fields)       │  │
 │  └──────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────┘
```

### Key design decisions
- **Settlement: native USDC (Sui) via gasless transfers + Payment Intents.** Atomic multi-recipient payout. SUI gas only on platform's own sponsored txns. **No token** (brief §15) — MVP runs on existing stablecoins.
- **Verification: deterministic first.** For every claim type we define a verifier that queries chain state / asserts structure / needs 2-run source consensus. Payment only released when verifier passes. LLM output is *evidence for a human/routing decision*, never ground truth (brief §7).
- **Reputation: off-chain registry + on-chain anchored commitments.** Scores are computed/persisted off-chain (fast, cheap), but each job emits an on-chain *Event* (task, agent, verdict, amount) so history is append-only and auditable. Sybil-resistance: reputation weights jobs by *verification success rate* and requires **minimal deposit stake** (small USDC collateral) per agent identity → creating 1000 fake identities costs capital, so it can't be done trivially (brief §6). Object-anchored: an agent's rep object is owned by its identity key; zkLogin identity provides human attestation signal later.
- **Gasless UX + spending limits:** platform sponsors gas on task-submission + settlement. Payment Intents let us split to N recipients atomically. **Spending caps** enforced in the Move settlement module (per-tx max, per-day max, ALLOWED tokens/functions, DENY by default) — brief §8.
- **Security:** private keys only in environment (never code/commit); disposable testnet wallet; `MAX_TRANSACTION_VALUE`, `MAX_DAILY_SPEND`, `ALLOWED_CONTRACTS`, `ALLOWED_FUNCTIONS`, `ALLOWED_TOKENS`; emergency_shutdown flag in Move module; no arbitrary contract execution; tokens only to allow-listed fee/disbursement addresses.

---

## 5. Required Free/Local AI Models (LLMProvider)

| Provider | Model(s) | Cost | Use |
|---|---|---|---|
| **OmniRoute (local gateway `127.0.0.1:20128/v1`)** | `auto` (1M ctx); `cfp/google/gemma-4-26b-a4b-it`, `cfp/meta/llama-4-scout`, `cfp/mistralai/mistral-small-3.1`, `cfp/qwen/qwen3-30b`, `cfp/deepseek-r1-distill-qwen-32b`, `oc/glm-4.7-flash-free` | **$0** (free tiers) | Routing, ResearchAgent, summaries |
| **Ollama (local)** | llama3/llama3.1/qwen optional if runtimes installed | $0 | Budget local fallback |
| **MLX on Apple Silicon** | Local, if models downloaded | $0 | Zero-cost local inference |
| **OpenRouter direct** | `nvidia/nemotron` free tiers | $0 | Last-resort fallback |
| **FallbackProvider** | chains the above; returns structured error, never crashes | — | Resilience |

**Design rule:** every agent calls LLM via `LLMProvider.complete()`; the engine auto-fails-over. The MVP's *verification* path avoids LLMs entirely (deterministic), so even if all free providers vanish, verified microtasks (balances, txn proofs) still settle correctly.

---

## 6. Estimated Operating Cost (MVP)

| Item | Cost |
|---|---|
| LLM inference | **$0.000** (all free/local via OmniRoute + Ollama) |
| RPC (Sui testnet/mainnet public RPC) | $0.000x (public endpoint; paid endpoint later) |
| Sui gas | sub-$0.001/tx (gasless stablecoin transfers for value moves) |
| Storage object per job | ~0.001 SUI (refundable storage, reclaimable) |
| Hosting (this Mac local / cheap VPS later) | ~$0 now, $5–15/mo later |
| **Cost per successful microtask** | **≈ $0.000 – $0.004** |
| **Revenue per microtask** | **$0.005–0.05 (platform fee 10–20%)** |
| **Net margin** | **positive and large** — the entire thesis |

The economics only work if volume exists; hence the *verifiable on-chain claim* wedge (naturally recurring, deterministic, cheap to produce).

---

## 7. Security Model (default-DENY)

```
Per-agent wallet: disposable, testnet first.
Enforced at settlement module:
  MAX_TRANSACTION_VALUE      (per tx)
  MAX_DAILY_SPEND            (per agent per day)
  ALLOWED_TOKENS             (USDC (Sui), SUI only)
  ALLOWED_CONTRACTS          (only Ovea Scout settlement package)
  ALLOWED_FUNCTIONS          (only authorize/disburse/dispute/settle)
  EMERGENCY_SHUTDOWN         (bool; halts all new authorizations)
Keys: env only (Sui_PRIVATE_KEY in .env, gitignored).
   NEVER in code, logs, or commit. .env.example holds placeholders.
No arbitrary Move calls. No arbitrary transfers.
Human approval gated: mainnet wallet funding / financial-contract deploy
   requires explicit human sign-off (per brief §18, §AUTONOMY).
```

---

## 8. Step-by-Step Implementation Plan

- [x] **P0 Research** — Sui docs, agent frameworks, payments, landscape (this doc).
- [ ] **P1 Repo scaffold** — npm/TS project, `@mysten/sui`, configs (in progress).
- [ ] **P2 LLMProvider** — `LocalMLX/Ollama/OpenRouter/Fallback` abstraction + config.
- [ ] **P3 Agent framework** — `Agent` interface + registry + `MasterAgent` orchestrator + `DataAgent`/`ResearchAgent`/`VerificationAgent`.
- [ ] **P4 Sui settlement** — Move package: `Job`, `Reputation`, `settle` (Payment-Intent-style multi-recipient split), `authorize` (spend limits), `emergency_shutdown`. Deploy to **testnet** with disposable wallet.
- [ ] **P5 Verification engine** — deterministic verifiers (on-chain query, diff, assertion, 2-run source consensus).
- [ ] **P6 Job orchestration + persistence** — task lifecycle OFF-chain (memory ledger) + ON-chain events/anchors.
- [ ] **P7 API + Dashboard** — Express API for submit/list/quote; simple web dashboard (jobs, agents, payments, reputation, tx hash timeline).
- [ ] **P8 End-to-end testnet test** — real task → agent → verify → settle; survive failed agents & failed txns; cost/unit metrics.
- [ ] **P9 Docs** — README / ARCHITECTURE / SECURITY / ECONOMICS / AGENTS / DEPLOYMENT / TESTING / ROADMAP.
- [ ] **P10 (gated)** — Limited mainnet with dedicated low-balance wallet, spending caps, human approval.

---

## 9. Definition of Success (trace to brief §20)

1. User submits a real task via API/UI. ✅ (P3/P6)
2. An agent accepts it. ✅ (P3)
3. The agent performs useful, deterministic-verifiable work. ✅ (P3/P5)
4. Result independently verified (on-chain query / 2-run source consensus). ✅ (P5)
5. Payment settles on **Sui testnet** (atomic multi-recipient via sponsored/PTB). ✅ (P4)
6. Agent reputation changes from results. ✅ (P4/P3)
7. Whole flow runs without manual per-agent operation. ✅ (MasterAgent + orchestration)
8. System survives failed agents + failed txns (retry/refund/log). ✅ (P6)
9. Records observability timeline (input/output hashes, model, cost, digest). ✅ (P6)
10. Economics show the cheap/high-throughput Sui advantage (unit-cost report). ✅ (P8)

---

## 10. Revenue Model (brief §14 — usage-based preferred)

- **Transaction fee:** 10–20% of each successful task (platform cut taken inside the same Payment Intent).
- **Enterprise API / marketplace discovery / premium agents:** later, after traction.
- **No token** at MVP (§15). Revenue = usage fee on real, verified work.

---

*Next action: build P2–P4 autonomously, deploy settlement to Sui testnet with a disposable wallet, then end-to-end test.*