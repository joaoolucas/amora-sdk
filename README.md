# Amora SDK

TypeScript SDK for stealth addresses on Starknet. Send and receive private payments without revealing recipient identity.

## Installation

```bash
pnpm add amora-sdk starknet
```

## Quick Start

```typescript
import { Amora, generateKeys, encodeMetaAddress, MAINNET_ADDRESSES } from 'amora-sdk';
import { RpcProvider, Account } from 'starknet';

// Initialize
const provider = new RpcProvider({ nodeUrl: 'YOUR_RPC_URL' });
const amora = new Amora({
  provider,
  amoraAddress: MAINNET_ADDRESSES.amoraRegistry,
  accountClassHash: MAINNET_ADDRESSES.stealthAccountClassHash,
});

// Generate stealth keys (recipient)
const keys = generateKeys();
const metaAddress = encodeMetaAddress(keys);
// Share: "st:starknet:0x123...abc:0x456...def"

// Send privately (sender)
const stealth = amora.generateStealthAddress(metaAddress);
await amora.send(account, ETH_ADDRESS, amount, stealth);

// Scan for payments (recipient)
const payments = await amora.scan(keys, fromBlock);
for (const payment of payments) {
  await amora.deployAndWithdraw(payment.stealthPrivateKey, destination, ETH_ADDRESS, 'all');
}
```

## Features

- **Private payments** - Send tokens without revealing recipient address on-chain
- **One-time addresses** - Each payment uses a unique stealth address
- **Efficient scanning** - View tags enable 256x faster payment detection
- **Account abstraction** - SNIP-6 compliant smart contract wallets
- **TypeScript** - Full type definitions included

## Deployed Contracts

### Mainnet

```typescript
import { MAINNET_ADDRESSES } from 'amora-sdk';

// MAINNET_ADDRESSES.amoraRegistry
// → 0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d

// MAINNET_ADDRESSES.stealthAccountClassHash
// → 0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a
```

### Sepolia Testnet

```typescript
import { SEPOLIA_ADDRESSES } from 'amora-sdk';

// SEPOLIA_ADDRESSES.amoraRegistry
// → 0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2

// SEPOLIA_ADDRESSES.stealthAccountClassHash
// → 0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a
```

## Usage

### Recipient Setup

```typescript
import { generateKeys, encodeMetaAddress } from 'amora-sdk';

// Generate keys
const keys = generateKeys();

// Store securely
console.log('Spending key:', keys.spendingKey.privateKey.toString(16));
console.log('Viewing key:', keys.viewingKey.privateKey.toString(16));

// Get shareable address
const metaAddress = encodeMetaAddress(keys);
// → "st:starknet:0x123...abc:0x456...def"

// Register on-chain
await amora.register(account, keys);
```

### Sending Tokens

```typescript
// Fetch or parse recipient's meta-address
const meta = await amora.getMetaAddress(recipientAddress);
// or: parseMetaAddress('st:starknet:...')

// Generate stealth address
const stealth = amora.generateStealthAddress(meta);

// Send (transfer + announce in one tx)
await amora.send(account, tokenAddress, amount, stealth);
```

### Receiving Tokens

```typescript
// Scan blockchain for payments
const payments = await amora.scan(keys, fromBlock);

// Withdraw each payment
for (const payment of payments) {
  await amora.deployAndWithdraw(
    payment.stealthPrivateKey,
    destinationAddress,
    tokenAddress,
    'all'
  );
}
```

### Key Management

```typescript
// Export for storage
const exported = {
  spending: keys.spendingKey.privateKey.toString(16),
  viewing: keys.viewingKey.privateKey.toString(16),
};

// Restore from storage
import { keysFromPrivateKeys } from 'amora-sdk';
const keys = keysFromPrivateKeys(
  BigInt('0x' + exported.spending),
  BigInt('0x' + exported.viewing)
);
```

## API Reference

### Main Class

```typescript
new Amora({ provider, amoraAddress, accountClassHash })

amora.register(account, keys)              // Register meta-address
amora.getMetaAddress(address)              // Fetch meta-address
amora.generateStealthAddress(meta)         // Generate stealth address
amora.send(account, token, amount, stealth) // Send tokens
amora.scan(keys, fromBlock)                // Scan for payments
amora.deployAndWithdraw(key, dest, token, amount) // Withdraw funds
```

### Key Functions

```typescript
generateKeys()                  // Generate new stealth keys
keysFromPrivateKeys(s, v)       // Restore from private keys
encodeMetaAddress(keys)         // Encode as string
parseMetaAddress(str)           // Parse from string
```

### Low-Level Functions

```typescript
generateStealthAddress(meta, classHash)
computeStealthPrivateKey(spendingKey, sharedSecret)
computeStealthContractAddress(pubKey, classHash)
scanAnnouncements(announcements, viewingKey, spendingPubKey, spendingKey, classHash)
```

## Documentation

Full documentation available at [/docs](./docs/README.md):

- [Getting Started](./docs/getting-started.md)
- [SDK Reference](./docs/sdk-reference.md)
- [Protocol](./docs/protocol.md)
- [Contracts](./docs/contracts.md)

## Development

```bash
# Install dependencies
pnpm install

# Build SDK
cd sdk && pnpm build

# Run tests
pnpm test

# Build contracts
cd contracts && scarb build

# Test contracts
snforge test
```

## Links

- [GitHub](https://github.com/joaoolucas/amora-sdk)
- [Mainnet Contract](https://starkscan.co/contract/0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d)
- [Sepolia Contract](https://sepolia.starkscan.co/contract/0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2)

## License

MIT
