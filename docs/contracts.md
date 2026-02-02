# Contracts

Reference documentation for Amora's Cairo smart contracts.

## Deployed Addresses

### Mainnet

| Contract | Address |
|----------|---------|
| Amora Registry | `0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d` |
| StealthAccount Class | `0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a` |

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| Amora Registry | `0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2` |
| StealthAccount Class | `0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a` |

---

## Amora Registry

The main contract that handles meta-address registration and payment announcements.

### Interface

```cairo
#[starknet::interface]
pub trait IAmora<TState> {
    /// Register spending and viewing public keys
    fn register_keys(ref self: TState, spending_pubkey: felt252, viewing_pubkey: felt252);

    /// Get registered meta-address for an account
    fn get_meta_address(self: @TState, registrant: ContractAddress) -> (felt252, felt252);

    /// Check if an account is registered
    fn is_registered(self: @TState, registrant: ContractAddress) -> bool;

    /// Publish a stealth payment announcement
    fn announce(
        ref self: TState,
        stealth_address: ContractAddress,
        ephemeral_pubkey: felt252,
        view_tag: u8,
        metadata: Array<felt252>
    );
}
```

### Functions

#### `register_keys`

Register your stealth public keys.

**Parameters:**
- `spending_pubkey`: Your spending public key (felt252)
- `viewing_pubkey`: Your viewing public key (felt252)

**Events emitted:**
- `MetaAddressRegistered`

**Example (using starkli):**

```bash
starkli invoke $AMORA_ADDRESS register_keys \
  0x123...abc \  # spending_pubkey
  0x456...def    # viewing_pubkey
```

---

#### `get_meta_address`

Fetch a registered meta-address.

**Parameters:**
- `registrant`: Address to look up

**Returns:**
- `(spending_pubkey, viewing_pubkey)` tuple, or `(0, 0)` if not registered

**Example:**

```bash
starkli call $AMORA_ADDRESS get_meta_address 0xYOUR_ADDRESS
```

---

#### `is_registered`

Check if an address has registered.

**Parameters:**
- `registrant`: Address to check

**Returns:**
- `true` if registered, `false` otherwise

---

#### `announce`

Publish a stealth payment announcement.

**Parameters:**
- `stealth_address`: The stealth address receiving funds
- `ephemeral_pubkey`: Ephemeral public key for shared secret computation
- `view_tag`: View tag for efficient scanning (0-255)
- `metadata`: Additional data (typically `[token_address, amount]`)

**Events emitted:**
- `Announcement`

**Example:**

```bash
starkli invoke $AMORA_ADDRESS announce \
  0xSTEALTH_ADDRESS \
  0xEPHEMERAL_PUBKEY \
  42 \                          # view_tag
  0xTOKEN_ADDRESS 1000000000000  # metadata
```

---

### Events

#### `MetaAddressRegistered`

Emitted when a user registers their meta-address.

```cairo
#[derive(Drop, starknet::Event)]
struct MetaAddressRegistered {
    #[key]
    registrant: ContractAddress,
    spending_pubkey: felt252,
    viewing_pubkey: felt252,
}
```

---

#### `Announcement`

Emitted when a payment is announced.

```cairo
#[derive(Drop, starknet::Event)]
struct Announcement {
    #[key]
    stealth_address: ContractAddress,
    caller: ContractAddress,
    ephemeral_pubkey: felt252,
    view_tag: u8,
    metadata: Span<felt252>,
}
```

---

## Stealth Account

SNIP-6 compliant smart contract wallet for stealth addresses.

### Features

- OpenZeppelin AccountComponent for SNIP-6 compliance
- Counterfactual deployment (deploy when withdrawing)
- Single-owner account controlled by stealth private key

### Interface

```cairo
#[starknet::interface]
pub trait IStealthAccount<TState> {
    /// Validate a transaction (SNIP-6)
    fn __validate__(ref self: TState, calls: Array<Call>) -> felt252;

    /// Execute a transaction (SNIP-6)
    fn __execute__(ref self: TState, calls: Array<Call>) -> Array<Span<felt252>>;

    /// Check if signature is valid (SNIP-6)
    fn is_valid_signature(
        self: @TState, hash: felt252, signature: Array<felt252>
    ) -> felt252;

    /// Validate account deployment
    fn __validate_deploy__(
        self: @TState,
        class_hash: felt252,
        contract_address_salt: felt252,
        public_key: felt252
    ) -> felt252;
}
```

### Constructor

```cairo
#[constructor]
fn constructor(ref self: ContractState, public_key: felt252)
```

**Parameters:**
- `public_key`: The stealth public key that controls this account

### Deployment

Stealth accounts use counterfactual deployment:

1. Compute the address before deployment using:
   - Class hash
   - Salt (stealth public key)
   - Constructor calldata (stealth public key)

2. Send funds to the computed address

3. Deploy when ready to withdraw (deployment fee paid from received funds)

---

## Direct Contract Interaction

### Using starkli

```bash
# Set contract address
export AMORA=0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d

# Register keys
starkli invoke $AMORA register_keys 0x123...abc 0x456...def

# Check registration
starkli call $AMORA is_registered 0xYOUR_ADDRESS

# Get meta-address
starkli call $AMORA get_meta_address 0xADDRESS

# Announce payment
starkli invoke $AMORA announce \
  0xSTEALTH_ADDR 0xEPH_KEY 42 0xTOKEN 1000000000000
```

### Using starknet.js

```typescript
import { Contract, Account, RpcProvider } from 'starknet';

const AMORA_ABI = [
  {
    name: 'register_keys',
    type: 'function',
    inputs: [
      { name: 'spending_pubkey', type: 'felt252' },
      { name: 'viewing_pubkey', type: 'felt252' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'get_meta_address',
    type: 'function',
    inputs: [{ name: 'registrant', type: 'ContractAddress' }],
    outputs: [{ type: '(felt252, felt252)' }],
    state_mutability: 'view',
  },
  {
    name: 'announce',
    type: 'function',
    inputs: [
      { name: 'stealth_address', type: 'ContractAddress' },
      { name: 'ephemeral_pubkey', type: 'felt252' },
      { name: 'view_tag', type: 'u8' },
      { name: 'metadata', type: 'Array<felt252>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
];

const provider = new RpcProvider({ nodeUrl: 'YOUR_RPC' });
const contract = new Contract(AMORA_ABI, AMORA_ADDRESS, provider);

// Read meta-address
const [spending, viewing] = await contract.get_meta_address(address);

// Register (requires account)
const account = new Account(provider, address, privateKey);
contract.connect(account);
await contract.register_keys(spendingPubKey, viewingPubKey);
```

---

## Building from Source

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) 2.9.2+
- [snforge](https://github.com/foundry-rs/starknet-foundry) 0.40.0+

### Build

```bash
cd contracts
scarb build
```

### Test

```bash
snforge test
```

### Artifacts

After building, find compiled contracts in:

```
target/dev/
├── amora_Amora.contract_class.json
├── amora_Amora.compiled_contract_class.json
├── amora_StealthAccount.contract_class.json
└── amora_StealthAccount.compiled_contract_class.json
```
