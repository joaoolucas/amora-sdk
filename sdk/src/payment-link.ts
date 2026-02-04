/**
 * Payment link generation and parsing
 *
 * Generates shareable URIs encoding recipient meta-address + optional payment params.
 * URI format: amora://pay?meta=st:starknet:0x...:0x...&token=0x...&amount=1000000&memo=hello
 */

import { parseMetaAddress, isValidMetaAddress, type MetaAddress } from "./meta-address";

const PAYMENT_LINK_SCHEME = "amora";
const PAYMENT_LINK_HOST = "pay";

/**
 * Parameters for generating a payment link
 */
export interface PaymentLinkParams {
  /** The recipient's meta-address string */
  metaAddress: string;
  /** Optional token contract address */
  tokenAddress?: string;
  /** Optional payment amount */
  amount?: bigint;
  /** Optional memo text */
  memo?: string;
}

/**
 * A parsed payment link
 */
export interface ParsedPaymentLink {
  /** The parsed meta-address */
  metaAddress: MetaAddress;
  /** The raw meta-address string */
  metaAddressRaw: string;
  /** Optional token contract address */
  tokenAddress?: string;
  /** Optional payment amount */
  amount?: bigint;
  /** Optional memo text */
  memo?: string;
}

/**
 * Generate a shareable payment link URI
 *
 * @param params - Payment link parameters
 * @returns The encoded payment link URI
 * @throws If the meta-address is invalid
 */
export function generatePaymentLink(params: PaymentLinkParams): string {
  if (!isValidMetaAddress(params.metaAddress)) {
    throw new Error("Invalid meta-address");
  }

  const queryParts: string[] = [`meta=${encodeURIComponent(params.metaAddress)}`];

  if (params.tokenAddress !== undefined) {
    queryParts.push(`token=${encodeURIComponent(params.tokenAddress)}`);
  }

  if (params.amount !== undefined) {
    queryParts.push(`amount=${params.amount.toString()}`);
  }

  if (params.memo !== undefined) {
    queryParts.push(`memo=${encodeURIComponent(params.memo)}`);
  }

  return `${PAYMENT_LINK_SCHEME}://${PAYMENT_LINK_HOST}?${queryParts.join("&")}`;
}

/**
 * Parse a payment link URI
 *
 * @param link - The payment link URI to parse
 * @returns The parsed payment link data
 * @throws If the link format is invalid or contains an invalid meta-address
 */
export function parsePaymentLink(link: string): ParsedPaymentLink {
  // Validate scheme
  const schemePrefix = `${PAYMENT_LINK_SCHEME}://${PAYMENT_LINK_HOST}?`;
  if (!link.startsWith(schemePrefix)) {
    throw new Error(`Invalid payment link: must start with "${schemePrefix}"`);
  }

  const queryString = link.slice(schemePrefix.length);
  const params = new URLSearchParams(queryString);

  const metaRaw = params.get("meta");
  if (!metaRaw) {
    throw new Error("Invalid payment link: missing meta-address");
  }

  const metaAddressRaw = decodeURIComponent(metaRaw);
  const metaAddress = parseMetaAddress(metaAddressRaw);

  const result: ParsedPaymentLink = {
    metaAddress,
    metaAddressRaw,
  };

  const token = params.get("token");
  if (token) {
    result.tokenAddress = decodeURIComponent(token);
  }

  const amount = params.get("amount");
  if (amount) {
    result.amount = BigInt(amount);
  }

  const memo = params.get("memo");
  if (memo) {
    result.memo = decodeURIComponent(memo);
  }

  return result;
}

/**
 * Check if a string is a valid payment link
 *
 * @param link - The string to validate
 * @returns true if the string is a valid payment link
 */
export function isValidPaymentLink(link: string): boolean {
  try {
    parsePaymentLink(link);
    return true;
  } catch {
    return false;
  }
}
