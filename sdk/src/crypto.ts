/**
 * Cryptographic primitives for stealth addresses on STARK curve
 * Uses @scure/starknet for STARK curve operations and Poseidon hash
 */

import {
  CURVE,
  ProjectivePoint,
  utils,
  poseidonHashMany,
  getPublicKey,
} from "@scure/starknet";

// STARK curve field order
export const CURVE_ORDER = CURVE.n;

// STARK curve field prime (from the finite field)
const FIELD_PRIME = CURVE.Fp.ORDER;

// STARK curve parameters
const ALPHA = CURVE.a;
const BETA = CURVE.b;

/**
 * Scheme ID for STARK curve stealth addresses
 * "STARK" in ASCII bytes as a felt252
 */
export const SCHEME_ID_STARK = 0x535441524b;

/**
 * Convert a bigint to a hex string (without 0x prefix), padded to 32 bytes
 */
function bigintToHex(n: bigint): string {
  const hex = n.toString(16);
  // Pad to 64 characters (32 bytes) for private keys
  return hex.padStart(64, "0");
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalize a private key so that its public key has an even y-coordinate.
 * This is necessary for consistent point recovery from x-coordinates.
 * @param privateKey - The private key to normalize
 * @returns The normalized private key (same or negated)
 */
export function normalizePrivateKey(privateKey: bigint): bigint {
  const privateKeyHex = bigintToHex(privateKey);
  const point = ProjectivePoint.fromPrivateKey(privateKeyHex);

  // If y is odd, negate the private key
  // isOdd returns true for odd values (y % 2 === 1)
  if (point.y % 2n !== 0n) {
    // Negate: -k mod n
    return CURVE_ORDER - privateKey;
  }
  return privateKey;
}

/**
 * Generate a random private key on the STARK curve.
 * The key is normalized so that its public key has an even y-coordinate.
 */
export function generatePrivateKey(): bigint {
  const bytes = utils.randomPrivateKey();
  const rawKey = BigInt("0x" + bytesToHex(bytes));
  return normalizePrivateKey(rawKey);
}

/**
 * Derive the public key from a private key
 * Returns the x-coordinate of the point (Starknet's standard public key format)
 * @param privateKey - The private key as bigint
 * @returns The public key (x-coordinate) as bigint
 */
export function derivePublicKey(privateKey: bigint): bigint {
  // Convert bigint to hex string for the library
  const privateKeyHex = bigintToHex(privateKey);
  // getPublicKey with compressed=true returns prefix byte + x-coordinate (33 bytes)
  // We skip the first byte (prefix) to get just the x-coordinate
  const pubKeyBytes = getPublicKey(privateKeyHex, true);
  // Skip the first byte (compression prefix) to get just the x-coordinate
  const xCoordBytes = pubKeyBytes.slice(1);
  return BigInt("0x" + bytesToHex(xCoordBytes));
}

/**
 * Get the full point (x, y) from a private key
 * @param privateKey - The private key as bigint
 * @returns The point as { x: bigint, y: bigint }
 */
export function getPoint(privateKey: bigint): { x: bigint; y: bigint } {
  const privateKeyHex = bigintToHex(privateKey);
  const point = ProjectivePoint.fromPrivateKey(privateKeyHex);
  return { x: point.x, y: point.y };
}

/**
 * Multiply a point by a scalar (ECDH operation)
 * @param scalar - The scalar (private key)
 * @param pointX - The x-coordinate of the point (public key)
 * @returns The resulting point's x-coordinate
 */
export function scalarMultiply(scalar: bigint, pointX: bigint): bigint {
  // Recover the full point from x-coordinate
  const point = recoverPoint(pointX);
  // Multiply the point by the scalar
  const result = point.multiply(scalar);
  return result.x;
}

/**
 * Recover a point on the STARK curve from its x-coordinate
 * @param x - The x-coordinate
 * @returns The ProjectivePoint
 */
function recoverPoint(x: bigint): InstanceType<typeof ProjectivePoint> {
  // For STARK curve: y^2 = x^3 + alpha*x + beta

  // Compute y^2 = x^3 + alpha*x + beta using the finite field operations
  const x3 = CURVE.Fp.mul(CURVE.Fp.mul(x, x), x); // x * x * x
  const ax = CURVE.Fp.mul(ALPHA, x); // alpha * x
  const ySquared = CURVE.Fp.add(CURVE.Fp.add(x3, ax), BETA); // x^3 + alpha*x + beta

  // Compute y = sqrt(y^2) using the field's sqrt function
  const y = CURVE.Fp.sqrt!(ySquared);

  if (y === undefined) {
    throw new Error("Invalid point: x-coordinate not on curve");
  }

  // Use the even y-coordinate (standard convention)
  const finalY = y % 2n !== 0n ? CURVE.Fp.neg(y) : y;

  return new ProjectivePoint(x, finalY, 1n);
}

/**
 * Modular exponentiation: base^exp mod mod
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Add two points on the curve
 * P1 + P2 where P1 = k1*G and P2 = k2*G
 * For stealth addresses: stealthPubKey = spendingPubKey + hash(shared_secret)*G
 * @param point1X - x-coordinate of first point
 * @param point2X - x-coordinate of second point
 * @returns x-coordinate of the sum
 */
export function pointAdd(point1X: bigint, point2X: bigint): bigint {
  const p1 = recoverPoint(point1X);
  const p2 = recoverPoint(point2X);
  const result = p1.add(p2);
  return result.x;
}

/**
 * Multiply base point G by a scalar
 * @param scalar - The scalar to multiply by
 * @returns The x-coordinate of the resulting point
 */
export function scalarBaseMult(scalar: bigint): bigint {
  const point = ProjectivePoint.BASE.multiply(scalar);
  return point.x;
}

/**
 * Compute Poseidon hash of multiple field elements
 * @param inputs - Array of field elements as bigints
 * @returns The hash as bigint
 */
export function poseidonHash(...inputs: bigint[]): bigint {
  return poseidonHashMany(inputs);
}

/**
 * Compute the view tag from a shared secret
 * The view tag is the first byte of hash(shared_secret)
 * @param sharedSecret - The shared secret (x-coordinate)
 * @returns The view tag as a number (0-255)
 */
export function computeViewTag(sharedSecret: bigint): number {
  const hash = poseidonHash(sharedSecret);
  // Take the first byte (lowest 8 bits after proper truncation)
  return Number(hash & 0xffn);
}

/**
 * Compute the stealth private key
 * p_stealth = k_spend + hash(shared_secret) mod n
 * @param spendingPrivateKey - The recipient's spending private key
 * @param sharedSecret - The shared secret (x-coordinate)
 * @returns The stealth private key
 */
export function computeStealthPrivateKey(
  spendingPrivateKey: bigint,
  sharedSecret: bigint
): bigint {
  const hashValue = poseidonHash(sharedSecret);
  return (spendingPrivateKey + hashValue) % CURVE_ORDER;
}

/**
 * Compute the stealth public key
 * P_stealth = K_spend + hash(shared_secret)*G
 * @param spendingPubKey - The recipient's spending public key (x-coordinate)
 * @param sharedSecret - The shared secret (x-coordinate)
 * @returns The stealth public key (x-coordinate)
 */
export function computeStealthPublicKey(
  spendingPubKey: bigint,
  sharedSecret: bigint
): bigint {
  // Recover K_spend with even y (assumes normalized keypair)
  const spendingPoint = recoverPoint(spendingPubKey);

  // Compute hash(s) * G directly (preserving actual y-coordinate)
  const hashValue = poseidonHash(sharedSecret);
  const hashPoint = ProjectivePoint.BASE.multiply(hashValue);

  // Add the points
  const stealthPoint = spendingPoint.add(hashPoint);

  return stealthPoint.x;
}

/**
 * Perform ECDH to compute shared secret
 * shared_secret = private_key * public_key_point
 * @param privateKey - One party's private key
 * @param publicKey - Other party's public key (x-coordinate)
 * @returns The shared secret (x-coordinate of resulting point)
 */
export function ecdh(privateKey: bigint, publicKey: bigint): bigint {
  return scalarMultiply(privateKey, publicKey);
}
