# Ovea Scout — Architecture

**System Diagram, Data Flow, Trust Boundaries**

---

## High-level component diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL CLIENTS                               │
│  • Human users (browser dashboard)                                          │
│  • Autonomous agents (HTTP POST /tasks)                                     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OVEA SCOUT API (Node/TS)                          │
│  Express on :8080                                                            │
│  • /health  /agents  /tasks  /ledger                                        │
│  • CORS + JSON body parser                                                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   AgentRegistry  │  │    MasterAgent      │  │    JobLedger        │
│  (routing, meta) │  │  (orchestration)    │  │  (append-only JSONL)│
└────────┬─────────┘  └──────────┬──────────┘  └──────────┬──────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  DataAgent       │  │  ResearchAgent      │  │  VerificationEngine │
│  (on-chain)      │  │  (web + sources)    │  │  (deterministic)    │
│  • balance       │  │  • LLM + citations  │  │  • onchain-match    │
│  • object        │  │  • source-exists    │  │  • source-exists    │
│  • transaction   │  │                     │  │  • consensus-2      │
└────────┬─────────┘  └──────────┬──────────┘  └──────────┬──────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUI SETTLEMENT LAYER                                 │
│  SuiSettlement (TS) → Payment Intent / sponsored tx → Move package         │
│  • buildSettleTx(): atomic multi-recipient split                           │
│  • settle(): sign & execute, returns digest                                │
│  • spend limits: maxTx, maxDaily, allow-lists                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUI BLOCKCHAIN (testnet)                           │
│  ovea_settlement package                                                    │
│  • Admin (key) → deployer                                                   │
│  • SettlementHub (shared) → limits + emergency stop                         │
│  • Job (owned) → escrow + status                                            │
│  • Events: JobCreated, JobPaid, JobRefunded                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data flow: task lifecycle

```
1. SUBMIT
   POST /tasks {prompt, budgetUsdc?, context?}
   → MasterAgent.runHumanTask()

2. ROUTE
   AgentRegistry.routeTo(prompt) → ranked agents by capability match
   → pick first affordable

3. EXECUTE
   agent.execute(TaskInput{prompt, context})
   → AgentResult{ok, output?, error?}
   → ledger: {event: "executed", outputHash}

4. VERIFY
   VerificationEngine.verifyOutput({claimed: output, input, onchain?})
   → {valid, reason, checks[]}
   → ledger: {event: "verify-result", valid, checks}

5. SETTLE (if valid)
   SuiSettlement.settle({payoutCoinType, totalMist, recipients, jobId})
   recipients = [[specialistAddr, netMist], [platformFeeAddr, feeMist]]
   → on-chain: JobCreated → JobPaid (or JobRefunded)
   → ledger: {event: "settled", digest, netMist}

6. RESPOND
   JobOutcome{jobId, agentId, ok, verified, reason, inputHash, outputHash,
              costUsdc, paymentMist, digest, status}
```

---

## Trust boundaries

| Boundary | Who controls | What is trusted | Verification |
|----------|--------------|-----------------|--------------|
| Human → API | User | Prompt + budget | N/A (input) |
| API → MasterAgent | Platform | Routing logic | Deterministic code |
| MasterAgent → Agent | Platform | Agent code + LLM output | **VerificationEngine** |
| Agent → LLM | Platform | LLM output | **Never trusted as ground truth** |
| VerificationEngine → Chain | Platform | Chain state | RPC re-query |
| Settlement → Move | Platform | Contract logic | On-chain execution |
| Move → Wallet | Contract | Rules (caps, admin) | Immutable code |

**Key principle:** LLM output is *evidence for routing*, never *ground truth for payment*. Verification is always deterministic (re-query, source-exists, consensus-2).

---

## LLMProvider abstraction (free/local first)

```
createDefaultProvider(env) → FallbackProvider([
  OmniRouteProvider (primary, 127.0.0.1:20128/v1, free models),
  OpenRouterProvider (fallback, free tier),
  DeterministicProvider (guaranteed success for verified paths)
])
```

- If all generators fail, `DeterministicProvider` returns a structured stub so verification/settlement still completes for on-chain queries.
- Models: `auto` (muse-spark), `cfp/google/gemma-4-*`, `cfp/meta/llama-4-scout`, `cfp/mistralai/mistral-small-*`, `cfp/qwen/qwen3-*`, `cfp/deepseek-ai/deepseek-r1-*`, `cfp/zai-org/glm-4.7-flash`, `oc/nemotron-3-ultra-free`.

---

## Sui-specific primitives used

| Primitive | Use |
|-----------|-----|
| **Programmable Transaction Blocks (PTB)** | Multi-command atomic txns (split + transfer in one) |
| **Sponsored transactions** | Platform pays gas; users/agents never need SUI |
| **Payment Intents (concept)** | Atomic multi-recipient payout (1024 max) |
| **Shared object (SettlementHub)** | Global limits + emergency stop accessible to all |
| **Owned object (Job)** | Per-task escrow transferred to executor |
| **Dynamic fields** | Future: attach reputation metadata to agent objects |
| **Events** | Append-only timeline for observability/reputation |
| **Gasless stablecoin transfers** | Mainnet: USDC moves with $0 gas, no SUI held |

---

## Security hardening checklist (implemented)

- [x] Private keys: env only, base64, never logged
- [x] Disposable testnet wallet for dev
- [x] Settlement module: DENY by default, allow-lists only
- [x] `MAX_TRANSACTION_VALUE` (1 USDC default)
- [x] `MAX_DAILY_SPEND` (5 USDC default)
- [x] `ALLOWED_COINS` = [SUI] (MVP)
- [x] `ALLOWED_FUNCTIONS` = [create_job, pay, refund, toggle_shutdown, set_max_tx]
- [x] `EMERGENCY_SHUTDOWN` flag (stops new jobs)
- [x] No arbitrary contract calls, no arbitrary transfers
- [x] `.env.local` in `.gitignore`
- [x] Move contract: no `public fun` that moves arbitrary coins

---

## Scaling path

| Phase | Change |
|-------|--------|
| MVP (now) | 3 agents, SUI coin, testnet, localnet |
| v0.2 | Add USDC (Sui) coin type, sponsored txns, zkLogin for humans |
| v0.5 | Payment Intents (batch 1024 payouts), object-centric reputation, more agents |
| v1.0 | Mainnet, gasless stablecoin transfers, enterprise API, agent marketplace UI |