/// Ovea Settlement — atomic micropayment + reputation module.
///
/// Security-first (default-DENY, brief §8):
///   - spending caps (max_transaction_value)
///   - emergency_shutdown halts all new jobs
///   - allow-listed payout coin (SUI for MVP; USDC via generic later)
///   - admin capability required for privileged calls
///   - no arbitrary token transfers, no arbitrary contract execution
module ovea::settlement {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::object::{Self, UID};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::string::{Self, String};

    // ===== Admin / hub =====

    /// Platform admin capability (transferred to deployer at init).
    public struct Admin has key, store { id: UID }

    /// Shared registry enforcing limits + emergency stop.
    public struct SettlementHub has key, store {
        id: UID,
        emergency_shutdown: bool,
        max_transaction_value: u64,
        total_disbursed: u64,
    }

    /// Job: escrowed payout awaiting verification.
    public struct Job has key {
        id: UID,
        requester: address,
        executor: address,
        job_id: String,
        amount: u64,
        platform_fee: u64,
        balance: Balance<SUI>,
        status: u8, // 0 = open, 1 = paid, 2 = refunded
    }

    // ===== Events =====
    public struct JobCreated has copy, drop { job_id: String, executor: address, amount: u64 }
    public struct JobPaid has copy, drop { job_id: String, net: u64, fee: u64 }
    public struct JobRefunded has copy, drop { job_id: String, amount: u64 }

    // ===== Errors (abort codes) =====
    /// System is in emergency shutdown — refusing new jobs.
    const EShutdown: u64 = 1;
    /// Value exceeds configured per-transaction cap.
    const ELimit: u64 = 2;
    /// Fee exceeds value.
    const EFeeLimit: u64 = 3;
    /// Job already finalized (paid or refunded).
    const EAlreadyFinalized: u64 = 4;
    /// Value cannot be zero.
    const EZeroValue: u64 = 5;

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let admin = Admin { id: object::new(ctx) };
        transfer::transfer(admin, tx_context::sender(ctx));
        let hub = SettlementHub {
            id: object::new(ctx),
            emergency_shutdown: false,
            max_transaction_value: 1_000_000, // 1 USDC@6dec — raise later
            total_disbursed: 0,
        };
        transfer::share_object(hub);
    }

    // ===== Authorization helpers =====

    fun assert_not_shutdown(hub: &SettlementHub) {
        assert!(!hub.emergency_shutdown, EShutdown);
    }

    // ===== Core: escrow + atomic payout =====

    /// Emergency stop: halts new job creation (not already-fledgling payouts).
    public fun toggle_shutdown(hub: &mut SettlementHub, _admin: &Admin) {
        hub.emergency_shutdown = !hub.emergency_shutdown;
    }

    public fun set_max_tx(hub: &mut SettlementHub, _admin: &Admin, value: u64) {
        hub.max_transaction_value = value;
    }

    // ===== Core: escrow + atomic payout =====

    /// Requester escrows `value` into a Job. Executor only paid later on verify.
    public fun create_job(
        hub: &SettlementHub,
        requester: address,
        executor: address,
        job_id: String,
        value: u64,
        fee: u64,
        coin: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert_not_shutdown(hub);
        assert!(value > 0, EZeroValue);
        assert!(value <= hub.max_transaction_value, ELimit);
        assert!(fee <= value, EFeeLimit);

        let mut bal = coin::into_balance(coin);
        // Hold exactly `value` in the escrow; refund any excess to requester.
        let escrow = balance::split(&mut bal, value);
        let change = coin::from_balance(bal, ctx);
        transfer::public_transfer(change, tx_context::sender(ctx));

        let job = Job {
            id: object::new(ctx),
            requester,
            executor,
            job_id,
            amount: value,
            platform_fee: fee,
            balance: escrow,
            status: 0,
        };
        transfer::transfer(job, requester);
        event::emit(JobCreated { job_id, executor, amount: value });
    }

    /// Deterministic, atomic settlement after verification success.
    /// Splits value between the specialist and the platform fee address.
    public fun pay(
        job: Job,
        _digest_ref: String,
        hub: &mut SettlementHub,
        platform_fee_addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(job.status == 0, EAlreadyFinalized);
        let Job { id, requester: _, executor, job_id, amount, platform_fee, mut balance, status: _ } = job;
        let fee_coin = coin::take(&mut balance, platform_fee, ctx);
        let net_coin = coin::take(&mut balance, amount - platform_fee, ctx);
        transfer::public_transfer(fee_coin, platform_fee_addr);
        transfer::public_transfer(net_coin, executor);
        balance::destroy_zero(balance);
        hub.total_disbursed = hub.total_disbursed + amount;
        object::delete(id);
        event::emit(JobPaid { job_id, net: amount - platform_fee, fee: platform_fee });
    }

    /// Refund the requester when verification fails / is contested.
    public fun refund(job: Job, _digest_ref: String, _hub: &mut SettlementHub, ctx: &mut TxContext) {
        assert!(job.status == 0, EAlreadyFinalized);
        let Job { id, requester, executor: _, job_id, amount, platform_fee: _, mut balance, status: _ } = job;
        let c = coin::take(&mut balance, amount, ctx);
        transfer::public_transfer(c, requester);
        balance::destroy_zero(balance);
        object::delete(id);
        event::emit(JobRefunded { job_id, amount });
    }
}