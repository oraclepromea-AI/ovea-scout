# Ovea Scout — Deployment

**Step-by-Step: Local → Testnet → Mainnet**

---

## Prerequisites

- Node.js 20+
- Sui CLI 1.79+
- `npm install` in project root
- `.env.local` with keys (see `.env.example`)

---

## Phase 1: Local development

```bash
# 1. Start local Sui network (saves state between runs)
sui start --with-faucet --with-indexer

# 2. Publish Move package
cd move/ovea_settlement
sui client publish --network localnet --gas-budget 20000000
# → note package ID, Admin cap ID, SettlementHub ID

# 3. Configure env
cp .env.example .env.local
# Set SUI_NETWORK=localnet
# Set SUI_PRIVATE_KEY (base64 from sui keytool list)
# Set SUI_RPC_URL=http://127.0.0.1:9000

# 4. Build & run
cd /Users/RoRo_HQ/Hermes/ovea-scout
npm run build
node --env-file=.env.local dist/index.js

# 5. Test
curl http://localhost:8080/health
curl -X POST http://localhost:8080/tasks -H "Content-Type: application/json" \
  -d '{"prompt":"Query SUI balance","budgetUsdc":0.05,"context":{"queryType":"balance","address":"0x..."}}'
```

---

## Phase 2: Testnet

```bash
# 1. Switch network
# In .env.local: SUI_NETWORK=testnet, SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# 2. Get testnet SUI from faucet
sui client faucet --network testnet

# 3. Publish
cd move/ovea_settlement
sui client publish --network testnet --gas-budget 20000000
# → record: PACKAGE_ID, ADMIN_CAP_ID, HUB_ID

# 4. Configure contract addresses (update Move if needed)
# Currently uses 0x0 placeholder; for real deploy replace with actual IDs.

# 5. Run API
node --env-file=.env.local dist/index.js

# 6. End-to-end test
# Submit tasks, verify settlements in Sui Explorer
```

---

## Phase 3: Testnet E2E validation

Run 50+ tasks covering:
- [ ] DataAgent balance queries (various addresses)
- [ ] DataAgent object reads
- [ ] ResearchAgent web searches
- [ ] Failed verification → refund
- [ ] Emergency shutdown toggle
- [ ] Limit enforcement (max_tx, max_daily)

Check:
- [ ] All `JobPaid` events match expected amounts
- [ ] No `JobRefunded` for valid tasks
- [ ] Ledger contains full timeline
- [ ] Dashboard shows correct data

---

## Phase 4: Security review

```bash
# Move audit
sui move build --lint
# Check for: arbitrary transfers, missing caps, unchecked arithmetic

# Dependency audit
cd /Users/RoRo_HQ/Hermes/ovea-scout
npm audit
cargo audit  # if any Rust deps

# Penetration test (manual)
# - Attempt oversized payment
# - Attempt refund after pay
# - Attempt pay without verification
# - Attempt admin functions without cap
```

---

## Phase 5: Limited Mainnet

**⚠️ Human approval required before this phase.**

```bash
# 1. Create dedicated mainnet wallet (low balance)
sui keytool generate ed25519
# → store seed in secure vault, not .env.local

# 2. Fund with minimal SUI + USDC
# SUI: 1.0 (for gas sponsorship)
# USDC: 10.0 (for initial prize pool)

# 3. Publish
cd move/ovea_settlement
sui client publish --network mainnet --gas-budget 50000000
# → record MAINNET_PACKAGE_ID, ADMIN_CAP_ID, HUB_ID

# 4. Update env
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_PRIVATE_KEY=<base64 from vault>
SUI_MAX_TX_MIST=1000000
SUI_MAX_DAILY_MIST=5000000
SUI_EMERGENCY_SHUTDOWN=false

# 5. Deploy API behind HTTPS
# - Use reverse proxy (nginx/Caddy) with TLS
# - Rate limit: 100 req/min per IP
# - WAF rules for injection

# 6. Monitoring
# - Alert: emergency_shutdown=true
# - Alert: settlement failure rate > 1%
# - Alert: daily spend > 80% cap
# - Dashboard: Grafana/Prometheus or simple cron + webhook
```

---

## Rollback procedures

| Scenario | Action |
|----------|--------|
| Emergency shutdown triggered | `SUI_EMERGENCY_SHUTDOWN=false` + restart |
| Contract bug | Upgrade package (requires admin cap + 2/3 validators) |
| Wallet compromised | Rotate key, set max_tx=0, drain remaining |
| RPC failure | Failover to backup RPC (configure in env) |

---

## Post-deploy checklist

- [ ] Package ID recorded in `DEPLOYMENT.md`
- [ ] Admin cap stored in secure vault
- [ ] Monitoring alerts firing on test
- [ ] Emergency shutdown tested (env + contract)
- [ ] Rate limits configured
- [ ] TLS certificate valid
- [ ] Backup RPC tested
- [ ] Team knows rollback procedures