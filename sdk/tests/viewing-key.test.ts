import { describe, it, expect } from "vitest";
import {
  exportViewingKey,
  importViewingKey,
  isValidViewingKey,
  scanWithViewingKey,
} from "../src/viewing-key";
import { generateKeys } from "../src/keys";
import {
  generateStealthAddress,
  type Announcement,
} from "../src/stealth";
import { parseMetaAddress, encodeMetaAddress } from "../src/meta-address";

const TEST_CLASS_HASH =
  "0x01234567890abcdef01234567890abcdef01234567890abcdef01234567890ab";

describe("viewing-key", () => {
  describe("exportViewingKey", () => {
    it("should export a valid viewing key string", () => {
      const keys = generateKeys();
      const vk = exportViewingKey(keys);

      expect(vk).toMatch(/^vk:starknet:0x[0-9a-f]+:0x[0-9a-f]+$/);
    });

    it("should include viewing private key and spending public key", () => {
      const keys = generateKeys();
      const vk = exportViewingKey(keys);
      const parts = vk.split(":");

      expect(BigInt(parts[2])).toBe(keys.viewingKey.privateKey);
      expect(BigInt(parts[3])).toBe(keys.spendingKey.publicKey);
    });
  });

  describe("importViewingKey", () => {
    it("should parse a valid viewing key string", () => {
      const keys = generateKeys();
      const vkStr = exportViewingKey(keys);
      const vk = importViewingKey(vkStr);

      expect(vk.chain).toBe("starknet");
      expect(vk.viewingPrivateKey).toBe(keys.viewingKey.privateKey);
      expect(vk.spendingPubKey).toBe(keys.spendingKey.publicKey);
    });

    it("should throw for invalid prefix", () => {
      expect(() => importViewingKey("xx:starknet:0x1:0x2")).toThrow(
        'Invalid viewing key prefix'
      );
    });

    it("should throw for invalid chain", () => {
      expect(() => importViewingKey("vk:ethereum:0x1:0x2")).toThrow(
        'Invalid viewing key chain'
      );
    });

    it("should throw for wrong number of parts", () => {
      expect(() => importViewingKey("vk:starknet:0x1")).toThrow(
        "expected 4 parts"
      );
    });
  });

  describe("isValidViewingKey", () => {
    it("should return true for valid keys", () => {
      const keys = generateKeys();
      const vk = exportViewingKey(keys);
      expect(isValidViewingKey(vk)).toBe(true);
    });

    it("should return false for invalid keys", () => {
      expect(isValidViewingKey("not-a-key")).toBe(false);
      expect(isValidViewingKey("vk:starknet:0x0:0x1")).toBe(false);
    });
  });

  describe("round-trip export/import", () => {
    it("should round-trip viewing key data", () => {
      const keys = generateKeys();
      const exported = exportViewingKey(keys);
      const imported = importViewingKey(exported);

      expect(imported.viewingPrivateKey).toBe(keys.viewingKey.privateKey);
      expect(imported.spendingPubKey).toBe(keys.spendingKey.publicKey);
    });
  });

  describe("scanWithViewingKey", () => {
    it("should find matching announcements", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));
      const viewingKey = {
        chain: "starknet",
        viewingPrivateKey: recipientKeys.viewingKey.privateKey,
        spendingPubKey: recipientKeys.spendingKey.publicKey,
      };

      // Create a stealth address for this recipient
      const stealthResult = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: stealthResult.stealthAddress,
          ephemeralPubKey: stealthResult.ephemeralPubKey,
          viewTag: stealthResult.viewTag,
          metadata: [],
        },
      ];

      const matches = scanWithViewingKey(
        announcements,
        viewingKey,
        TEST_CLASS_HASH
      );

      expect(matches.length).toBe(1);
      expect(matches[0].stealthPubKey).toBe(stealthResult.stealthPubKey);
    });

    it("should not find announcements for a different recipient", () => {
      const recipientKeys = generateKeys();
      const otherKeys = generateKeys();
      const otherMeta = parseMetaAddress(encodeMetaAddress(otherKeys));
      const viewingKey = {
        chain: "starknet",
        viewingPrivateKey: recipientKeys.viewingKey.privateKey,
        spendingPubKey: recipientKeys.spendingKey.publicKey,
      };

      const stealthResult = generateStealthAddress(otherMeta, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: stealthResult.stealthAddress,
          ephemeralPubKey: stealthResult.ephemeralPubKey,
          viewTag: stealthResult.viewTag,
          metadata: [],
        },
      ];

      const matches = scanWithViewingKey(
        announcements,
        viewingKey,
        TEST_CLASS_HASH
      );

      expect(matches.length).toBe(0);
    });

    it("should find multiple matching announcements among non-matching ones", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));
      const viewingKey = {
        chain: "starknet",
        viewingPrivateKey: recipientKeys.viewingKey.privateKey,
        spendingPubKey: recipientKeys.spendingKey.publicKey,
      };

      const stealth1 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);
      const stealth2 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      // Create one for a different recipient
      const otherKeys = generateKeys();
      const otherMeta = parseMetaAddress(encodeMetaAddress(otherKeys));
      const otherStealth = generateStealthAddress(otherMeta, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: stealth1.stealthAddress,
          ephemeralPubKey: stealth1.ephemeralPubKey,
          viewTag: stealth1.viewTag,
          metadata: [],
        },
        {
          stealthAddress: otherStealth.stealthAddress,
          ephemeralPubKey: otherStealth.ephemeralPubKey,
          viewTag: otherStealth.viewTag,
          metadata: [],
        },
        {
          stealthAddress: stealth2.stealthAddress,
          ephemeralPubKey: stealth2.ephemeralPubKey,
          viewTag: stealth2.viewTag,
          metadata: [],
        },
      ];

      const matches = scanWithViewingKey(
        announcements,
        viewingKey,
        TEST_CLASS_HASH
      );

      expect(matches.length).toBe(2);
    });

    it("should produce same results as imported viewing key", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));

      // Export and re-import
      const vkStr = exportViewingKey(recipientKeys);
      const viewingKey = importViewingKey(vkStr);

      const stealthResult = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: stealthResult.stealthAddress,
          ephemeralPubKey: stealthResult.ephemeralPubKey,
          viewTag: stealthResult.viewTag,
          metadata: [],
        },
      ];

      const matches = scanWithViewingKey(
        announcements,
        viewingKey,
        TEST_CLASS_HASH
      );

      expect(matches.length).toBe(1);
      expect(matches[0].stealthPubKey).toBe(stealthResult.stealthPubKey);
    });
  });
});
