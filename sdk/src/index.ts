/**
 * Amora SDK - Stealth Addresses for Starknet
 *
 * This SDK implements ERC-5564/ERC-6538-style stealth addresses
 * adapted for Starknet's STARK curve and native account abstraction.
 *
 * @example
 * ```typescript
 * import { Amora, generateKeys, encodeMetaAddress, parseMetaAddress } from '@amora/sdk';
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
export { Amora, type AmoraConfig } from "./contracts";

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
