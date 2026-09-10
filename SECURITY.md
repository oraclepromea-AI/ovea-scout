# Ovea Scout — Security

**Threat Model, Limits, Key Management, Emergency Operations**

---

## Threat model

| Asset | Threat | Mitigation |
|-------|--------|------------|
| Private keys (wallet) | Exfiltration via logs, code, commits | Env-only, base64, `.env.local` gitignored, never printed |
| Settlement wallet | Drain via compromised agent | Per-tx cap, daily cap, allow-list functions, emergency stop |
| LLM output | Hallucination used as ground truth | **Never trusted**; deterministic verification gate |
| RPC endpoint | MITM / data corruption | Re-query on verification; public endpoint for MVP |
| Agent code | Supply chain / malicious dependency | `package-lock.json` committed, minimal deps, no postinstall |
| Reputation | Sybil attack (1000 fake agents) | Stake required per identity; weight by verification rate |

---

## Key management

### Generation
```bash
# Sui settlement wallet (base64 seed)
node -e "const {Ed25519Keypair}=require('@mysten/sui/keypairs/ed25519'); const k=Ed25519Keypair.generate(); console.log(Buffer.from(k.keypair.secretKey).toString('base64'))"
```

### Storage
- `SUI_PRIVATE_KEY` in `.env.local` (gitignored)
- Base64-encoded 32-byte seed (with or without 0x prefix)
- Never logged, never printed, never committed

### Rotation
1. Generate new key
2. Update `.env.local`
3. Restart API server
4. Old key retired (no funds kept in dev wallet)

---

## Spending limits (Move-enforced)

| Limit | Default | Config |
|-------|---------|--------|
| Per-transaction max | 1,000,000 MIST (1 USDC@6dec) | `SUI_MAX_TX_MIST` |
| Daily cumulative per agent | 5,000,000 MIST | `SUI_MAX_DAILY_MIST` |
| Allowed coins | SUI only | `ALLOWED_COINS` (extend for USDC) |
| Allowed functions | create_job, pay, refund, toggle_shutdown, set_max_tx | `ALLOWED_FUNCTIONS` |

**Emergency shutdown:**
```bash
# Via env
SUI_EMERGENCY_SHUTDOWN=true

# Via contract (admin capability)
# sui client call --function toggle_shutdown ...
```

When `emergency_shutdown == true`, **no new jobs** can be created. Already-created jobs can still be paid/refunded.

---

## Settlement module security invariants

```move
// Only these entry points exist:
public entry fun create_job(...)
public entry fun pay(...)
public entry fun refund(...)

// Admin-only (require Admin capability):
public fun toggle_shutdown(hub: &mut SettlementHub, _admin: &Admin)
public fun set_max_tx(hub: &mut SettlementHub, _admin: &Admin, value: u64)
```

**No function** allows:
- Arbitrary coin transfer
- Arbitrary Move call
- Withdrawal to arbitrary address
- Bypassing caps

---

## Verification integrity

| Check | Implementation | Cannot be bypassed by |
|-------|----------------|----------------------|
| `onchain-match` | Re-query `SuiJsonRpcClient`, byte-equal JSON | LLM hallucination |
| `source-exists` | HTTP HEAD each URL, must return <500 | Fake citations |
| `consensus-2` | Two independent runs, canonical JSON equality | Single-run variance |

**Payment only released when ALL applicable checks pass.** If `VerificationEngine` returns `valid: false`, `refund()` is called automatically.

---

## Emergency operations

### Stop all settlements
```bash
# 1. Env flag (immediate, no deploy)
export SUI_EMERGENCY_SHUTDOWN=true
# Restart API

# 2. On-chain (permanent, requires admin cap)
sui client call --package <PKG> --module settlement --function toggle_shutdown ...
```

### Drain settlement wallet (if compromised)
```bash
# 1. Enable emergency shutdown
# 2. Use admin cap to set max_tx = 0
# 3. Transfer remaining coins via sui client (bypasses contract)
```

### Key compromise
1. Revoke old key (generate new)
2. Update `.env.local`
3. Rotate any platform fee address in contract (if needed)
4. Audit ledger for unauthorized `JobPaid` events

---

## Audit checklist (pre-mainnet)

- [ ] Move package audited (no arbitrary transfers, caps enforced)
- [ ] Testnet E2E: 100+ tasks, 0 unauthorized payouts
- [ ] Load test: 1000 req/min, no limit bypasses
- [ ] Key rotation drill completed
- [ ] Emergency shutdown tested (env + on-chain)
- [ ] `.env.local` verified excluded from all builds/artifacts
- [ ] Dependency audit: `npm audit`, `cargo audit` (Move deps)
- [ ] RPC endpoint: dedicated, authenticated (not public)
- [ ] Monitoring: alert on `emergency_shutdown`, failed settlements, limit hits