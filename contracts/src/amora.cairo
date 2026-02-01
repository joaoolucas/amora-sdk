/// Amora Registry and Announcer Contract
/// Combines meta-address storage and stealth payment announcements in a single contract

#[starknet::contract]
pub mod Amora {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::get_caller_address;
    use amora::interface::IAmora;

    /// Storage for meta-addresses
    /// Each registrant stores their spending and viewing public keys
    #[storage]
    struct Storage {
        /// Maps registrant address to spending public key
        spending_keys: Map<ContractAddress, felt252>,
        /// Maps registrant address to viewing public key
        viewing_keys: Map<ContractAddress, felt252>,
    }

    /// Events
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MetaAddressRegistered: MetaAddressRegistered,
        Announcement: Announcement,
    }

    /// Emitted when a user registers or updates their meta-address
    #[derive(Drop, starknet::Event)]
    pub struct MetaAddressRegistered {
        #[key]
        pub registrant: ContractAddress,
        pub spending_pubkey: felt252,
        pub viewing_pubkey: felt252,
    }

    /// Emitted when a sender announces a stealth payment
    /// Recipients scan these events to find payments addressed to them
    #[derive(Drop, starknet::Event)]
    pub struct Announcement {
        /// The stealth address receiving the payment
        #[key]
        pub stealth_address: ContractAddress,
        /// The caller who made the announcement (typically the sender)
        pub caller: ContractAddress,
        /// Ephemeral public key used to derive the stealth address
        pub ephemeral_pubkey: felt252,
        /// View tag for efficient scanning (first byte of hash(shared_secret))
        pub view_tag: u8,
        /// Optional metadata (e.g., token address and amount for ERC20 transfers)
        pub metadata: Span<felt252>,
    }

    /// Errors
    pub mod Errors {
        pub const INVALID_SPENDING_KEY: felt252 = 'Invalid spending public key';
        pub const INVALID_VIEWING_KEY: felt252 = 'Invalid viewing public key';
        pub const INVALID_STEALTH_ADDRESS: felt252 = 'Invalid stealth address';
        pub const INVALID_EPHEMERAL_KEY: felt252 = 'Invalid ephemeral public key';
    }

    #[abi(embed_v0)]
    impl AmoraImpl of IAmora<ContractState> {
        /// Register a meta-address for the caller
        /// Both keys must be non-zero valid public keys on the STARK curve
        fn register_keys(
            ref self: ContractState, spending_pubkey: felt252, viewing_pubkey: felt252,
        ) {
            // Validate inputs - keys must be non-zero
            assert(spending_pubkey != 0, Errors::INVALID_SPENDING_KEY);
            assert(viewing_pubkey != 0, Errors::INVALID_VIEWING_KEY);

            let caller = get_caller_address();

            // Store the meta-address
            self.spending_keys.write(caller, spending_pubkey);
            self.viewing_keys.write(caller, viewing_pubkey);

            // Emit registration event
            self.emit(MetaAddressRegistered { registrant: caller, spending_pubkey, viewing_pubkey });
        }

        /// Get the meta-address for a registrant
        /// Returns (0, 0) if the address has not registered
        fn get_meta_address(self: @ContractState, registrant: ContractAddress) -> (felt252, felt252) {
            let spending_pubkey = self.spending_keys.read(registrant);
            let viewing_pubkey = self.viewing_keys.read(registrant);
            (spending_pubkey, viewing_pubkey)
        }

        /// Check if an address has registered a meta-address
        fn is_registered(self: @ContractState, registrant: ContractAddress) -> bool {
            let spending_pubkey = self.spending_keys.read(registrant);
            spending_pubkey != 0
        }

        /// Announce a stealth address payment
        /// This should be called after transferring tokens to the stealth address
        fn announce(
            ref self: ContractState,
            stealth_address: ContractAddress,
            ephemeral_pubkey: felt252,
            view_tag: u8,
            metadata: Array<felt252>,
        ) {
            // Validate inputs
            assert(stealth_address.into() != 0_felt252, Errors::INVALID_STEALTH_ADDRESS);
            assert(ephemeral_pubkey != 0, Errors::INVALID_EPHEMERAL_KEY);

            let caller = get_caller_address();

            // Emit announcement event
            self.emit(Announcement {
                stealth_address,
                caller,
                ephemeral_pubkey,
                view_tag,
                metadata: metadata.span(),
            });
        }
    }
}
