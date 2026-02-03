# Getting Started

This guide will help you integrate Amora into your Starknet application.

## Installation

```bash
# Using pnpm (recommended)
pnpm add amora-sdk starknet

# Using npm
npm install amora-sdk starknet

# Using yarn
yarn add amora-sdk starknet
```

## Basic Setup

```typescript
import { Amora, MAINNET_ADDRESSES, SEPOLIA_ADDRESSES } from 'amora-sdk';
import { RpcProvider, Account } from 'starknet';

// Initialize provider
const provider = new RpcProvider({
  nodeUrl: 'https://starknet-mainnet.public.blastapi.io'
});

// Initialize Amora SDK
const amora = new Amora({
  provider,
  amoraAddress: MAINNET_ADDRESSES.amoraRegistry,
  accountClassHash: MAINNET_ADDRESSES.stealthAccountClassHash,
});
```

## Recipient Setup (One-Time)

Recipients need to generate stealth keys and register them on-chain.

### 1. Generate Keys

```typescript
import { generateKeys, encodeMetaAddress } from 'amora-sdk';

// Generate spending and viewing keypairs
const keys = generateKeys();

// Encode as shareable meta-address
const metaAddress = encodeMetaAddress(keys);
// → "st:starknet:0x123...abc:0x456...def"

// IMPORTANT: Store keys securely!
// - spendingKey.privateKey: Controls funds (NEVER share)
// - viewingKey.privateKey: Allows scanning (share with services)
console.log('Spending Private Key:', keys.spendingKey.privateKey.toString(16));
console.log('Viewing Private Key:', keys.viewingKey.privateKey.toString(16));
```

### 2. Register On-Chain

```typescript
import { Account } from 'starknet';

// Your Starknet account
const account = new Account(provider, accountAddress, privateKey);

// Register meta-address (one-time transaction)
const tx = await amora.register(account, keys);
console.log('Registration tx:', tx.transaction_hash);
```

### 3. Share Your Meta-Address

Share your meta-address publicly. Anyone can use it to send you private payments:

```
st:starknet:0x123...abc:0x456...def
```

## Sending Private Payments

Senders use the recipient's meta-address to generate a unique stealth address.

### 1. Get Recipient's Meta-Address

```typescript
// Option A: From on-chain registry
const meta = await amora.getMetaAddress(recipientAddress);

// Option B: Parse from string
import { parseMetaAddress } from 'amora-sdk';
const meta = parseMetaAddress('st:starknet:0x123...abc:0x456...def');
```

### 2. Generate Stealth Address

```typescript
const stealth = amora.generateStealthAddress(meta);

console.log('Stealth Address:', stealth.stealthAddress);
console.log('Ephemeral Key:', stealth.ephemeralPubKey);
console.log('View Tag:', stealth.viewTag);
```

### 3. Send Tokens

```typescript
const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
const amount = BigInt('1000000000000000'); // 0.001 ETH

// Single transaction: transfer + announce
const tx = await amora.send(account, ETH_ADDRESS, amount, stealth);
console.log('Send tx:', tx.transaction_hash);
```

## Receiving Payments

Recipients scan the blockchain for incoming payments.

### 1. Scan for Payments

```typescript
// Scan from a specific block
const fromBlock = 600000; // Start scanning from this block
const payments = await amora.scan(keys, fromBlock);

console.log(`Found ${payments.length} payments`);
for (const payment of payments) {
  console.log('- Address:', payment.stealthAddress);
  console.log('  Amount:', payment.metadata[1]); // If included in metadata
}
```

### 2. Withdraw Funds

```typescript
const destinationAddress = '0xYOUR_WALLET_ADDRESS';

for (const payment of payments) {
  // Deploy stealth account and withdraw
  const tx = await amora.deployAndWithdraw(
    payment.stealthPrivateKey,
    destinationAddress,
    ETH_ADDRESS,
    'all' // Withdraw entire balance
  );
  console.log('Withdraw tx:', tx.transaction_hash);
}
```

## Key Management

### Storing Keys

```typescript
// Export keys for storage
const exportedKeys = {
  spendingPrivateKey: keys.spendingKey.privateKey.toString(16),
  viewingPrivateKey: keys.viewingKey.privateKey.toString(16),
};

// Store securely (encrypted storage, hardware wallet, etc.)
```

### Restoring Keys

```typescript
import { keysFromPrivateKeys } from 'amora-sdk';

const keys = keysFromPrivateKeys(
  BigInt('0x' + exportedKeys.spendingPrivateKey),
  BigInt('0x' + exportedKeys.viewingPrivateKey)
);
```

### View-Only Access

Share viewing keys with services that need to monitor incoming payments:

```typescript
// Service can scan without spending ability
const viewingKey = keys.viewingKey.privateKey;
const spendingPubKey = keys.spendingKey.publicKey;

// Scanning with view-only access
import { scanAnnouncements } from 'amora-sdk';
const announcements = await amora.fetchAnnouncements(fromBlock);
const payments = scanAnnouncements(
  announcements,
  viewingKey,
  spendingPubKey,
  null, // No spending private key
  accountClassHash
);
```

## Error Handling

```typescript
try {
  const tx = await amora.send(account, tokenAddress, amount, stealth);
} catch (error) {
  if (error.message.includes('insufficient')) {
    console.error('Insufficient balance');
  } else if (error.message.includes('nonce')) {
    console.error('Nonce mismatch - retry transaction');
  } else {
    throw error;
  }
}
```

## Next Steps

- [SDK Reference](./sdk-reference.md) - Complete API documentation
- [Protocol](./protocol.md) - Understanding stealth addresses
- [Contracts](./contracts.md) - Direct contract interaction
