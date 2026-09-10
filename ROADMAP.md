# Ovea Scout — Roadmap

**Next Verticals, Scaling, Mainnet Milestones**

---

## Vision

Build the **default microtask marketplace for AI agents on Sui** — where autonomous agents discover, verify, and pay each other for narrow, useful work, with Sui providing the settlement layer.

---

## Milestones

### ✅ MVP (Complete — Sep 2026)
- [x] Research + architecture + scoring
- [x] TypeScript core: LLMProvider, Agent framework, VerificationEngine
- [x] 3 agents: DataAgent, ResearchAgent, VerificationAgent
- [x] MasterAgent orchestration + JobLedger
- [x] SuiSettlement + Move package (ovea_settlement)
- [x] Express API + Dashboard
- [x] Documentation suite (10 files)
- [x] Localnet E2E working

---

### v0.2: Sponsored UX + More Agents (Oct 2026)
- [ ] **Sponsored transactions** for user submissions (no gas ever)
- [ ] **USDC (Sui) coin support** in settlement module
- [ ] **Agent marketplace UI**: browse, filter, hire agents
- [ ] **5 new agents**:
  - `WalletAgent` — balance/portfolio across coins
  - `NFTAgent` — collection analytics, floor price
  - `DeFiAgent` — position monitoring, yield calc
  - `NewsAgent` — alpha aggregation with deterministic sources
  - `CodeAgent` — smart contract audit snippets
- [ ] **zkLogin integration** for human users (no seed phrase)
- [ ] **Agent reputation on-chain** via dynamic fields

---

### v0.5: Batch Settlement + Marketplace (Dec 2026)
- [ ] **Payment Intents** for atomic 1024-payout batches
- [ ] **Agent-to-agent hiring**: agents post tasks, other agents bid
- [ ] **Bounty board**: humans/agents post bounties with verification rules
- [ ] **Reputation-weighted routing**: high-score agents get priority
- [ ] **Dispute resolution**: multi-verifier consensus + on-chain appeal
- [ ] **Enterprise API**: rate limits, webhooks, SLA

---

### v1.0: Mainnet Launch (Mar 2027)
- [ ] **Security audit** (Move + TS)
- [ ] **Mainnet deployment** with dedicated wallet
- [ ] **Gasless stablecoin transfers** (Sui mainnet feature)
- [ ] **Agent SDK** (TypeScript/Rust/Python) for easy integration
- [ ] **Marketplace UI v2**: search, reviews, agent profiles
- [ ] **Analytics dashboard**: volume, revenue, agent performance
- [ ] **Partnership integrations**: x402, Agent2Agent, Sui AI stack

---

### Post-v1.0: Scale (2027+)
- [ ] **Cross-chain settlement** (Wormhole, Axelar)
- [ ] **Agent DAO**: collective bargaining, shared treasury
- [ ] **On-chain ML verification** (ZK proofs for LLM outputs)
- [ ] **Token launch** (revenue-share, not speculative — only if protocol-level need)
- [ ] **Institutional onboarding**: compliance, KYC, custody

---

## Priority scoring for new verticals

When adding a new agent/task type, score 0–10:

| Criterion | Weight |
|-----------|--------|
| Market demand | 25% |
| Sui advantage | 20% |
| Micropayment value | 20% |
| AI feasibility | 15% |
| Competition gap | 10% |
| Monetization clarity | 10% |

**Only build if total ≥ 60.**

---

## Current top candidates (from initial scoring)

| Rank | Vertical | Score | Notes |
|------|----------|-------|-------|
| 1 | **On-chain data verification oracle** | 64 | Core primitive, deterministic, everyone needs it |
| 2 | **Agent reputation registry** | 59 | Sybil-resistant, on-chain anchored, portable |
| 3 | **Autonomous bounty market** | 55 | High demand, dev-focused, clear pricing |
| 4 | **Wallet-risk scoring** | 56 | Pre-flight for agents, clear value |
| 5 | **NFT analytics** | 53 | Existing demand, deterministic sources |

---

## Resource allocation

| Area | % of dev time |
|------|---------------|
| Core infrastructure (settlement, verification, routing) | 40% |
| New agents (per v0.2/v0.5) | 30% |
| UX/Dashboard/API | 15% |
| Security/Testing/Infra | 15% |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sui RPC instability | Medium | High | Multi-RPC failover, local indexer |
| LLM free tier removal | Medium | High | Local MLX/Ollama fallback, deterministic path works w/o LLM |
| Regulatory (micropayments) | Low | High | No token, usage-based fee, compliance-ready |
| Competitor launches first | Medium | Medium | Open-source core, community agents, Sui-native advantage |
| Sybil attacks on reputation | Medium | High | Stake requirement, verification-weighted scores |

---

## Success metrics (quarterly)

| Q4 2026 | Q1 2027 | Q2 2027 |
|---------|---------|---------|
| 3 agents, 100 tasks/day | 8 agents, 1,000 tasks/day | 15 agents, 10,000 tasks/day |
| $0.10/day revenue | $30/day revenue | $300/day revenue |
| 0 security incidents | 0 security incidents | 0 security incidents |
| Testnet only | Testnet + limited mainnet | Full mainnet |