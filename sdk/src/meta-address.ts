/**
 * Meta-address encoding and parsing
 * Format: "st:starknet:<spending_pubkey>:<viewing_pubkey>"
 *
 * The meta-address is a string that encodes the recipient's public keys
 * and can be shared publicly for anyone to send stealth payments.
 */

import type { StealthKeys } from "./keys";

/**
 * Prefix for stealth addresses
 */
export const META_ADDRESS_PREFIX = "st";

/**
 * Chain identifier for Starknet
 */
export const CHAIN_ID = "starknet";

/**
 * A parsed meta-address containing the spending and viewing public keys
 */
export interface MetaAddress {
  chain: string;
  spendingPubKey: bigint;
  viewingPubKey: bigint;
}

/**
 * Encode a meta-address from StealthKeys
 * @param keys - The stealth keys containing spending and viewing keypairs
 * @returns The encoded meta-address string
 */
export function encodeMetaAddress(keys: StealthKeys): string {
  return encodeMetaAddressFromPubKeys(
    keys.spendingKey.publicKey,
    keys.viewingKey.publicKey
  );
}

/**
 * Encode a meta-address from public keys
 * @param spendingPubKey - The spending public key
 * @param viewingPubKey - The viewing public key
 * @returns The encoded meta-address string
 */
export function encodeMetaAddressFromPubKeys(
  spendingPubKey: bigint,
  viewingPubKey: bigint
): string {
  const spendingHex = "0x" + spendingPubKey.toString(16);
  const viewingHex = "0x" + viewingPubKey.toString(16);
  return `${META_ADDRESS_PREFIX}:${CHAIN_ID}:${spendingHex}:${viewingHex}`;
}

/**
 * Parse a meta-address string
 * @param metaAddress - The encoded meta-address string
 * @returns The parsed MetaAddress
 * @throws If the meta-address format is invalid
 */
export function parseMetaAddress(metaAddress: string): MetaAddress {
  const parts = metaAddress.split(":");

  if (parts.length !== 4) {
    throw new Error(
      `Invalid meta-address format: expected 4 parts, got ${parts.length}`
    );
  }

  const [prefix, chain, spendingStr, viewingStr] = parts;

  if (prefix !== META_ADDRESS_PREFIX) {
    throw new Error(
      `Invalid meta-address prefix: expected "${META_ADDRESS_PREFIX}", got "${prefix}"`
    );
  }

  if (chain !== CHAIN_ID) {
    throw new Error(
      `Invalid chain ID: expected "${CHAIN_ID}", got "${chain}"`
    );
  }

  const spendingPubKey = parseFelt(spendingStr, "spending public key");
  const viewingPubKey = parseFelt(viewingStr, "viewing public key");

  return {
    chain,
    spendingPubKey,
    viewingPubKey,
  };
}

/**
 * Parse a felt252 value from a hex string
 * @param value - The hex string (with or without 0x prefix)
 * @param fieldName - The field name for error messages
 * @returns The parsed bigint
 */
function parseFelt(value: string, fieldName: string): bigint {
  try {
    // Handle both "0x..." and raw hex formats
    const normalized = value.startsWith("0x") ? value : `0x${value}`;
    const result = BigInt(normalized);

    // Validate it's a valid felt252 (< 2^252)
    const MAX_FELT = 2n ** 252n;
    if (result >= MAX_FELT || result < 0n) {
      throw new Error(`${fieldName} is out of felt252 range`);
    }

    return result;
  } catch (e) {
    if (e instanceof Error && e.message.includes("out of felt252 range")) {
      throw e;
    }
    throw new Error(`Invalid ${fieldName}: cannot parse "${value}" as hex`);
  }
}

/**
 * Validate a meta-address string
 * @param metaAddress - The meta-address to validate
 * @returns true if valid, false otherwise
 */
export function isValidMetaAddress(metaAddress: string): boolean {
  try {
    parseMetaAddress(metaAddress);
    return true;
  } catch {
    return false;
  }
}
