import { describe, it, expect } from "vitest";
import { generateKeys } from "../src/keys";
import { encodeMetaAddress, parseMetaAddress } from "../src/meta-address";
import { generateStealthAddress } from "../src/stealth";

// Test buildBatchSendCalls logic without needing a real provider
// by verifying the stealth address generation for multiple recipients

const TEST_CLASS_HASH =
  "0x01234567890abcdef01234567890abcdef01234567890abcdef01234567890ab";

describe("batch-send", () => {
  describe("buildBatchSendCalls logic", () => {
    it("should generate stealth addresses for multiple recipients", () => {
      const recipient1Keys = generateKeys();
      const recipient2Keys = generateKeys();
      const meta1 = parseMetaAddress(encodeMetaAddress(recipient1Keys));
      const meta2 = parseMetaAddress(encodeMetaAddress(recipient2Keys));

      const stealth1 = generateStealthAddress(meta1, TEST_CLASS_HASH);
      const stealth2 = generateStealthAddress(meta2, TEST_CLASS_HASH);

      // Each should produce a valid stealth address
      expect(stealth1.stealthAddress).toBeDefined();
      expect(stealth2.stealthAddress).toBeDefined();
      expect(stealth1.stealthAddress).not.toBe(stealth2.stealthAddress);
    });

    it("should produce unique stealth addresses for same recipient multiple times", () => {
      const keys = generateKeys();
      const meta = parseMetaAddress(encodeMetaAddress(keys));

      const stealth1 = generateStealthAddress(meta, TEST_CLASS_HASH);
      const stealth2 = generateStealthAddress(meta, TEST_CLASS_HASH);

      expect(stealth1.stealthAddress).not.toBe(stealth2.stealthAddress);
      expect(stealth1.ephemeralPubKey).not.toBe(stealth2.ephemeralPubKey);
    });
  });

  describe("BatchPayment type usage", () => {
    it("should accept meta-address as string", () => {
      const keys = generateKeys();
      const metaStr = encodeMetaAddress(keys);

      // Verify the string meta-address can be parsed (simulating what Amora.generateStealthAddress does)
      const meta = parseMetaAddress(metaStr);
      const stealth = generateStealthAddress(meta, TEST_CLASS_HASH);

      expect(stealth.stealthAddress).toBeDefined();
    });

    it("should accept meta-address as parsed MetaAddress", () => {
      const keys = generateKeys();
      const meta = parseMetaAddress(encodeMetaAddress(keys));

      const stealth = generateStealthAddress(meta, TEST_CLASS_HASH);
      expect(stealth.stealthAddress).toBeDefined();
    });
  });
});
