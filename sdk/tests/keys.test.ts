import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  generateKeys,
  keyPairFromPrivateKey,
  keysFromPrivateKeys,
} from "../src/keys";
import { derivePublicKey } from "../src/crypto";

describe("keys", () => {
  describe("generateKeyPair", () => {
    it("should generate a valid keypair", () => {
      const keyPair = generateKeyPair();

      expect(typeof keyPair.privateKey).toBe("bigint");
      expect(typeof keyPair.publicKey).toBe("bigint");
      expect(keyPair.privateKey > 0n).toBe(true);
      expect(keyPair.publicKey > 0n).toBe(true);
    });

    it("should have consistent public key derivation", () => {
      const keyPair = generateKeyPair();
      const derivedPublic = derivePublicKey(keyPair.privateKey);
      expect(keyPair.publicKey).toBe(derivedPublic);
    });

    it("should generate different keypairs each time", () => {
      const kp1 = generateKeyPair();
      const kp2 = generateKeyPair();

      expect(kp1.privateKey).not.toBe(kp2.privateKey);
      expect(kp1.publicKey).not.toBe(kp2.publicKey);
    });
  });

  describe("generateKeys", () => {
    it("should generate both spending and viewing keypairs", () => {
      const keys = generateKeys();

      expect(keys.spendingKey).toBeDefined();
      expect(keys.viewingKey).toBeDefined();

      expect(typeof keys.spendingKey.privateKey).toBe("bigint");
      expect(typeof keys.spendingKey.publicKey).toBe("bigint");
      expect(typeof keys.viewingKey.privateKey).toBe("bigint");
      expect(typeof keys.viewingKey.publicKey).toBe("bigint");
    });

    it("should generate different spending and viewing keys", () => {
      const keys = generateKeys();

      expect(keys.spendingKey.privateKey).not.toBe(keys.viewingKey.privateKey);
      expect(keys.spendingKey.publicKey).not.toBe(keys.viewingKey.publicKey);
    });
  });

  describe("keyPairFromPrivateKey", () => {
    it("should derive the correct public key", () => {
      const privateKey = 12345678901234567890n;
      const keyPair = keyPairFromPrivateKey(privateKey);

      expect(keyPair.privateKey).toBe(privateKey);
      expect(keyPair.publicKey).toBe(derivePublicKey(privateKey));
    });
  });

  describe("keysFromPrivateKeys", () => {
    it("should create StealthKeys from private keys", () => {
      const spendingPrivate = 111111111111n;
      const viewingPrivate = 222222222222n;

      const keys = keysFromPrivateKeys(spendingPrivate, viewingPrivate);

      expect(keys.spendingKey.privateKey).toBe(spendingPrivate);
      expect(keys.viewingKey.privateKey).toBe(viewingPrivate);
      expect(keys.spendingKey.publicKey).toBe(derivePublicKey(spendingPrivate));
      expect(keys.viewingKey.publicKey).toBe(derivePublicKey(viewingPrivate));
    });
  });
});
