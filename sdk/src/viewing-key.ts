/**
 * Viewing key export/import for watch-only scanning
 *
 * Exports the viewing private key + spending public key so a watch-only
 * client can detect incoming payments without being able to spend them.
 *
 * Format: vk:starknet:0x<viewing_private_key>:0x<spending_public_key>
 */

import type { StealthKeys } from "./keys";
import type { Announcement } from "./stealth";
import { computeStealthContractAddress } from "./stealth";
import { ecdh, computeViewTag, computeStealthPublicKey } from "./crypto";

const VIEWING_KEY_PREFIX = "vk";
const VIEWING_KEY_CHAIN = "starknet";

/**
 * An exported viewing key containing the minimal info for watch-only scanning
 */
export interface ExportedViewingKey {
  /** Chain identifier */
  chain: string;
  /** The viewing private key (enables scanning) */
  viewingPrivateKey: bigint;
  /** The spending public key (enables address verification, but not spending) */
  spendingPubKey: bigint;
}

/**
 * A match found during viewing key scanning
 */
export interface ViewingKeyMatch {
  /** The matched announcement */
  announcement: Announcement;
  /** The shared secret derived from the ephemeral key */
  sharedSecret: bigint;
  /** The stealth public key for this payment */
  stealthPubKey: bigint;
}

/**
 * Export a viewing key from stealth keys
 *
 * @param keys - The full stealth keys
 * @returns The viewing key string in format "vk:starknet:0x<viewing_priv>:0x<spending_pub>"
 */
export function exportViewingKey(keys: StealthKeys): string {
  const viewingHex = "0x" + keys.viewingKey.privateKey.toString(16);
  const spendingHex = "0x" + keys.spendingKey.publicKey.toString(16);
  return `${VIEWING_KEY_PREFIX}:${VIEWING_KEY_CHAIN}:${viewingHex}:${spendingHex}`;
}

/**
 * Import a viewing key from its string representation
 *
 * @param viewingKeyStr - The viewing key string
 * @returns The parsed viewing key
 * @throws If the format is invalid
 */
export function importViewingKey(viewingKeyStr: string): ExportedViewingKey {
  const parts = viewingKeyStr.split(":");

  if (parts.length !== 4) {
    throw new Error(
      `Invalid viewing key format: expected 4 parts, got ${parts.length}`
    );
  }

  const [prefix, chain, viewingStr, spendingStr] = parts;

  if (prefix !== VIEWING_KEY_PREFIX) {
    throw new Error(
      `Invalid viewing key prefix: expected "${VIEWING_KEY_PREFIX}", got "${prefix}"`
    );
  }

  if (chain !== VIEWING_KEY_CHAIN) {
    throw new Error(
      `Invalid viewing key chain: expected "${VIEWING_KEY_CHAIN}", got "${chain}"`
    );
  }

  const viewingPrivateKey = BigInt(viewingStr);
  const spendingPubKey = BigInt(spendingStr);

  if (viewingPrivateKey <= 0n) {
    throw new Error("Invalid viewing key: viewing private key must be positive");
  }

  if (spendingPubKey <= 0n) {
    throw new Error("Invalid viewing key: spending public key must be positive");
  }

  return {
    chain,
    viewingPrivateKey,
    spendingPubKey,
  };
}

/**
 * Check if a string is a valid viewing key
 *
 * @param viewingKeyStr - The string to validate
 * @returns true if valid
 */
export function isValidViewingKey(viewingKeyStr: string): boolean {
  try {
    importViewingKey(viewingKeyStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan announcements using a viewing key (watch-only, cannot derive spending keys)
 *
 * Uses the same ECDH + view tag + stealth address verification as full scanning,
 * but omits stealth private key derivation since the spending private key is not available.
 *
 * @param announcements - Array of announcements to scan
 * @param viewingKey - The exported viewing key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns Array of matched announcements with shared secrets
 */
export function scanWithViewingKey(
  announcements: Announcement[],
  viewingKey: ExportedViewingKey,
  accountClassHash: string
): ViewingKeyMatch[] {
  const matches: ViewingKeyMatch[] = [];

  for (const announcement of announcements) {
    // 1. Compute shared secret: s = k_view × R
    const sharedSecret = ecdh(viewingKey.viewingPrivateKey, announcement.ephemeralPubKey);

    // 2. Check view tag
    const expectedViewTag = computeViewTag(sharedSecret);
    if (expectedViewTag !== announcement.viewTag) {
      continue;
    }

    // 3. Compute expected stealth public key: P = K_spend + hash(s) × G
    const stealthPubKey = computeStealthPublicKey(
      viewingKey.spendingPubKey,
      sharedSecret
    );

    // 4. Compute expected stealth address
    const expectedAddress = computeStealthContractAddress(
      stealthPubKey,
      accountClassHash
    );

    // 5. Verify address matches (normalize for comparison)
    const normalizedExpected = normalizeAddress(expectedAddress);
    const normalizedActual = normalizeAddress(announcement.stealthAddress);

    if (normalizedExpected !== normalizedActual) {
      continue;
    }

    matches.push({
      announcement,
      sharedSecret,
      stealthPubKey,
    });
  }

  return matches;
}

/**
 * Normalize a Starknet address for comparison
 */
function normalizeAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x0*/, "");
  return "0x" + hex;
}
