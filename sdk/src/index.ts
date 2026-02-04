/**
 * Amora SDK - Stealth Addresses for Starknet
 *
 * This SDK implements ERC-5564/ERC-6538-style stealth addresses
 * adapted for Starknet's STARK curve and native account abstraction.
 *
 * @example
 * ```typescript
 * import { Amora, generateKeys, encodeMetaAddress, parseMetaAddress } from 'amora-sdk';
 *
 * // Initialize SDK
 * const amora = new Amora({ provider, amoraAddress, accountClassHash });
 *
 * // Generate keys for a recipient
 * const keys = generateKeys();
 * const metaAddress = encodeMetaAddress(keys);
 * // Share metaAddress: "st:starknet:0x123...abc:0x456...def"
 *
 * // Register keys on-chain
 * await amora.register(account, keys);
 *
 * // Send to a stealth address
 * const meta = await amora.getMetaAddress(recipientAddress);
 * const stealth = amora.generateStealthAddress(meta);
 * await amora.send(account, ETH_ADDRESS, amount, stealth);
 *
 * // Scan for incoming payments
 * const payments = await amora.scan(keys, fromBlock);
 * ```
 *
 * @packageDocumentation
 */

// Main SDK class
export {
  Amora,
  type AmoraConfig,
  type BatchPayment,
  type BatchSendResult,
} from "./contracts";

// Key generation
export {
  generateKeys,
  generateKeyPair,
  keyPairFromPrivateKey,
  keysFromPrivateKeys,
  type KeyPair,
  type StealthKeys,
} from "./keys";

// Meta-address encoding/parsing
export {
  encodeMetaAddress,
  encodeMetaAddressFromPubKeys,
  parseMetaAddress,
  isValidMetaAddress,
  META_ADDRESS_PREFIX,
  CHAIN_ID,
  type MetaAddress,
} from "./meta-address";

// Stealth address operations
export {
  generateStealthAddress,
  generateStealthAddressWithKey,
  computeStealthContractAddress,
  computeStealthPrivateKey,
  checkAnnouncementViewTag,
  verifyAndComputeStealthKey,
  scanAnnouncements,
  type GenerateStealthAddressResult,
  type Announcement,
  type StealthPayment,
} from "./stealth";

// Low-level cryptographic primitives
export {
  SCHEME_ID_STARK,
  CURVE_ORDER,
  generatePrivateKey,
  derivePublicKey,
  ecdh,
  poseidonHash,
  computeViewTag,
} from "./crypto";

// Memo encoding/decoding
export { encodeMemo, decodeMemo } from "./memo";

// Payment links
export {
  generatePaymentLink,
  parsePaymentLink,
  isValidPaymentLink,
  type PaymentLinkParams,
  type ParsedPaymentLink,
} from "./payment-link";

// Viewing key export/import
export {
  exportViewingKey,
  importViewingKey,
  isValidViewingKey,
  scanWithViewingKey,
  type ExportedViewingKey,
  type ViewingKeyMatch,
} from "./viewing-key";

// Deployed contract addresses
export const MAINNET_ADDRESSES = {
  amoraRegistry: "0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d",
  stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a",
} as const;

export const SEPOLIA_ADDRESSES = {
  amoraRegistry: "0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2",
  stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a",
} as const;
