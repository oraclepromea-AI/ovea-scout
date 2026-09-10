# Ovea Settlement — Deployment Record

## Devnet (active, verified)

- **Network**: Sui devnet (`https://fullnode.devnet.sui.io:443`)
- **PackageID**: `0xb3a70ec89685cd48db7b4c50ac76fa370a810908d89d0f907cb40243b2459d25`
- **Modules**: `settlement`
- **SettlementHub** (shared object): `0xe4115adc89683f6b2ba9a4e0d4c65c4d9a87ae569b675e935a11e583206e8ab1`
- **UpgradeCap**: `0xcacd5e35a04a5744778269fabc7bd6c7b6cab5b9b06bf453c864bbcba2036481`
- **Deployer / fee address**: `0xc91e209bd6e02236214bbc9de53745e4780d3b4786c92e7a2553e496f00a5c7b`

## Verified live transactions (devnet)

| Step | Tx Digest | Status | Detail |
|------|-----------|--------|--------|
| Publish | (see below) | Success | 10 SUI funded, ~0.02 SUI gas |
| create_job (escrow) | `GexFEmF1AaU1ZRTU54ourYUvawUMQrK4mNSndWXQhRzJ` | Success | 500000 MIST escrowed, 10% fee |
| JobPaid (atomic split) | `8HppvneG3xPb2KupmXb6ftFeFp5pGqhkChwbxHHWaTti` | Success | 450000 net → executor, 50000 fee → platform |

## Notes

- Deployed via `sui client test-publish --build-env devnet` (temporary); a permanent publish needs a devnet environment in Move.toml.
- Move.toml currently pins `rev = "testnet"` (matching the installed Sui CLI default); to deploy to devnet persistently, switch rev and add `[environment] devnet`.
- Devnet gas: faucet `https://faucet.devnet.sui.io/v2/gas` (route works; testnet `/v2/gas` was IP-throttled at time of writing).