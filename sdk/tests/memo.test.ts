import { describe, it, expect } from "vitest";
import { encodeMemo, decodeMemo } from "../src/memo";

describe("memo", () => {
  describe("encodeMemo", () => {
    it("should encode a simple ASCII string", () => {
      const felts = encodeMemo("hello");
      expect(felts[0]).toBe(5n); // 5 bytes
      expect(felts.length).toBe(2); // length prefix + 1 chunk
    });

    it("should encode an empty string", () => {
      const felts = encodeMemo("");
      expect(felts).toEqual([0n]);
    });

    it("should encode a string longer than 31 bytes into multiple felts", () => {
      const longText = "A".repeat(62); // 62 ASCII bytes = 2 full chunks
      const felts = encodeMemo(longText);
      expect(felts[0]).toBe(62n);
      expect(felts.length).toBe(3); // length prefix + 2 chunks
    });

    it("should encode exactly 31 bytes into one chunk", () => {
      const text = "A".repeat(31);
      const felts = encodeMemo(text);
      expect(felts[0]).toBe(31n);
      expect(felts.length).toBe(2); // length prefix + 1 chunk
    });

    it("should encode a string that is not a multiple of 31 bytes", () => {
      const text = "A".repeat(33); // 31 + 2
      const felts = encodeMemo(text);
      expect(felts[0]).toBe(33n);
      expect(felts.length).toBe(3); // length prefix + 2 chunks
    });

    it("should handle multi-byte UTF-8 characters", () => {
      const text = "\u00e9"; // é = 2 bytes in UTF-8
      const felts = encodeMemo(text);
      expect(felts[0]).toBe(2n);
    });
  });

  describe("decodeMemo", () => {
    it("should throw on empty array", () => {
      expect(() => decodeMemo([])).toThrow("empty felts array");
    });

    it("should decode zero-length memo to empty string", () => {
      expect(decodeMemo([0n])).toBe("");
    });
  });

  describe("round-trip", () => {
    it("should round-trip a simple string", () => {
      const original = "Thanks for dinner!";
      const encoded = encodeMemo(original);
      const decoded = decodeMemo(encoded);
      expect(decoded).toBe(original);
    });

    it("should round-trip an empty string", () => {
      const encoded = encodeMemo("");
      const decoded = decodeMemo(encoded);
      expect(decoded).toBe("");
    });

    it("should round-trip a long string", () => {
      const original = "The quick brown fox jumps over the lazy dog. ".repeat(10);
      const encoded = encodeMemo(original);
      const decoded = decodeMemo(encoded);
      expect(decoded).toBe(original);
    });

    it("should round-trip multi-byte UTF-8 characters", () => {
      const original = "Caf\u00e9 \ud83c\udf1f \u4f60\u597d";
      const encoded = encodeMemo(original);
      const decoded = decodeMemo(encoded);
      expect(decoded).toBe(original);
    });

    it("should round-trip exactly 31 bytes", () => {
      const original = "1234567890123456789012345678901";
      expect(new TextEncoder().encode(original).length).toBe(31);
      const encoded = encodeMemo(original);
      const decoded = decodeMemo(encoded);
      expect(decoded).toBe(original);
    });
  });
});
