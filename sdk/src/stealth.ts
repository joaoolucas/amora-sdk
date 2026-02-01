/**
 * Stealth address generation and scanning
 *
 * This module implements the core stealth address protocol:
 * 1. Sender generates ephemeral keypair and computes stealth address
 * 2. Recipient scans announcements to find payments
 * 3. Recipient computes stealth private key to spend funds
 */

import { hash, ec } from "starknet";
import {
  generatePrivateKey,
  derivePublicKey,
  ecdh,
  computeViewTag,
  computeStealthPublicKey,
  computeStealthPrivateKey as computeStealthKey,
  poseidonHash,
} from "./crypto";
import type { MetaAddress } from "./meta-address";
import type { KeyPair } from "./keys";

/**
 * Result of generating a stealth address for a recipient
 */
export interface GenerateStealthAddressResult {
  /** The stealth address (contract address) */
  stealthAddress: string;
  /** The stealth public key (for verification) */
  stealthPubKey: bigint;
  /** The ephemeral public key to be published in announcement */
  ephemeralPubKey: bigint;
  /** The view tag for efficient scanning */
  viewTag: number;
}

/**
 * An announcement event parsed from the blockchain
 */
export interface Announcement {
  /** The stealth address that received the payment */
  stealthAddress: string;
  /** The ephemeral public key from the sender */
  ephemeralPubKey: bigint;
  /** The view tag for quick filtering */
  viewTag: number;
  /** Optional metadata (e.g., token address, amount) */
  metadata: bigint[];
  /** Block number of the event */
  blockNumber?: number;
  /** Transaction hash of the announcement */
  transactionHash?: string;
}

/**
 * A detected stealth payment (announcement that matches the recipient)
 */
export interface StealthPayment {
  /** The original announcement */
  announcement: Announcement;
  /** The shared secret used to derive the stealth address */
  sharedSecret: bigint;
  /** The stealth private key to spend the funds */
  stealthPrivateKey: bigint;
  /** The stealth public key (for verification) */
  stealthPubKey: bigint;
}

/**
 * Generate a stealth address for a recipient
 * @param metaAddress - The recipient's meta-address (parsed)
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns The stealth address data to be used for payment and announcement
 */
export function generateStealthAddress(
  metaAddress: MetaAddress,
  accountClassHash: string
): GenerateStealthAddressResult {
  // 1. Generate ephemeral keypair
  const ephemeralPrivateKey = generatePrivateKey();
  const ephemeralPubKey = derivePublicKey(ephemeralPrivateKey);

  // 2. Compute shared secret: s = r × K_view
  const sharedSecret = ecdh(ephemeralPrivateKey, metaAddress.viewingPubKey);

  // 3. Compute view tag for efficient scanning
  const viewTag = computeViewTag(sharedSecret);

  // 4. Compute stealth public key: P = K_spend + hash(s) × G
  const stealthPubKey = computeStealthPublicKey(
    metaAddress.spendingPubKey,
    sharedSecret
  );

  // 5. Compute stealth contract address
  const stealthAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );

  return {
    stealthAddress,
    stealthPubKey,
    ephemeralPubKey,
    viewTag,
  };
}

/**
 * Generate a stealth address using a specific ephemeral key (for testing)
 * @param metaAddress - The recipient's meta-address
 * @param ephemeralPrivateKey - The ephemeral private key to use
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns The stealth address data
 */
export function generateStealthAddressWithKey(
  metaAddress: MetaAddress,
  ephemeralPrivateKey: bigint,
  accountClassHash: string
): GenerateStealthAddressResult {
  const ephemeralPubKey = derivePublicKey(ephemeralPrivateKey);
  const sharedSecret = ecdh(ephemeralPrivateKey, metaAddress.viewingPubKey);
  const viewTag = computeViewTag(sharedSecret);
  const stealthPubKey = computeStealthPublicKey(
    metaAddress.spendingPubKey,
    sharedSecret
  );
  const stealthAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );

  return {
    stealthAddress,
    stealthPubKey,
    ephemeralPubKey,
    viewTag,
  };
}

/**
 * Compute the contract address for a stealth account
 * Uses Starknet's standard contract address computation
 * @param publicKey - The stealth public key (constructor arg)
 * @param classHash - The class hash of the stealth account contract
 * @param salt - Optional salt (defaults to the public key)
 * @returns The contract address as a hex string
 */
export function computeStealthContractAddress(
  publicKey: bigint,
  classHash: string,
  salt?: bigint
): string {
  // Use the public key as salt if not provided (common pattern for accounts)
  const actualSalt = salt ?? publicKey;

  // Constructor calldata is just the public key
  const constructorCalldata = [publicKey.toString()];

  // Compute the contract address using Starknet's formula:
  // address = pedersen(
  //   "STARKNET_CONTRACT_ADDRESS",
  //   deployer_address,
  //   salt,
  //   class_hash,
  //   pedersen(constructor_calldata)
  // )
  const address = hash.calculateContractAddressFromHash(
    actualSalt.toString(),
    classHash,
    constructorCalldata,
    0 // deployer_address = 0 for counterfactual deployment
  );

  return address;
}

/**
 * Check if an announcement matches the recipient's viewing key
 * Uses the view tag for quick filtering
 * @param announcement - The announcement to check
 * @param viewingPrivateKey - The recipient's viewing private key
 * @returns The shared secret if it matches, null otherwise
 */
export function checkAnnouncementViewTag(
  announcement: Announcement,
  viewingPrivateKey: bigint
): bigint | null {
  // Compute shared secret: s = k_view × R
  const sharedSecret = ecdh(viewingPrivateKey, announcement.ephemeralPubKey);

  // Compute expected view tag
  const expectedViewTag = computeViewTag(sharedSecret);

  // Quick filter using view tag
  if (expectedViewTag !== announcement.viewTag) {
    return null;
  }

  return sharedSecret;
}

/**
 * Verify an announcement matches a recipient and compute the stealth private key
 * @param announcement - The announcement to verify
 * @param viewingPrivateKey - The recipient's viewing private key
 * @param spendingPublicKey - The recipient's spending public key
 * @param spendingPrivateKey - The recipient's spending private key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns StealthPayment if the announcement matches, null otherwise
 */
export function verifyAndComputeStealthKey(
  announcement: Announcement,
  viewingPrivateKey: bigint,
  spendingPublicKey: bigint,
  spendingPrivateKey: bigint,
  accountClassHash: string
): StealthPayment | null {
  // First, check the view tag
  const sharedSecret = checkAnnouncementViewTag(announcement, viewingPrivateKey);
  if (sharedSecret === null) {
    return null;
  }

  // Compute expected stealth public key
  const stealthPubKey = computeStealthPublicKey(spendingPublicKey, sharedSecret);

  // Compute expected stealth address
  const expectedAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );

  // Verify the address matches
  if (
    normalizeAddress(expectedAddress) !==
    normalizeAddress(announcement.stealthAddress)
  ) {
    return null;
  }

  // Compute the stealth private key
  const stealthPrivateKey = computeStealthKey(spendingPrivateKey, sharedSecret);

  return {
    announcement,
    sharedSecret,
    stealthPrivateKey,
    stealthPubKey,
  };
}

/**
 * Scan multiple announcements to find payments for a recipient
 * @param announcements - Array of announcements to scan
 * @param viewingPrivateKey - The recipient's viewing private key
 * @param spendingPublicKey - The recipient's spending public key
 * @param spendingPrivateKey - The recipient's spending private key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns Array of matched stealth payments
 */
export function scanAnnouncements(
  announcements: Announcement[],
  viewingPrivateKey: bigint,
  spendingPublicKey: bigint,
  spendingPrivateKey: bigint,
  accountClassHash: string
): StealthPayment[] {
  const payments: StealthPayment[] = [];

  for (const announcement of announcements) {
    const payment = verifyAndComputeStealthKey(
      announcement,
      viewingPrivateKey,
      spendingPublicKey,
      spendingPrivateKey,
      accountClassHash
    );

    if (payment !== null) {
      payments.push(payment);
    }
  }

  return payments;
}

/**
 * Compute the stealth private key from spending private key and shared secret
 * This is the key needed to sign transactions from the stealth address
 * @param spendingPrivateKey - The recipient's spending private key
 * @param sharedSecret - The shared secret from the payment
 * @returns The stealth private key
 */
export function computeStealthPrivateKey(
  spendingPrivateKey: bigint,
  sharedSecret: bigint
): bigint {
  return computeStealthKey(spendingPrivateKey, sharedSecret);
}

/**
 * Normalize a Starknet address to lowercase without leading zeros
 * @param address - The address to normalize
 * @returns The normalized address
 */
function normalizeAddress(address: string): string {
  // Remove 0x prefix, convert to lowercase, remove leading zeros, add 0x back
  const hex = address.toLowerCase().replace(/^0x0*/, "");
  return "0x" + hex;
}
