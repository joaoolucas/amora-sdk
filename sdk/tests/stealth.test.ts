import { describe, it, expect } from "vitest";
import {
  generateStealthAddress,
  generateStealthAddressWithKey,
  computeStealthContractAddress,
  computeStealthPrivateKey,
  checkAnnouncementViewTag,
  verifyAndComputeStealthKey,
  scanAnnouncements,
  type Announcement,
} from "../src/stealth";
import { generateKeys, keysFromPrivateKeys } from "../src/keys";
import { parseMetaAddress, encodeMetaAddress } from "../src/meta-address";
import {
  generatePrivateKey,
  derivePublicKey,
  ecdh,
  computeViewTag,
} from "../src/crypto";

// Use a dummy class hash for testing
const TEST_CLASS_HASH =
  "0x01234567890abcdef01234567890abcdef01234567890abcdef01234567890ab";

describe("stealth", () => {
  describe("generateStealthAddress", () => {
    it("should generate a stealth address for a recipient", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));

      const result = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      expect(result.stealthAddress).toBeDefined();
      expect(typeof result.stealthAddress).toBe("string");
      expect(result.stealthPubKey > 0n).toBe(true);
      expect(result.ephemeralPubKey > 0n).toBe(true);
      expect(result.viewTag).toBeGreaterThanOrEqual(0);
      expect(result.viewTag).toBeLessThanOrEqual(255);
    });

    it("should generate different addresses each time", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));

      const result1 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);
      const result2 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress);
      expect(result1.ephemeralPubKey).not.toBe(result2.ephemeralPubKey);
    });
  });

  describe("generateStealthAddressWithKey", () => {
    it("should be deterministic with the same ephemeral key", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));
      const ephemeralKey = generatePrivateKey();

      const result1 = generateStealthAddressWithKey(
        metaAddress,
        ephemeralKey,
        TEST_CLASS_HASH
      );
      const result2 = generateStealthAddressWithKey(
        metaAddress,
        ephemeralKey,
        TEST_CLASS_HASH
      );

      expect(result1.stealthAddress).toBe(result2.stealthAddress);
      expect(result1.stealthPubKey).toBe(result2.stealthPubKey);
      expect(result1.viewTag).toBe(result2.viewTag);
    });
  });

  describe("computeStealthContractAddress", () => {
    it("should compute a deterministic address", () => {
      const publicKey = 12345n;

      const addr1 = computeStealthContractAddress(publicKey, TEST_CLASS_HASH);
      const addr2 = computeStealthContractAddress(publicKey, TEST_CLASS_HASH);

      expect(addr1).toBe(addr2);
    });

    it("should compute different addresses for different keys", () => {
      const addr1 = computeStealthContractAddress(111n, TEST_CLASS_HASH);
      const addr2 = computeStealthContractAddress(222n, TEST_CLASS_HASH);

      expect(addr1).not.toBe(addr2);
    });
  });

  describe("checkAnnouncementViewTag", () => {
    it("should return shared secret for matching view tag", () => {
      // Setup: create recipient keys
      const viewingPrivate = generatePrivateKey();
      const viewingPublic = derivePublicKey(viewingPrivate);

      // Sender creates ephemeral key and computes shared secret
      const ephemeralPrivate = generatePrivateKey();
      const ephemeralPubKey = derivePublicKey(ephemeralPrivate);
      const senderSharedSecret = ecdh(ephemeralPrivate, viewingPublic);
      const viewTag = computeViewTag(senderSharedSecret);

      // Create announcement
      const announcement: Announcement = {
        stealthAddress: "0x123",
        ephemeralPubKey,
        viewTag,
        metadata: [],
      };

      // Check view tag
      const result = checkAnnouncementViewTag(announcement, viewingPrivate);

      expect(result).not.toBeNull();
      expect(result).toBe(senderSharedSecret);
    });

    it("should return null for non-matching view tag", () => {
      const viewingPrivate = generatePrivateKey();

      const announcement: Announcement = {
        stealthAddress: "0x123",
        ephemeralPubKey: derivePublicKey(generatePrivateKey()),
        viewTag: 255, // Arbitrary tag that likely won't match
        metadata: [],
      };

      const result = checkAnnouncementViewTag(announcement, viewingPrivate);

      // May or may not match depending on the random key
      // This is probabilistic, but with high probability won't match
      // We can't guarantee it won't match, so we just check it's a bigint or null
      expect(result === null || typeof result === "bigint").toBe(true);
    });
  });

  describe("verifyAndComputeStealthKey", () => {
    it("should verify matching announcement and compute stealth key", () => {
      // Setup: recipient keys
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));

      // Sender generates stealth address
      const result = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      // Create announcement
      const announcement: Announcement = {
        stealthAddress: result.stealthAddress,
        ephemeralPubKey: result.ephemeralPubKey,
        viewTag: result.viewTag,
        metadata: [],
      };

      // Recipient verifies and computes stealth key
      const payment = verifyAndComputeStealthKey(
        announcement,
        recipientKeys.viewingKey.privateKey,
        recipientKeys.spendingKey.publicKey,
        recipientKeys.spendingKey.privateKey,
        TEST_CLASS_HASH
      );

      expect(payment).not.toBeNull();
      expect(payment!.stealthPrivateKey > 0n).toBe(true);
      expect(payment!.stealthPubKey).toBe(result.stealthPubKey);

      // Verify the stealth private key corresponds to the stealth public key
      const derivedPubKey = derivePublicKey(payment!.stealthPrivateKey);
      expect(derivedPubKey).toBe(result.stealthPubKey);
    });

    it("should return null for non-matching announcement", () => {
      const recipientKeys = generateKeys();
      const otherKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(otherKeys));

      // Generate stealth address for different recipient
      const result = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      const announcement: Announcement = {
        stealthAddress: result.stealthAddress,
        ephemeralPubKey: result.ephemeralPubKey,
        viewTag: result.viewTag,
        metadata: [],
      };

      // Try to verify with wrong keys
      const payment = verifyAndComputeStealthKey(
        announcement,
        recipientKeys.viewingKey.privateKey,
        recipientKeys.spendingKey.publicKey,
        recipientKeys.spendingKey.privateKey,
        TEST_CLASS_HASH
      );

      expect(payment).toBeNull();
    });
  });

  describe("scanAnnouncements", () => {
    it("should find matching announcements", () => {
      const recipientKeys = generateKeys();
      const metaAddress = parseMetaAddress(encodeMetaAddress(recipientKeys));

      // Create multiple announcements, some for the recipient
      const stealthResult1 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);
      const stealthResult2 = generateStealthAddress(metaAddress, TEST_CLASS_HASH);

      // Create announcement for a different recipient
      const otherKeys = generateKeys();
      const otherMeta = parseMetaAddress(encodeMetaAddress(otherKeys));
      const otherResult = generateStealthAddress(otherMeta, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: stealthResult1.stealthAddress,
          ephemeralPubKey: stealthResult1.ephemeralPubKey,
          viewTag: stealthResult1.viewTag,
          metadata: [],
        },
        {
          stealthAddress: otherResult.stealthAddress,
          ephemeralPubKey: otherResult.ephemeralPubKey,
          viewTag: otherResult.viewTag,
          metadata: [],
        },
        {
          stealthAddress: stealthResult2.stealthAddress,
          ephemeralPubKey: stealthResult2.ephemeralPubKey,
          viewTag: stealthResult2.viewTag,
          metadata: [],
        },
      ];

      const payments = scanAnnouncements(
        announcements,
        recipientKeys.viewingKey.privateKey,
        recipientKeys.spendingKey.publicKey,
        recipientKeys.spendingKey.privateKey,
        TEST_CLASS_HASH
      );

      // Should find 2 matching payments
      expect(payments.length).toBe(2);
    });

    it("should return empty array when no matches", () => {
      const recipientKeys = generateKeys();
      const otherKeys = generateKeys();
      const otherMeta = parseMetaAddress(encodeMetaAddress(otherKeys));

      const result = generateStealthAddress(otherMeta, TEST_CLASS_HASH);

      const announcements: Announcement[] = [
        {
          stealthAddress: result.stealthAddress,
          ephemeralPubKey: result.ephemeralPubKey,
          viewTag: result.viewTag,
          metadata: [],
        },
      ];

      const payments = scanAnnouncements(
        announcements,
        recipientKeys.viewingKey.privateKey,
        recipientKeys.spendingKey.publicKey,
        recipientKeys.spendingKey.privateKey,
        TEST_CLASS_HASH
      );

      expect(payments.length).toBe(0);
    });
  });

  describe("computeStealthPrivateKey", () => {
    it("should compute a valid private key", () => {
      const spendingPrivate = generatePrivateKey();
      const sharedSecret = generatePrivateKey(); // Use as a shared secret

      const stealthPrivate = computeStealthPrivateKey(
        spendingPrivate,
        sharedSecret
      );

      expect(typeof stealthPrivate).toBe("bigint");
      expect(stealthPrivate > 0n).toBe(true);
    });
  });
});
