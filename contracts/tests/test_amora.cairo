use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyTrait, EventSpyAssertionsTrait,
};
use starknet::ContractAddress;
use amora::interface::{IAmoraDispatcher, IAmoraDispatcherTrait};
use amora::amora::Amora;

fn deploy_amora() -> ContractAddress {
    let contract = declare("Amora").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![]).unwrap();
    contract_address
}

fn CALLER() -> ContractAddress {
    starknet::contract_address_const::<0x123>()
}

fn STEALTH_ADDRESS() -> ContractAddress {
    starknet::contract_address_const::<0x456>()
}

const SPENDING_PUBKEY: felt252 = 0xabc;
const VIEWING_PUBKEY: felt252 = 0xdef;
const EPHEMERAL_PUBKEY: felt252 = 0x789;
const VIEW_TAG: u8 = 42;

#[test]
fn test_register_keys() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.register_keys(SPENDING_PUBKEY, VIEWING_PUBKEY);
    stop_cheat_caller_address(contract_address);

    let (spending, viewing) = dispatcher.get_meta_address(CALLER());
    assert(spending == SPENDING_PUBKEY, 'Wrong spending pubkey');
    assert(viewing == VIEWING_PUBKEY, 'Wrong viewing pubkey');
    assert(dispatcher.is_registered(CALLER()), 'Should be registered');
}

#[test]
fn test_get_meta_address_unregistered() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    let (spending, viewing) = dispatcher.get_meta_address(CALLER());
    assert(spending == 0, 'Should be 0');
    assert(viewing == 0, 'Should be 0');
    assert(!dispatcher.is_registered(CALLER()), 'Should not be registered');
}

#[test]
fn test_update_keys() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.register_keys(SPENDING_PUBKEY, VIEWING_PUBKEY);

    let new_spending: felt252 = 0x111;
    let new_viewing: felt252 = 0x222;
    dispatcher.register_keys(new_spending, new_viewing);
    stop_cheat_caller_address(contract_address);

    let (spending, viewing) = dispatcher.get_meta_address(CALLER());
    assert(spending == new_spending, 'Should update spending');
    assert(viewing == new_viewing, 'Should update viewing');
}

#[test]
#[should_panic(expected: 'Invalid spending public key')]
fn test_register_zero_spending_key() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.register_keys(0, VIEWING_PUBKEY);
}

#[test]
#[should_panic(expected: 'Invalid viewing public key')]
fn test_register_zero_viewing_key() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.register_keys(SPENDING_PUBKEY, 0);
}

#[test]
fn test_announce() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    let mut spy = spy_events();

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.announce(STEALTH_ADDRESS(), EPHEMERAL_PUBKEY, VIEW_TAG, array![]);
    stop_cheat_caller_address(contract_address);

    spy
        .assert_emitted(
            @array![
                (
                    contract_address,
                    Amora::Event::Announcement(
                        Amora::Announcement {
                            stealth_address: STEALTH_ADDRESS(),
                            caller: CALLER(),
                            ephemeral_pubkey: EPHEMERAL_PUBKEY,
                            view_tag: VIEW_TAG,
                            metadata: array![].span(),
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_announce_with_metadata() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    let mut spy = spy_events();
    let metadata = array![0x1234, 0x5678]; // e.g., token address and amount

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.announce(STEALTH_ADDRESS(), EPHEMERAL_PUBKEY, VIEW_TAG, metadata.clone());
    stop_cheat_caller_address(contract_address);

    spy
        .assert_emitted(
            @array![
                (
                    contract_address,
                    Amora::Event::Announcement(
                        Amora::Announcement {
                            stealth_address: STEALTH_ADDRESS(),
                            caller: CALLER(),
                            ephemeral_pubkey: EPHEMERAL_PUBKEY,
                            view_tag: VIEW_TAG,
                            metadata: metadata.span(),
                        },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: 'Invalid stealth address')]
fn test_announce_zero_stealth_address() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.announce(starknet::contract_address_const::<0>(), EPHEMERAL_PUBKEY, VIEW_TAG, array![]);
}

#[test]
#[should_panic(expected: 'Invalid ephemeral public key')]
fn test_announce_zero_ephemeral_key() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.announce(STEALTH_ADDRESS(), 0, VIEW_TAG, array![]);
}

#[test]
fn test_register_keys_event() {
    let contract_address = deploy_amora();
    let dispatcher = IAmoraDispatcher { contract_address };

    let mut spy = spy_events();

    start_cheat_caller_address(contract_address, CALLER());
    dispatcher.register_keys(SPENDING_PUBKEY, VIEWING_PUBKEY);
    stop_cheat_caller_address(contract_address);

    spy
        .assert_emitted(
            @array![
                (
                    contract_address,
                    Amora::Event::MetaAddressRegistered(
                        Amora::MetaAddressRegistered {
                            registrant: CALLER(),
                            spending_pubkey: SPENDING_PUBKEY,
                            viewing_pubkey: VIEWING_PUBKEY,
                        },
                    ),
                ),
            ],
        );
}
