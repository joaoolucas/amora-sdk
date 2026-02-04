# SDK Reference

Complete API documentation for the Amora SDK.

## Installation

```bash
pnpm add amora-sdk starknet
```

## Exports

```typescript
import {
  // Main SDK class
  Amora,
  AmoraConfig,
  BatchPayment,
  BatchSendResult,

  // Key management
  generateKeys,
  generateKeyPair,
  keyPairFromPrivateKey,
  keysFromPrivateKeys,
  KeyPair,
  StealthKeys,

  // Meta-address
  encodeMetaAddress,
  encodeMetaAddressFromPubKeys,
  parseMetaAddress,
  isValidMetaAddress,
  META_ADDRESS_PREFIX,
  CHAIN_ID,
  MetaAddress,

  // Stealth operations
  generateStealthAddress,
  generateStealthAddressWithKey,
  computeStealthContractAddress,
  computeStealthPrivateKey,
  checkAnnouncementViewTag,
  verifyAndComputeStealthKey,
  scanAnnouncements,
  GenerateStealthAddressResult,
  Announcement,
  StealthPayment,

  // Cryptographic primitives
  SCHEME_ID_STARK,
  CURVE_ORDER,
  generatePrivateKey,
  derivePublicKey,
  ecdh,
  poseidonHash,
  computeViewTag,

  // Memo encoding
  encodeMemo,
  decodeMemo,

  // Payment links
  generatePaymentLink,
  parsePaymentLink,
  isValidPaymentLink,
  PaymentLinkParams,
  ParsedPaymentLink,

  // Viewing keys
  exportViewingKey,
  importViewingKey,
  isValidViewingKey,
  scanWithViewingKey,
  ExportedViewingKey,
  ViewingKeyMatch,

  // Contract addresses
  MAINNET_ADDRESSES,
  SEPOLIA_ADDRESSES,
} from 'amora-sdk';
```

---

## Amora Class

The main SDK class for interacting with stealth addresses.

### Constructor

```typescript
new Amora(config: AmoraConfig)
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `config.provider` | `Provider \| RpcProvider` | Starknet provider instance |
| `config.amoraAddress` | `string` | Amora registry contract address |
| `config.accountClassHash` | `string` | StealthAccount class hash |

**Example:**

```typescript
import { Amora, MAINNET_ADDRESSES } from 'amora-sdk';
import { RpcProvider } from 'starknet';

const amora = new Amora({
  provider: new RpcProvider({ nodeUrl: 'YOUR_RPC' }),
  amoraAddress: MAINNET_ADDRESSES.amoraRegistry,
  accountClassHash: MAINNET_ADDRESSES.stealthAccountClassHash,
});
```

### Methods

#### `register(account, keys)`

Register a meta-address on-chain.

```typescript
async register(account: Account, keys: StealthKeys): Promise<InvokeFunctionResponse>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `account` | `Account` | Starknet account to register from |
| `keys` | `StealthKeys` | Stealth keys to register |

**Returns:** Transaction response

---

#### `getMetaAddress(registrantAddress)`

Fetch a registered meta-address.

```typescript
async getMetaAddress(registrantAddress: string): Promise<MetaAddress | null>
```

**Returns:** Parsed meta-address or `null` if not registered

---

#### `isRegistered(registrantAddress)`

Check if an address is registered.

```typescript
async isRegistered(registrantAddress: string): Promise<boolean>
```

---

#### `generateStealthAddress(recipientMetaAddress)`

Generate a stealth address for a recipient.

```typescript
generateStealthAddress(recipientMetaAddress: string | MetaAddress): GenerateStealthAddressResult
```

**Returns:**

```typescript
interface GenerateStealthAddressResult {
  stealthAddress: string;      // The one-time stealth address
  ephemeralPubKey: bigint;     // Ephemeral public key for announcement
  viewTag: number;             // View tag for efficient scanning
  stealthPubKey: bigint;       // Stealth public key
}
```

---

#### `buildSendCalls(tokenAddress, amount, stealthResult, metadata?)`

Build transaction calls for sending tokens.

```typescript
buildSendCalls(
  tokenAddress: string,
  amount: bigint,
  stealthResult: GenerateStealthAddressResult,
  metadata?: bigint[]
): Call[]
```

**Returns:** Array of calls (transfer + announce)

---

#### `send(account, tokenAddress, amount, stealthResult, metadata?)`

Send tokens to a stealth address.

```typescript
async send(
  account: Account,
  tokenAddress: string,
  amount: bigint,
  stealthResult: GenerateStealthAddressResult,
  metadata?: bigint[]
): Promise<InvokeFunctionResponse>
```

---

#### `fetchAnnouncements(fromBlock, toBlock?)`

Fetch announcements from the blockchain.

```typescript
async fetchAnnouncements(
  fromBlock: number,
  toBlock?: number | 'latest'
): Promise<Announcement[]>
```

---

#### `scan(keys, fromBlock, toBlock?)`

Scan for payments addressed to you.

```typescript
async scan(
  keys: StealthKeys,
  fromBlock: number,
  toBlock?: number | 'latest'
): Promise<StealthPayment[]>
```

**Returns:**

```typescript
interface StealthPayment {
  stealthAddress: string;
  stealthPrivateKey: bigint;   // Key to spend funds
  ephemeralPubKey: bigint;
  viewTag: number;
  metadata: bigint[];
  blockNumber: number;
  transactionHash: string;
}
```

---

#### `deployAndWithdraw(stealthPrivateKey, destinationAddress, tokenAddress, amount)`

Deploy stealth account and withdraw funds.

```typescript
async deployAndWithdraw(
  stealthPrivateKey: bigint,
  destinationAddress: string,
  tokenAddress: string,
  amount: bigint | 'all'
): Promise<InvokeFunctionResponse>
```

---

#### `deployStealthAccount(privateKey, publicKey?)`

Deploy a stealth account.

```typescript
async deployStealthAccount(
  privateKey: bigint,
  publicKey?: bigint
): Promise<DeployContractResponse>
```

---

#### `buildBatchSendCalls(payments)`

Build calls for sending to multiple recipients in a single multicall.

```typescript
buildBatchSendCalls(payments: BatchPayment[]): {
  calls: Call[];
  stealthResults: GenerateStealthAddressResult[];
}
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `payments` | `BatchPayment[]` | Array of payment descriptions |

**Returns:** Object with flattened `calls` array and `stealthResults` for each payment

---

#### `batchSend(account, payments)`

Send to multiple recipients in a single Starknet multicall.

```typescript
async batchSend(
  account: Account,
  payments: BatchPayment[]
): Promise<BatchSendResult>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `account` | `Account` | Sender's Starknet account |
| `payments` | `BatchPayment[]` | Array of payment descriptions |

**Returns:**

```typescript
interface BatchSendResult {
  transactionResponse: InvokeFunctionResponse;
  stealthResults: GenerateStealthAddressResult[];
}
```

**Example:**

```typescript
const result = await amora.batchSend(account, [
  { metaAddress: meta1, tokenAddress: ETH, amount: 1000n },
  { metaAddress: meta2, tokenAddress: ETH, amount: 2000n },
]);
```

---

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `registryAddress` | `string` | Amora registry contract address |
| `stealthAccountClassHash` | `string` | StealthAccount class hash |

---

## Key Functions

### `generateKeys()`

Generate a new set of stealth keys.

```typescript
function generateKeys(): StealthKeys
```

**Returns:**

```typescript
interface StealthKeys {
  spendingKey: KeyPair;  // Controls funds
  viewingKey: KeyPair;   // Enables scanning
}

interface KeyPair {
  privateKey: bigint;
  publicKey: bigint;
}
```

---

### `keysFromPrivateKeys(spendingPrivate, viewingPrivate)`

Restore keys from private keys.

```typescript
function keysFromPrivateKeys(
  spendingPrivate: bigint,
  viewingPrivate: bigint
): StealthKeys
```

---

### `encodeMetaAddress(keys)`

Encode keys as a shareable meta-address string.

```typescript
function encodeMetaAddress(keys: StealthKeys): string
// → "st:starknet:0x123...abc:0x456...def"
```

---

### `parseMetaAddress(metaAddress)`

Parse a meta-address string.

```typescript
function parseMetaAddress(metaAddress: string): MetaAddress

interface MetaAddress {
  chain: string;          // "starknet"
  spendingPubKey: bigint;
  viewingPubKey: bigint;
}
```

---

### `isValidMetaAddress(metaAddress)`

Validate a meta-address string.

```typescript
function isValidMetaAddress(metaAddress: string): boolean
```

---

## Stealth Functions

### `generateStealthAddress(meta, accountClassHash)`

Low-level stealth address generation.

```typescript
function generateStealthAddress(
  meta: MetaAddress,
  accountClassHash: string
): GenerateStealthAddressResult
```

---

### `computeStealthPrivateKey(spendingPrivate, sharedSecret)`

Compute the stealth private key from a payment.

```typescript
function computeStealthPrivateKey(
  spendingPrivate: bigint,
  sharedSecret: bigint
): bigint
```

---

### `computeStealthContractAddress(stealthPubKey, accountClassHash)`

Compute the contract address for a stealth public key.

```typescript
function computeStealthContractAddress(
  stealthPubKey: bigint,
  accountClassHash: string
): string
```

---

### `scanAnnouncements(announcements, viewingKey, spendingPubKey, spendingPrivateKey, accountClassHash)`

Scan announcements for matching payments.

```typescript
function scanAnnouncements(
  announcements: Announcement[],
  viewingKey: bigint,
  spendingPubKey: bigint,
  spendingPrivateKey: bigint | null,
  accountClassHash: string
): StealthPayment[]
```

---

## Cryptographic Primitives

### `generatePrivateKey()`

Generate a random private key.

```typescript
function generatePrivateKey(): bigint
```

---

### `derivePublicKey(privateKey)`

Derive public key from private key.

```typescript
function derivePublicKey(privateKey: bigint): bigint
```

---

### `ecdh(privateKey, publicKey)`

Perform ECDH key exchange.

```typescript
function ecdh(privateKey: bigint, publicKey: bigint): bigint
```

---

### `poseidonHash(...inputs)`

Compute Poseidon hash.

```typescript
function poseidonHash(...inputs: bigint[]): bigint
```

---

### `computeViewTag(sharedSecret)`

Compute view tag from shared secret.

```typescript
function computeViewTag(sharedSecret: bigint): number
// Returns 0-255
```

---

## Memo Encoding

### `encodeMemo(memo)`

Encode a UTF-8 string into an array of felt252 values for the metadata field.

Each felt252 holds 31 bytes. The first felt is the byte length prefix.

```typescript
function encodeMemo(memo: string): bigint[]
```

**Example:**

```typescript
const felts = encodeMemo("Thanks for dinner!");
// Use with send:
await amora.send(account, token, amount, stealth, felts);
```

---

### `decodeMemo(felts)`

Decode felt252 array back into a UTF-8 string.

```typescript
function decodeMemo(felts: bigint[]): string
```

**Example:**

```typescript
// metadata[0]=token, metadata[1]=amount, rest=memo
const memoText = decodeMemo(payment.announcement.metadata.slice(2));
```

---

## Payment Links

### `generatePaymentLink(params)`

Generate a shareable `amora://` payment link URI.

```typescript
function generatePaymentLink(params: PaymentLinkParams): string
```

**Parameters:**

```typescript
interface PaymentLinkParams {
  metaAddress: string;       // Recipient's meta-address (required)
  tokenAddress?: string;     // Token contract address
  amount?: bigint;           // Payment amount
  memo?: string;             // Text memo
}
```

**Returns:** URI string like `amora://pay?meta=st:starknet:0x...:0x...&token=0x...&amount=1000000&memo=hello`

---

### `parsePaymentLink(link)`

Parse a payment link URI.

```typescript
function parsePaymentLink(link: string): ParsedPaymentLink
```

**Returns:**

```typescript
interface ParsedPaymentLink {
  metaAddress: MetaAddress;    // Parsed meta-address
  metaAddressRaw: string;      // Raw meta-address string
  tokenAddress?: string;
  amount?: bigint;
  memo?: string;
}
```

---

### `isValidPaymentLink(link)`

Check if a string is a valid payment link.

```typescript
function isValidPaymentLink(link: string): boolean
```

---

## Viewing Keys

### `exportViewingKey(keys)`

Export a watch-only viewing key from stealth keys.

```typescript
function exportViewingKey(keys: StealthKeys): string
// → "vk:starknet:0x<viewing_private_key>:0x<spending_public_key>"
```

---

### `importViewingKey(viewingKeyStr)`

Import a viewing key from its string representation.

```typescript
function importViewingKey(viewingKeyStr: string): ExportedViewingKey
```

**Returns:**

```typescript
interface ExportedViewingKey {
  chain: string;                // "starknet"
  viewingPrivateKey: bigint;    // Enables scanning
  spendingPubKey: bigint;       // Enables address verification (not spending)
}
```

---

### `isValidViewingKey(viewingKeyStr)`

Check if a string is a valid viewing key.

```typescript
function isValidViewingKey(viewingKeyStr: string): boolean
```

---

### `scanWithViewingKey(announcements, viewingKey, accountClassHash)`

Scan announcements using a viewing key (watch-only, cannot derive spending keys).

```typescript
function scanWithViewingKey(
  announcements: Announcement[],
  viewingKey: ExportedViewingKey,
  accountClassHash: string
): ViewingKeyMatch[]
```

**Returns:**

```typescript
interface ViewingKeyMatch {
  announcement: Announcement;
  sharedSecret: bigint;
  stealthPubKey: bigint;
}
```

**Example:**

```typescript
const vk = importViewingKey("vk:starknet:0x...:0x...");
const announcements = await amora.fetchAnnouncements(fromBlock);
const matches = scanWithViewingKey(announcements, vk, accountClassHash);
```

---

## Constants

### Contract Addresses

```typescript
const MAINNET_ADDRESSES = {
  amoraRegistry: '0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d',
  stealthAccountClassHash: '0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a',
};

const SEPOLIA_ADDRESSES = {
  amoraRegistry: '0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2',
  stealthAccountClassHash: '0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a',
};
```

### Cryptographic Constants

```typescript
const SCHEME_ID_STARK = 0x535441524bn;  // "STARK" in ASCII
const CURVE_ORDER = 0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2fn;
const META_ADDRESS_PREFIX = 'st';
const CHAIN_ID = 'starknet';
```

---

## Types

```typescript
interface AmoraConfig {
  provider: Provider | RpcProvider;
  amoraAddress: string;
  accountClassHash: string;
}

interface StealthKeys {
  spendingKey: KeyPair;
  viewingKey: KeyPair;
}

interface KeyPair {
  privateKey: bigint;
  publicKey: bigint;
}

interface MetaAddress {
  chain: string;
  spendingPubKey: bigint;
  viewingPubKey: bigint;
}

interface GenerateStealthAddressResult {
  stealthAddress: string;
  ephemeralPubKey: bigint;
  viewTag: number;
  stealthPubKey: bigint;
}

interface Announcement {
  stealthAddress: string;
  ephemeralPubKey: bigint;
  viewTag: number;
  metadata: bigint[];
  blockNumber: number;
  transactionHash: string;
}

interface StealthPayment extends Announcement {
  stealthPrivateKey: bigint;
}

interface BatchPayment {
  metaAddress: string | MetaAddress;
  tokenAddress: string;
  amount: bigint;
  metadata?: bigint[];
}

interface BatchSendResult {
  transactionResponse: InvokeFunctionResponse;
  stealthResults: GenerateStealthAddressResult[];
}

interface PaymentLinkParams {
  metaAddress: string;
  tokenAddress?: string;
  amount?: bigint;
  memo?: string;
}

interface ParsedPaymentLink {
  metaAddress: MetaAddress;
  metaAddressRaw: string;
  tokenAddress?: string;
  amount?: bigint;
  memo?: string;
}

interface ExportedViewingKey {
  chain: string;
  viewingPrivateKey: bigint;
  spendingPubKey: bigint;
}

interface ViewingKeyMatch {
  announcement: Announcement;
  sharedSecret: bigint;
  stealthPubKey: bigint;
}
```
