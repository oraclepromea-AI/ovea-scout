/**
 * Oracle — deterministic on-chain query facade
 *
 * Used by MasterAgent verification and the DataAgent. Keeps chain access in
 * one place and returns fresh state, so verification re-queries rather than
 * trusting a stored answer.
 */

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const SUI_COIN = "0x2::sui::SUI";

export class Oracle {
  constructor(private readonly client: SuiJsonRpcClient) {}

  async query(queryType: string, address: string): Promise<Record<string, unknown>> {
    switch (queryType) {
      case "balance": {
        const b = await this.client.getBalance({ owner: address, coinType: SUI_COIN });
        return {
          type: "balance",
          address,
          coinType: SUI_COIN,
          total: b.totalBalance,
          totalSuiDecimal: (BigInt(b.totalBalance) / 1000000000n).toString(),
        };
      }
      case "object": {
        const o = await this.client.getObject({
          id: address,
          options: { showContent: true, showOwner: true, showType: true },
        });
        if ("error" in o) return { type: "object", objectId: address, error: String(o.error) };
        return { type: "object", objectId: address, digest: o.data?.digest, owner: o.data?.owner, objType: o.data?.type };
      }
      case "transaction": {
        const t = await this.client.getTransactionBlock({ digest: address, options: { showEffects: true } });
        return { type: "transaction", digest: address, status: t.effects?.status };
      }
      default:
        throw new Error(`unknown oracle queryType ${queryType}`);
    }
  }
}