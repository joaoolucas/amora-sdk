use starknet::ContractAddress;

/// Interface for the Amora registry and announcer contract
#[starknet::interface]
pub trait IAmora<TState> {
    /// Register a meta-address (spending + viewing public keys) for the caller
    /// The public keys are compressed points on the STARK curve (x-coordinate only)
    fn register_keys(ref self: TState, spending_pubkey: felt252, viewing_pubkey: felt252);

    /// Get the meta-address for a registrant
    /// Returns (spending_pubkey, viewing_pubkey), or (0, 0) if not registered
    fn get_meta_address(self: @TState, registrant: ContractAddress) -> (felt252, felt252);

    /// Check if an address has registered a meta-address
    fn is_registered(self: @TState, registrant: ContractAddress) -> bool;

    /// Announce a stealth address payment
    /// Called by the sender after transferring funds to the stealth address
    /// - stealth_address: The generated stealth address receiving the payment
    /// - ephemeral_pubkey: The ephemeral public key (R) used to derive the stealth address
    /// - view_tag: First byte of hash(shared_secret) for efficient scanning
    /// - metadata: Optional data (e.g., token address, amount for ERC20)
    fn announce(
        ref self: TState,
        stealth_address: ContractAddress,
        ephemeral_pubkey: felt252,
        view_tag: u8,
        metadata: Array<felt252>,
    );
}

/// Interface for the stealth account contract
/// Implements SNIP-6 (Account Abstraction) via OpenZeppelin's AccountComponent
#[starknet::interface]
pub trait IStealthAccount<TState> {
    /// Get the stealth public key associated with this account
    fn get_stealth_public_key(self: @TState) -> felt252;
}
