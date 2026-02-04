# amora-sdk

[![npm version](https://img.shields.io/npm/v/amora-sdk.svg)](https://www.npmjs.com/package/amora-sdk)
[![npm downloads](https://img.shields.io/npm/dm/amora-sdk.svg)](https://www.npmjs.com/package/amora-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Stealth addresses SDK for Starknet. Send and receive private payments without revealing recipient identity.

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
- **Batch sends** - Send to multiple recipients in a single multicall
- **Payment links** - Shareable `amora://` URIs with recipient and payment info
- **Memo support** - Attach text messages to payments via felt252 encoding
- **Viewing keys** - Export watch-only keys for scanning without spending ability
- **Account abstraction** - SNIP-6 compliant smart contract wallets
- **TypeScript** - Full type definitions included

## Deployed Contracts

### Mainnet

```typescript
import { MAINNET_ADDRESSES } from 'amora-sdk';
// amoraRegistry: 0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d
// stealthAccountClassHash: 0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a
```

### Sepolia

```typescript
import { SEPOLIA_ADDRESSES } from 'amora-sdk';
// amoraRegistry: 0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2
// stealthAccountClassHash: 0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a
```

## API

### Amora Class

```typescript
new Amora({ provider, amoraAddress, accountClassHash })

amora.register(account, keys)              // Register meta-address
amora.getMetaAddress(address)              // Fetch meta-address
amora.generateStealthAddress(meta)         // Generate stealth address
amora.send(account, token, amount, stealth) // Send tokens
amora.batchSend(account, payments)         // Send to multiple recipients
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

### Payment Links

```typescript
generatePaymentLink({ metaAddress, tokenAddress?, amount?, memo? })
parsePaymentLink(link)          // Parse amora:// URI
isValidPaymentLink(link)        // Validate URI
```

### Memo Encoding

```typescript
encodeMemo(text)                // Encode UTF-8 string to felt252[]
decodeMemo(felts)               // Decode felt252[] back to string
```

### Viewing Keys

```typescript
exportViewingKey(keys)          // Export watch-only key string
importViewingKey(str)           // Import from string
scanWithViewingKey(announcements, viewingKey, classHash)
```

## Documentation

- [Getting Started](https://github.com/joaoolucas/amora-sdk/blob/main/docs/getting-started.md)
- [SDK Reference](https://github.com/joaoolucas/amora-sdk/blob/main/docs/sdk-reference.md)
- [Protocol](https://github.com/joaoolucas/amora-sdk/blob/main/docs/protocol.md)
- [Contracts](https://github.com/joaoolucas/amora-sdk/blob/main/docs/contracts.md)

## Links

- [GitHub](https://github.com/joaoolucas/amora-sdk)
- [Mainnet Contract](https://starkscan.co/contract/0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d)

## License

MIT
