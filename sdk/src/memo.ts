/**
 * Memo encoding/decoding for stealth payment metadata
 *
 * Encodes UTF-8 text into felt252 array for the existing metadata field.
 * Each felt252 holds 31 bytes. The first felt is the byte length prefix.
 */

const BYTES_PER_FELT = 31;

/**
 * Encode a UTF-8 string into an array of felt252 values
 *
 * Encoding scheme:
 * 1. Convert string to UTF-8 bytes
 * 2. First felt252 = total byte length
 * 3. Subsequent felts = 31-byte chunks packed big-endian into bigints
 *
 * @param memo - The text to encode
 * @returns Array of bigints representing the memo as felt252 values
 */
export function encodeMemo(memo: string): bigint[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(memo);

  if (bytes.length === 0) {
    return [0n];
  }

  const felts: bigint[] = [BigInt(bytes.length)];

  for (let i = 0; i < bytes.length; i += BYTES_PER_FELT) {
    const chunk = bytes.slice(i, i + BYTES_PER_FELT);
    let value = 0n;
    for (const byte of chunk) {
      value = (value << 8n) | BigInt(byte);
    }
    felts.push(value);
  }

  return felts;
}

/**
 * Decode an array of felt252 values back into a UTF-8 string
 *
 * @param felts - Array of bigints where felts[0] is byte length and
 *                subsequent felts are 31-byte big-endian chunks
 * @returns The decoded string
 * @throws If the felts array is empty
 */
export function decodeMemo(felts: bigint[]): string {
  if (felts.length === 0) {
    throw new Error("Cannot decode memo: empty felts array");
  }

  const totalBytes = Number(felts[0]);
  if (totalBytes === 0) {
    return "";
  }

  const bytes = new Uint8Array(totalBytes);
  let bytesWritten = 0;

  for (let i = 1; i < felts.length && bytesWritten < totalBytes; i++) {
    const remaining = totalBytes - bytesWritten;
    const chunkSize = Math.min(BYTES_PER_FELT, remaining);
    const value = felts[i];

    // Extract bytes from big-endian packed bigint
    for (let j = chunkSize - 1; j >= 0; j--) {
      bytes[bytesWritten + j] = Number((value >> BigInt((chunkSize - 1 - j) * 8)) & 0xffn);
    }

    bytesWritten += chunkSize;
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
