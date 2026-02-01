import { describe, it, expect } from "vitest";
import {
  generatePrivateKey,
  derivePublicKey,
  ecdh,
  poseidonHash,
  computeViewTag,
  computeStealthPublicKey,
  computeStealthPrivateKey,
  scalarBaseMult,
  pointAdd,
  CURVE_ORDER,
  SCHEME_ID_STARK,
} from "../src/crypto";

describe("crypto", () => {
  describe("generatePrivateKey", () => {
    it("should generate a valid private key", () => {
      const privateKey = generatePrivateKey();
      expect(typeof privateKey).toBe("bigint");
      expect(privateKey > 0n).toBe(true);
      expect(privateKey < CURVE_ORDER).toBe(true);
    });

    it("should generate different keys each time", () => {
      const key1 = generatePrivateKey();
      const key2 = generatePrivateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("derivePublicKey", () => {
    it("should derive a public key from a private key", () => {
      const privateKey = generatePrivateKey();
      const publicKey = derivePublicKey(privateKey);
      expect(typeof publicKey).toBe("bigint");
      expect(publicKey > 0n).toBe(true);
    });

    it("should be deterministic", () => {
      const privateKey = 123456789n;
      const pubKey1 = derivePublicKey(privateKey);
      const pubKey2 = derivePublicKey(privateKey);
      expect(pubKey1).toBe(pubKey2);
    });
  });

  describe("ecdh", () => {
    it("should compute the same shared secret from both sides", () => {
      const alicePrivate = generatePrivateKey();
      const alicePublic = derivePublicKey(alicePrivate);

      const bobPrivate = generatePrivateKey();
      const bobPublic = derivePublicKey(bobPrivate);

      // Alice computes shared secret with Bob's public key
      const sharedAlice = ecdh(alicePrivate, bobPublic);

      // Bob computes shared secret with Alice's public key
      const sharedBob = ecdh(bobPrivate, alicePublic);

      expect(sharedAlice).toBe(sharedBob);
    });
  });

  describe("poseidonHash", () => {
    it("should hash a single element", () => {
      const result = poseidonHash(42n);
      expect(typeof result).toBe("bigint");
      expect(result > 0n).toBe(true);
    });

    it("should hash multiple elements", () => {
      const result = poseidonHash(1n, 2n, 3n);
      expect(typeof result).toBe("bigint");
    });

    it("should be deterministic", () => {
      const hash1 = poseidonHash(123n, 456n);
      const hash2 = poseidonHash(123n, 456n);
      expect(hash1).toBe(hash2);
    });

    it("should produce different results for different inputs", () => {
      const hash1 = poseidonHash(123n);
      const hash2 = poseidonHash(456n);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("computeViewTag", () => {
    it("should return a value between 0 and 255", () => {
      const viewTag = computeViewTag(12345n);
      expect(viewTag).toBeGreaterThanOrEqual(0);
      expect(viewTag).toBeLessThanOrEqual(255);
    });

    it("should be deterministic", () => {
      const tag1 = computeViewTag(99999n);
      const tag2 = computeViewTag(99999n);
      expect(tag1).toBe(tag2);
    });
  });

  describe("stealth address cryptography", () => {
    it("should generate matching stealth keys", () => {
      // Recipient generates spending and viewing keys
      const spendingPrivate = generatePrivateKey();
      const spendingPublic = derivePublicKey(spendingPrivate);
      const viewingPrivate = generatePrivateKey();
      const viewingPublic = derivePublicKey(viewingPrivate);

      // Sender generates ephemeral key and computes shared secret
      const ephemeralPrivate = generatePrivateKey();
      const ephemeralPublic = derivePublicKey(ephemeralPrivate);
      const senderSharedSecret = ecdh(ephemeralPrivate, viewingPublic);

      // Sender computes stealth public key
      const stealthPubKey = computeStealthPublicKey(
        spendingPublic,
        senderSharedSecret
      );

      // Recipient computes shared secret from ephemeral public key
      const recipientSharedSecret = ecdh(viewingPrivate, ephemeralPublic);
      expect(recipientSharedSecret).toBe(senderSharedSecret);

      // Recipient computes stealth private key
      const stealthPrivateKey = computeStealthPrivateKey(
        spendingPrivate,
        recipientSharedSecret
      );

      // Verify: public key from stealth private key should match
      const derivedStealthPublic = derivePublicKey(stealthPrivateKey);
      expect(derivedStealthPublic).toBe(stealthPubKey);
    });
  });

  describe("SCHEME_ID_STARK", () => {
    it("should be the correct value for 'STARK'", () => {
      // "STARK" in ASCII: S=0x53, T=0x54, A=0x41, R=0x52, K=0x4b
      expect(SCHEME_ID_STARK).toBe(0x535441524b);
    });
  });
});
