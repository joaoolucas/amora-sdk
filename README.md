# Amora: Stealth Addresses SDK & Registry for Starknet

Amora implements ERC-5564/ERC-6538-style stealth addresses adapted for Starknet's STARK curve and native account abstraction. Users register a meta-address once, then anyone can generate unique one-time stealth addresses without interaction.

## Features

- **Privacy-preserving payments**: Send tokens to stealth addresses that can only be identified by the recipient
- **STARK curve cryptography**: Native support for Starknet's STARK curve with Poseidon hashing
- **Account abstraction**: SNIP-6 compliant stealth accounts with counterfactual deployment
- **Efficient scanning**: View tags enable fast filtering of announcements
- **Token support**: ETH and ERC20 tokens

## Project Structure

```
amora/
├── contracts/                      # Cairo smart contracts
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── amora.cairo             # Combined registry + announcer
│   │   ├── stealth_account.cairo   # SNIP-6 stealth account (OZ-based)
│   │   └── interface.cairo         # Public interfaces
│   └── tests/
│
├── sdk/                            # TypeScript SDK
│   ├── src/
│   │   ├── index.ts
│   │   ├── keys.ts                 # Key generation
│   │   ├── meta-address.ts         # Encoding/parsing
│   │   ├── stealth.ts              # Address generation & scanning
│   │   ├── crypto.ts               # STARK curve ECDH
│   │   └── contracts.ts            # Contract wrappers
│   └── tests/
│
└── README.md
```

## Quick Start

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) (Cairo package manager)
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- [snforge](https://github.com/foundry-rs/starknet-foundry) (for testing)

### Installation

```bash
# Install SDK dependencies
pnpm install

# Build contracts
cd contracts && scarb build

# Run tests
snforge test           # Cairo tests
pnpm test             # TypeScript tests
```

### SDK Usage

```typescript
import { Amora, generateKeys, encodeMetaAddress, parseMetaAddress } from '@amora/sdk';

// Initialize SDK
const amora = new Amora({ provider, amoraAddress, accountClassHash });

// === RECIPIENT: One-time setup ===
const keys = generateKeys();
const metaAddress = encodeMetaAddress(keys);
await amora.register(account, keys);
// Share metaAddress: "st:starknet:0x123...abc:0x456...def"

// === SENDER: Send to stealth address ===
const recipientMeta = await amora.getMetaAddress(recipientAddress);
const { stealthAddress, ephemeralPubKey, viewTag } = amora.generateStealthAddress(recipientMeta);
await amora.send(account, ETH_ADDRESS, amount, { stealthAddress, ephemeralPubKey, viewTag });

// === RECIPIENT: Scan for payments ===
const payments = await amora.scan(keys, fromBlock);
for (const payment of payments) {
    // Deploy stealth account and withdraw
    await amora.deployAndWithdraw(payment.stealthPrivateKey, destinationAddress, tokenAddress, amount);
}
```

## Protocol Flow

```
1. REGISTRATION (one-time)
   Recipient generates spending + viewing keypairs
   Registers meta-address (K_spend, K_view) to Registry

2. SENDING (per payment)
   Sender:
   1. Fetches recipient's meta-address from Registry
   2. Generates ephemeral keypair (r, R)
   3. Computes shared secret: s = r × K_view
   4. Computes stealth pubkey: P = K_spend + hash(s)×G
   5. Derives stealth address from P
   6. Deposits tokens to stealth address
   7. Publishes announcement: (R, view_tag, metadata)

3. SCANNING (recipient)
   For each announcement with ephemeral pubkey R:
   1. Computes shared secret: s = k_view × R
   2. Quick filter: check view_tag matches hash(s)[0]
   3. Computes expected stealth address
   4. If match: computes spending key p = k_spend + hash(s)

4. WITHDRAWAL
   Recipient deploys stealth account (counterfactual)
   Signs transaction with stealth private key
   Withdraws funds to any address
```

## Cairo Contracts

### Amora Registry (`amora.cairo`)

Combined registry and announcer contract:

```cairo
#[starknet::interface]
pub trait IAmora<TState> {
    fn register_keys(ref self: TState, spending_pubkey: felt252, viewing_pubkey: felt252);
    fn get_meta_address(self: @TState, registrant: ContractAddress) -> (felt252, felt252);
    fn is_registered(self: @TState, registrant: ContractAddress) -> bool;
    fn announce(ref self: TState, stealth_address: ContractAddress,
                ephemeral_pubkey: felt252, view_tag: u8, metadata: Array<felt252>);
}
```

### Stealth Account (`stealth_account.cairo`)

SNIP-6 compliant account using OpenZeppelin AccountComponent:

```cairo
#[starknet::contract(account)]
pub mod StealthAccount {
    // Uses OpenZeppelin AccountComponent for SNIP-6 compliance
    // Constructor takes stealth public key
}
```

## SDK Exports

```typescript
export {
    Amora,                      // Main SDK class
    generateKeys,               // Generate spending + viewing keypairs
    encodeMetaAddress,          // Encode to "st:starknet:..." format
    parseMetaAddress,           // Parse from string
    generateStealthAddress,     // Compute stealth address for recipient
    computeStealthPrivateKey,   // Derive spending key for stealth address
    SCHEME_ID_STARK,           // Scheme identifier for STARK curve
};
```

## Cryptographic Details

- **Curve**: STARK curve (native to Starknet)
- **Hash function**: Poseidon (ZK-friendly)
- **Shared secret**: ECDH with x-coordinate output
- **View tag**: First byte of Poseidon hash of shared secret

## License

MIT
