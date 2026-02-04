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

## Batch Sending

Send to multiple recipients in a single transaction:

```typescript
import { encodeMemo } from 'amora-sdk';

const payments = [
  { metaAddress: meta1, tokenAddress: ETH_ADDRESS, amount: 1000000n },
  { metaAddress: meta2, tokenAddress: ETH_ADDRESS, amount: 2000000n },
  { metaAddress: meta3, tokenAddress: ETH_ADDRESS, amount: 500000n },
];

const result = await amora.batchSend(account, payments);
console.log('Batch tx:', result.transactionResponse.transaction_hash);
console.log('Recipients:', result.stealthResults.length);
```

You can also build the calls without executing to inspect or combine with other calls:

```typescript
const { calls, stealthResults } = amora.buildBatchSendCalls(payments);
// Combine with other calls or execute manually
await account.execute([...otherCalls, ...calls]);
```

## Payment Links

Generate shareable URIs that encode recipient info and optional payment details:

```typescript
import { generatePaymentLink, parsePaymentLink } from 'amora-sdk';

// Generate a link
const link = generatePaymentLink({
  metaAddress,
  tokenAddress: ETH_ADDRESS,
  amount: 1000000n,
  memo: 'Coffee payment',
});
// → "amora://pay?meta=st:starknet:0x...:0x...&token=0x...&amount=1000000&memo=Coffee%20payment"

// Parse a received link
const parsed = parsePaymentLink(link);
const stealth = amora.generateStealthAddress(parsed.metaAddress);
await amora.send(account, parsed.tokenAddress, parsed.amount, stealth);
```

## Memo Encoding

Attach text messages to payments via the metadata field:

```typescript
import { encodeMemo, decodeMemo } from 'amora-sdk';

// Encode a memo and send
const memo = encodeMemo("Thanks for dinner!");
const stealth = amora.generateStealthAddress(meta);
await amora.send(account, ETH_ADDRESS, amount, stealth, memo);

// Decode a memo from a received payment
// metadata[0] = token address, metadata[1] = amount, rest = memo felts
const memoText = decodeMemo(payment.announcement.metadata.slice(2));
console.log('Memo:', memoText);
```

## Viewing Keys

Export a watch-only key that allows scanning for payments without spending ability:

```typescript
import { exportViewingKey, importViewingKey, scanWithViewingKey } from 'amora-sdk';

// Export viewing key (share with monitoring services)
const vkString = exportViewingKey(keys);
// → "vk:starknet:0x<viewing_private>:0x<spending_pub>"

// Import and scan on another device/service
const vk = importViewingKey(vkString);
const announcements = await amora.fetchAnnouncements(fromBlock);
const matches = scanWithViewingKey(
  announcements,
  vk,
  MAINNET_ADDRESSES.stealthAccountClassHash
);

for (const match of matches) {
  console.log('Payment to:', match.announcement.stealthAddress);
  // Note: cannot derive spending key — watch-only
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

Export and share viewing keys with services that need to monitor incoming payments:

```typescript
import { exportViewingKey, importViewingKey, scanWithViewingKey } from 'amora-sdk';

// Export a viewing key string (safe to share with monitoring services)
const vkString = exportViewingKey(keys);

// On the monitoring service: import and scan
const vk = importViewingKey(vkString);
const announcements = await amora.fetchAnnouncements(fromBlock);
const matches = scanWithViewingKey(announcements, vk, accountClassHash);
// matches contain stealth addresses and shared secrets, but no spending keys
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
