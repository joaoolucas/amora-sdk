import { describe, it, expect } from "vitest";
import {
  encodeMetaAddress,
  encodeMetaAddressFromPubKeys,
  parseMetaAddress,
  isValidMetaAddress,
  META_ADDRESS_PREFIX,
  CHAIN_ID,
} from "../src/meta-address";
import { generateKeys } from "../src/keys";

describe("meta-address", () => {
  describe("encodeMetaAddress", () => {
    it("should encode keys to meta-address format", () => {
      const keys = generateKeys();
      const metaAddress = encodeMetaAddress(keys);

      expect(metaAddress.startsWith(`${META_ADDRESS_PREFIX}:${CHAIN_ID}:`)).toBe(
        true
      );
      expect(metaAddress.split(":").length).toBe(4);
    });

    it("should encode specific values correctly", () => {
      const spendingPubKey = 0xabcn;
      const viewingPubKey = 0xdefn;

      const metaAddress = encodeMetaAddressFromPubKeys(
        spendingPubKey,
        viewingPubKey
      );

      expect(metaAddress).toBe("st:starknet:0xabc:0xdef");
    });
  });

  describe("parseMetaAddress", () => {
    it("should parse a valid meta-address", () => {
      const metaAddress = "st:starknet:0x123:0x456";
      const parsed = parseMetaAddress(metaAddress);

      expect(parsed.chain).toBe("starknet");
      expect(parsed.spendingPubKey).toBe(0x123n);
      expect(parsed.viewingPubKey).toBe(0x456n);
    });

    it("should round-trip encode and parse", () => {
      const keys = generateKeys();
      const encoded = encodeMetaAddress(keys);
      const parsed = parseMetaAddress(encoded);

      expect(parsed.spendingPubKey).toBe(keys.spendingKey.publicKey);
      expect(parsed.viewingPubKey).toBe(keys.viewingKey.publicKey);
    });

    it("should throw on invalid prefix", () => {
      expect(() => parseMetaAddress("invalid:starknet:0x123:0x456")).toThrow(
        "Invalid meta-address prefix"
      );
    });

    it("should throw on invalid chain", () => {
      expect(() => parseMetaAddress("st:ethereum:0x123:0x456")).toThrow(
        "Invalid chain ID"
      );
    });

    it("should throw on invalid format (wrong number of parts)", () => {
      expect(() => parseMetaAddress("st:starknet:0x123")).toThrow(
        "Invalid meta-address format"
      );
    });

    it("should throw on invalid hex values", () => {
      expect(() => parseMetaAddress("st:starknet:notahex:0x456")).toThrow(
        "Invalid spending public key"
      );
    });
  });

  describe("isValidMetaAddress", () => {
    it("should return true for valid meta-addresses", () => {
      expect(isValidMetaAddress("st:starknet:0x123:0x456")).toBe(true);
    });

    it("should return false for invalid meta-addresses", () => {
      expect(isValidMetaAddress("invalid")).toBe(false);
      expect(isValidMetaAddress("st:ethereum:0x123:0x456")).toBe(false);
      expect(isValidMetaAddress("")).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have correct prefix", () => {
      expect(META_ADDRESS_PREFIX).toBe("st");
    });

    it("should have correct chain ID", () => {
      expect(CHAIN_ID).toBe("starknet");
    });
  });
});
