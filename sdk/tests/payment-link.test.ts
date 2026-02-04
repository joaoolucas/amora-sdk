import { describe, it, expect } from "vitest";
import {
  generatePaymentLink,
  parsePaymentLink,
  isValidPaymentLink,
} from "../src/payment-link";
import { generateKeys } from "../src/keys";
import { encodeMetaAddress } from "../src/meta-address";

describe("payment-link", () => {
  const keys = generateKeys();
  const metaAddress = encodeMetaAddress(keys);

  describe("generatePaymentLink", () => {
    it("should generate a link with only meta-address", () => {
      const link = generatePaymentLink({ metaAddress });
      expect(link).toContain("amora://pay?");
      expect(link).toContain("meta=");
    });

    it("should generate a link with all optional params", () => {
      const link = generatePaymentLink({
        metaAddress,
        tokenAddress: "0xabc",
        amount: 1000000n,
        memo: "hello",
      });
      expect(link).toContain("meta=");
      expect(link).toContain("token=0xabc");
      expect(link).toContain("amount=1000000");
      expect(link).toContain("memo=hello");
    });

    it("should URL-encode the memo", () => {
      const link = generatePaymentLink({
        metaAddress,
        memo: "hello world & more",
      });
      expect(link).toContain("memo=hello%20world%20%26%20more");
    });

    it("should throw for invalid meta-address", () => {
      expect(() =>
        generatePaymentLink({ metaAddress: "invalid" })
      ).toThrow("Invalid meta-address");
    });
  });

  describe("parsePaymentLink", () => {
    it("should parse a link with only meta-address", () => {
      const link = generatePaymentLink({ metaAddress });
      const parsed = parsePaymentLink(link);
      expect(parsed.metaAddressRaw).toBe(metaAddress);
      expect(parsed.metaAddress.spendingPubKey).toBe(keys.spendingKey.publicKey);
      expect(parsed.metaAddress.viewingPubKey).toBe(keys.viewingKey.publicKey);
      expect(parsed.tokenAddress).toBeUndefined();
      expect(parsed.amount).toBeUndefined();
      expect(parsed.memo).toBeUndefined();
    });

    it("should parse a link with all params", () => {
      const link = generatePaymentLink({
        metaAddress,
        tokenAddress: "0xabc",
        amount: 1000000n,
        memo: "thanks",
      });
      const parsed = parsePaymentLink(link);
      expect(parsed.tokenAddress).toBe("0xabc");
      expect(parsed.amount).toBe(1000000n);
      expect(parsed.memo).toBe("thanks");
    });

    it("should throw for invalid scheme", () => {
      expect(() => parsePaymentLink("http://pay?meta=foo")).toThrow(
        "Invalid payment link"
      );
    });

    it("should throw for missing meta-address", () => {
      expect(() => parsePaymentLink("amora://pay?token=0x1")).toThrow(
        "missing meta-address"
      );
    });
  });

  describe("isValidPaymentLink", () => {
    it("should return true for valid links", () => {
      const link = generatePaymentLink({ metaAddress });
      expect(isValidPaymentLink(link)).toBe(true);
    });

    it("should return false for invalid links", () => {
      expect(isValidPaymentLink("not-a-link")).toBe(false);
      expect(isValidPaymentLink("amora://pay?token=0x1")).toBe(false);
    });
  });

  describe("round-trip", () => {
    it("should round-trip a full payment link", () => {
      const original = {
        metaAddress,
        tokenAddress: "0xdeadbeef",
        amount: 999999999n,
        memo: "Payment for services rendered!",
      };
      const link = generatePaymentLink(original);
      const parsed = parsePaymentLink(link);

      expect(parsed.metaAddressRaw).toBe(original.metaAddress);
      expect(parsed.tokenAddress).toBe(original.tokenAddress);
      expect(parsed.amount).toBe(original.amount);
      expect(parsed.memo).toBe(original.memo);
    });
  });
});
