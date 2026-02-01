/**
 * Key generation and management for stealth addresses
 */

import { generatePrivateKey, derivePublicKey } from "./crypto";

/**
 * A keypair consisting of a private key and its corresponding public key
 */
export interface KeyPair {
  privateKey: bigint;
  publicKey: bigint;
}

/**
 * Full stealth address keys containing both spending and viewing keypairs
 */
export interface StealthKeys {
  spendingKey: KeyPair;
  viewingKey: KeyPair;
}

/**
 * Generate a new random keypair
 * @returns A KeyPair with private and public keys
 */
export function generateKeyPair(): KeyPair {
  const privateKey = generatePrivateKey();
  const publicKey = derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Generate complete stealth address keys (spending + viewing)
 * @returns StealthKeys containing both keypairs
 */
export function generateKeys(): StealthKeys {
  return {
    spendingKey: generateKeyPair(),
    viewingKey: generateKeyPair(),
  };
}

/**
 * Derive a keypair from an existing private key
 * @param privateKey - The private key to derive from
 * @returns A KeyPair with the given private key and derived public key
 */
export function keyPairFromPrivateKey(privateKey: bigint): KeyPair {
  const publicKey = derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Create StealthKeys from existing private keys
 * @param spendingPrivateKey - The spending private key
 * @param viewingPrivateKey - The viewing private key
 * @returns Complete StealthKeys
 */
export function keysFromPrivateKeys(
  spendingPrivateKey: bigint,
  viewingPrivateKey: bigint
): StealthKeys {
  return {
    spendingKey: keyPairFromPrivateKey(spendingPrivateKey),
    viewingKey: keyPairFromPrivateKey(viewingPrivateKey),
  };
}
