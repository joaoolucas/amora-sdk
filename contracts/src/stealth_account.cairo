/// Stealth Account Contract
/// SNIP-6 compliant account using OpenZeppelin's AccountComponent
/// Supports counterfactual deployment for stealth addresses

#[starknet::contract(account)]
pub mod StealthAccount {
    use openzeppelin_account::AccountComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use amora::interface::IStealthAccount;

    component!(path: AccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // Account Mixin for full SNIP-6 compliance
    #[abi(embed_v0)]
    impl AccountMixinImpl = AccountComponent::AccountMixinImpl<ContractState>;
    impl AccountInternalImpl = AccountComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        account: AccountComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        AccountEvent: AccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    /// Constructor - initializes the account with the stealth public key
    /// This public key is derived from: P = K_spend + hash(shared_secret) * G
    /// The corresponding private key is: p = k_spend + hash(shared_secret)
    #[constructor]
    fn constructor(ref self: ContractState, public_key: felt252) {
        self.account.initializer(public_key);
    }

    #[abi(embed_v0)]
    impl StealthAccountImpl of IStealthAccount<ContractState> {
        /// Get the stealth public key associated with this account
        /// This is an alias for the OZ AccountComponent's get_public_key
        fn get_stealth_public_key(self: @ContractState) -> felt252 {
            self.account.get_public_key()
        }
    }
}
