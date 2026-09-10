#[test_only]
module ovea_settlement::settlement_tests {
    use sui::test_scenario;
    use ovea_settlement::settlement;

    #[test]
    fun test_init_creates_admin_and_hub() {
        let scenario = test_scenario::begin(@0xDeployer);

        // First tx = package publish; runs init, creates Admin (to sender) + shared hub.
        test_scenario::next_tx(&mut scenario, @0xDeployer);

        let admin = test_scenario::take_from_address::<settlement::Admin>(&mut scenario, @0xDeployer);
        test_scenario::return_to_address(@0xDeployer, admin);
        let hub = test_scenario::take_shared::<settlement::SettlementHub>(&mut scenario);
        // read only — allow via borrowing
        let emergency = hub.emergency_shutdown;
        assert!(!emergency, 0);
        test_scenario::return_shared(hub);
        test_scenario::end(scenario);
    }
}