# Ovea Scout — Testing

**Unit, Integration, E2E, Load**

---

## Test pyramid

```
        E2E (10 tests)          ← full task flow on testnet
       /                        \
  Integration (20 tests)        ← agent + settlement + ledger
     /                            \
Unit (50+ tests)                  ← pure functions, verifier, hash
```

---

## Running tests

```bash
# TypeScript unit/integration
cd /Users/RoRo_HQ/Hermes/ovea-scout
npm test          # currently placeholder; extend with vitest/jest

# Move unit tests
cd move/ovea_settlement
sui move test

# Full E2E (requires testnet + funded wallet)
npm run test:e2e  # (to be implemented)
```

---

## Unit test coverage targets

| Module | Target | Key cases |
|--------|--------|-----------|
| `LLMProvider` | 90% | Fallback chain, deterministic provider, error handling |
| `AgentRegistry` | 85% | Route by capability, stable IDs |
| `DataAgent` | 80% | Balance/object/txn query, re-query verification |
| `ResearchAgent` | 75% | JSON parse, source extraction, HEAD check |
| `VerificationEngine` | 95% | onchain-match, source-exists, consensus-2, canonical JSON |
| `SuiSettlement` | 80% | Limits, allow-list, buildSettleTx, signAndExecute |
| `JobLedger` | 85% | Append, query by agent, persistence |
| `MasterAgent` | 70% | Route→execute→verify→settle→refund |
| `hashJSON` | 100% | Stability, determinism |

---

## Integration test scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| DataAgent happy path | submit balance query → execute → verify → settle | `status: "verified"`, `paymentMist > 0`, `digest` present |
| ResearchAgent happy path | submit research → execute → verify sources → settle | `status: "verified"`, all sources resolve |
| Failed verification | submit bad balance → verify fails → refund | `status: "refunded"`, `paymentMist: "0"` |
| Emergency shutdown | enable shutdown → submit task → rejected | `status: "failed"`, "shutdown" in reason |
| Limit exceeded | submit task > max_tx → rejected | `status: "failed"`, "exceeds maxTransactionValue" |
| Consensus-2 mismatch | two runs differ → rejected | `status: "refunded"`, "independent runs disagree" |
| Source dead | cite 404 URL → verify fails → refund | `status: "refunded"`, "evidence URLs do not exist" |

---

## E2E testnet script (manual)

```bash
#!/bin/bash
# testnet-e2e.sh
set -e

API="http://localhost:8080"

# Health
curl -sf $API/health | jq .

# Submit 5 DataAgent tasks
for i in {1..5}; do
  curl -sf -X POST $API/tasks -H "Content-Type: application/json" \
    -d '{"prompt":"Query SUI balance","budgetUsdc":0.05,"context":{"queryType":"balance","address":"0x'$i'1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"}}' | jq .
  sleep 1
done

# Submit 5 ResearchAgent tasks
for i in {1..5}; do
  curl -sf -X POST $API/tasks -H "Content-Type: application/json" \
    -d '{"prompt":"Latest Sui grant round '$i'","budgetUsdc":0.05}' | jq .
  sleep 1
done

# Check ledger
curl -sf $API/ledger | jq '. | length'
```

---

## Load testing

```bash
# wrk (install: brew install wrk)
wrk -t4 -c100 -d30s -s post.lua http://localhost:8080/tasks
```

`post.lua`:
```lua
wrk.method = "POST"
wrk.headers["Content-Type"] = "application/json"
wrk.body = '{"prompt":"Query SUI balance","budgetUsdc":0.05,"context":{"queryType":"balance","address":"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"}}'
```

**Targets:**
- 100 req/s sustained
- p99 latency < 500ms
- 0% 5xx errors
- Settlement success rate > 99%

---

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm test
  move:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MystenLabs/setup-sui@v1
      - run: cd move/ovea_settlement && sui move test
```

---

## Manual QA checklist (per release)

- [ ] `npm run build` passes
- [ ] `sui move build` passes
- [ ] `sui move test` passes
- [ ] Local API starts, `/health` returns 200
- [ ] Dashboard loads at `/`
- [ ] DataAgent balance query → verified → paid
- [ ] ResearchAgent search → sources resolve → verified → paid
- [ ] Invalid task → refunded
- [ ] Emergency shutdown blocks new tasks
- [ ] Ledger shows all events
- [ ] Dashboard updates in real-time
- [ ] No private keys in logs/output