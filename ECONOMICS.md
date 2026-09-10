# Ovea Scout — Economics

**Unit Economics, Pricing, Fee Model, Margin Analysis**

---

## Pricing model (usage-based preferred)

| Service | Price (USDC) | Unit |
|---------|-------------|------|
| DataAgent (on-chain query) | $0.005 | per query |
| ResearchAgent (web research) | $0.020 | per task |
| VerificationAgent (gate) | $0.001 | per verify |

---

## Unit economics per microtask

| Cost item | Amount | Notes |
|-----------|--------|-------|
| LLM inference | $0.0000 | OmniRoute free models |
| RPC call | $0.0001 | Public endpoint (free) |
| Sui gas (testnet) | $0.0000 | Sponsored transactions |
| Sui gas (mainnet) | $0.0010 | Gasless stablecoin transfer |
| Sui storage (refundable) | $0.0001 | Storage deposit reclaimed |
| Verification | $0.0000 | Re-query + HTTP HEAD |
| **Total cost** | **$0.0002–$0.0012** | Per completed task |
| **Revenue (10% fee)** | **$0.0005–$0.0020** | Per completed task |
| **Net margin** | **$0.0003–$0.0008** | Positive at any volume |

---

## Revenue projections

### Low volume (100 tasks/day)
| Metric | Value |
|--------|-------|
| Tasks completed | 100 |
| Average task price | $0.01 |
| Platform fee (10%) | $0.001/task |
| **Daily gross** | **$0.10** |
| Daily cost | $0.001 |
| **Daily net** | **$0.099** |
| Monthly net | **$2.97** |

### Medium volume (1,000 tasks/day)
| Metric | Value |
|--------|-------|
| Tasks completed | 1,000 |
| Average task price | $0.01 |
| Platform fee (10%) | $0.001/task |
| **Daily gross** | **$1.00** |
| Daily cost | $0.01 |
| **Daily net** | **$0.99** |
| Monthly net | **$29.70** |

### High volume (10,000 tasks/day)
| Metric | Value |
|--------|-------|
| Tasks completed | 10,000 |
| Average task price | $0.01 |
| Platform fee (10%) | $0.001/task |
| **Daily gross** | **$10.00** |
| Daily cost | $0.10 |
| **Daily net** | **$9.90** |
| Monthly net | **$297.00** |

---

## Revenue share model

```
Task price: $0.01
├── Specialist agent: $0.008 (80%)
├── Verification agent: $0.001 (10%)
└── Platform fee: $0.001 (10%)
```

**Total platform revenue = 10% of all successful task settlements.**

---

## Break-even analysis

| Fixed costs (monthly) | Amount |
|-----------------------|--------|
| Hosting (Mac/cheap VPS) | $0.00 |
| RPC endpoint | $0.00 |
| LLM inference | $0.00 |
| Sui gas | $0.00 |
| **Total fixed** | **$0.00** |

**Break-even: $0.00 (always profitable at any volume)**

---

## Tokenomics (future)

MVP uses existing assets (SUI/USDC). If token launch needed later:
- **No speculative token** (brief §15)
- **Revenue-share token** tied to platform fees
- **Utility token** for agent staking + reputation weight
- **Governance token** for fee parameter updates

---

## Sui advantage vs. other chains

| Chain | Gas per tx | Finality | USDC support | Gasless |
|-------|-----------|----------|--------------|---------|
| Sui | $0.001 | 390ms | Yes | Yes |
| Base | $0.001 | 2s | Yes | Yes |
| Solana | $0.00025 | 400ms | Yes | No |
| Ethereum | $1–100 | 12min | Yes | No |
| Polygon | $0.01 | 2s | Yes | No |

**Sui wins on finality + gasless stablecoin transfer for micropayments.**

---

## Growth strategy

1. **MVP**: 3 agents, 100 tasks/day, $0.10/day revenue
2. **v0.2**: Add 5 more agents, sponsored txns, $1/day
3. **v0.5**: Agent marketplace UI, batch settlements, $10/day
4. **v1.0**: Mainnet, enterprise API, 10K tasks/day, $300/month
5. **Scale**: Agent-to-agent commerce, bounties, data services, $1K+/month

---

## ROI

| Milestone | Revenue | Cost | Net | Time |
|-----------|---------|------|-----|------|
| MVP launch | $3.00 | $0.00 | $3.00 | 1 month |
| v0.2 (5 agents) | $30.00 | $0.00 | $30.00 | 2 months |
| v0.5 (marketplace) | $297.00 | $0.00 | $297.00 | 6 months |
| v1.0 (mainnet) | $900.00 | $0.00 | $900.00 | 12 months |

**Payback: Month 1 (immediate profit at any volume)**