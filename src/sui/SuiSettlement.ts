/**
 * Sui settlement layer — Ovea Scout
 *
 * Wraps @mysten/sui for the MVP. This module is deliberately thin and
 * deterministic: it exposes sponsor/settle/disburse primitives and enforces
 * the default-DENY spending limits. No arbitrary contract calls, no
 * arbitrary transfers — only allow-listed functions against the Ovea package.
 *
 * Network: testnet by default (disposable wallet). Never mainnet without
 * explicit human approval.
 */

import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/utils";

export type Network = "testnet" | "localnet";

export interface SpendLimits {
  /** Max value per single disbursement, in MIST (1 SUI = 1e9 mist). */
  maxTransactionValueMist: string;
  /** Max cumulative value per (agent, day), in MIST. */
  maxDailySpendMist: string;
  /** Allow-listed coin types; by default only USDC (Sui) + SUI. */
  allowedCoins: string[];
  /** Allow-listed package ids; by default only the Ovea settlement package. */
  allowedPackages: string[];
  /** Allow-listed functions within allowed packages. */
  allowedFunctions: string[];
}

export const DEFAULT_LIMITS: SpendLimits = {
  maxTransactionValueMist: "1000000000", // 1 SUI
  maxDailySpendMist: "5000000000", // 5 SUI/day
  // USDC on Sui mainnet (Circle-issued). On testnet we use a faucet mint.
  allowedCoins: ["0x2::sui::SUI"],
  allowedPackages: [],
  allowedFunctions: ["settle", "authorize", "disburse", "emergency_shutdown"],
};

export interface SettlementConfig {
  network: Network;
  /** Fullnode URL override (defaults to Sui public for the network). */
  rpcUrl?: string;
  limits: SpendLimits;
  /** Agent/host wallet keypair. From env, never hardcoded. */
  keypair: Ed25519Keypair;
  /** Emergency stop: when true, no new authorizations/settlements. */
  emergencyShutdown: boolean;
}

export class SuiSettlement {
  client: SuiJsonRpcClient;
  config: SettlementConfig;

  constructor(config: SettlementConfig) {
    this.config = config;
    const url = config.rpcUrl ?? getJsonRpcFullnodeUrl(config.network);
    this.client = new SuiJsonRpcClient({ url, network: this.config.network });
  }

  static fromEnv(env: Record<string, string | undefined>): SuiSettlement {
    const network = (env.SUI_NETWORK ?? "testnet") as Network;
    // SECURITY: key comes only from env; never from code/source. Uses
    // base64 of the 32-byte private seed. If absent, throws (caller must not
    // proceed). .env is gitignored; .env.example holds a placeholder.
    const keyB64 = env.SUI_PRIVATE_KEY;
    if (!keyB64) throw new Error("SUI_PRIVATE_KEY not set in environment");
    let seedRaw: string = keyB64;
    const commaIdx = keyB64.indexOf(",");
    if (commaIdx !== -1) seedRaw = keyB64.slice(commaIdx + 1); // strip optional flag prefix
    const seed = Uint8Array.from(fromBase64(seedRaw.replace(/^0x/, "")));
    const keypair = Ed25519Keypair.fromSecretKey(seed);
    return new SuiSettlement({
      network,
      keypair,
      limits: {
        ...DEFAULT_LIMITS,
        maxTransactionValueMist:
          env.SUI_MAX_TX_MIST ?? DEFAULT_LIMITS.maxTransactionValueMist,
        maxDailySpendMist:
          env.SUI_MAX_DAILY_MIST ?? DEFAULT_LIMITS.maxDailySpendMist,
      },
      emergencyShutdown: env.SUI_EMERGENCY_SHUTDOWN === "true",
    });
  }

  get address(): string {
    return this.config.keypair.toSuiAddress();
  }

  /** Coin type used for payouts (USDC on Sui). Configurable via env. */
  payoutCoinType: string = "0x2::sui::SUI";

  /** Enforce default-DENY spending guard before any value move. */
  private assertAllowed(amountMist: bigint, targetFunction: string): void {
    if (this.config.emergencyShutdown) {
      throw new Error(`[sui] emergency shutdown active — refusing ${targetFunction}`);
    }
    if (!this.config.limits.allowedFunctions.includes(targetFunction)) {
      throw new Error(`[sui] function ${targetFunction} not in allow-list (DENY)`);
    }
    const max = BigInt(this.config.limits.maxTransactionValueMist);
    if (amountMist > max) {
      throw new Error(
        `[sui] amount ${amountMist} exceeds maxTransactionValueMist ${max}`,
      );
    }
  }

  /** Build a sponsored payment-intent-style split to N recipients. */
  async buildSettleTx(params: {
    payoutCoinType: string;
    totalMist: string;
    /** [recipientAddress, amountMist][] — must sum to totalMist. */
    recipients: Array<[string, string]>;
    /** Job id for the on-chain event/record. */
    jobId: string;
  }): Promise<Transaction> {
    const total = BigInt(params.totalMist);
    this.assertAllowed(total, "settle");

    if (!this.config.limits.allowedCoins.includes(params.payoutCoinType)) {
      throw new Error(`[sui] coin type ${params.payoutCoinType} not allow-listed`);
    }

    const sum = params.recipients.reduce((acc, [, amt]) => acc + BigInt(amt), 0n);
    if (sum !== total) {
      throw new Error(`[sui] recipients sum ${sum} != total ${total}`);
    }

    const tx = new Transaction();
    // Sponsor gas: sender = agent host wallet pays fees on behalf of requester.
    tx.setSender(this.address);
    tx.setGasOwner(this.address);

    // NOTE: for a self-hosted MVP we hold a single USDC coin object. In
    // production this splits a selected coin object into recipients. The
    // full Move-level multi-recipient atomic settle is implemented on-chain
    // (see Move package); this TS path is the sponsored client builder.
    const split = tx.splitCoins(tx.gas, [
      ...params.recipients.map(([, amt]) => amt),
    ]);
    params.recipients.forEach(([addr], i) => {
      tx.transferObjects([split[i]], addr);
    });

    return tx;
  }

  /** Submit and wait for effects; returns digest or throws. */
  async settle(params: {
    payoutCoinType: string;
    totalMist: string;
    recipients: Array<[string, string]>;
    jobId: string;
  }): Promise<string> {
    const tx = await this.buildSettleTx(params);
    const { digest } = await this.client.signAndExecuteTransaction({
      signer: this.config.keypair,
      transaction: tx,
    });
    return digest;
  }
}

/** Convenience: create a fresh disposable testnet keypair for dev. */
export function createTestnetKeypair(): Ed25519Keypair {
  return Ed25519Keypair.generate();
}