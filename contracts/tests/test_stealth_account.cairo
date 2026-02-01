use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use starknet::ContractAddress;
use amora::interface::{IStealthAccountDispatcher, IStealthAccountDispatcherTrait};

const PUBLIC_KEY: felt252 = 0x123456789abcdef;

fn deploy_stealth_account(public_key: felt252) -> ContractAddress {
    let contract = declare("StealthAccount").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![public_key]).unwrap();
    contract_address
}

#[test]
fn test_deploy_with_public_key() {
    let contract_address = deploy_stealth_account(PUBLIC_KEY);
    let dispatcher = IStealthAccountDispatcher { contract_address };

    let stored_key = dispatcher.get_stealth_public_key();
    assert(stored_key == PUBLIC_KEY, 'Wrong public key');
}

#[test]
fn test_different_public_keys() {
    let key1: felt252 = 0x111;
    let key2: felt252 = 0x222;

    let addr1 = deploy_stealth_account(key1);
    let addr2 = deploy_stealth_account(key2);

    let dispatcher1 = IStealthAccountDispatcher { contract_address: addr1 };
    let dispatcher2 = IStealthAccountDispatcher { contract_address: addr2 };

    assert(dispatcher1.get_stealth_public_key() == key1, 'Wrong key for account 1');
    assert(dispatcher2.get_stealth_public_key() == key2, 'Wrong key for account 2');
}
