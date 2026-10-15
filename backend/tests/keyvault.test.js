// Vault must round-trip, reject tampering, and refuse to run misconfigured.
import { describe, test, expect, beforeEach } from "vitest";
import { encryptApiKey, decryptApiKey, maskedKey } from "../src/utils/keyvault.js";

const GOOD_SECRET = "a".repeat(64);

beforeEach(() => {
   process.env.GEMINI_KEY_SECRET = GOOD_SECRET;
});

describe("keyvault", () => {
   test("encrypt/decrypt roundtrip, blob hides plaintext", () => {
      const blob = encryptApiKey("my-key");
      expect(blob).not.toContain("my-key");
      expect(decryptApiKey(blob)).toBe("my-key");
   });

   test("same key encrypts differently twice (random IV)", () => {
      expect(encryptApiKey("k")).not.toBe(encryptApiKey("k"));
   });

   test("tampered blob fails closed", () => {
      const [iv, tag, data] = encryptApiKey("k").split(":");
      expect(() => decryptApiKey(`${iv}:${tag}:${data.slice(0, -2)}AA`)).toThrow();
   });

   test("malformed blob fails", () => {
      expect(() => decryptApiKey("not-a-blob")).toThrow();
      expect(() => decryptApiKey("")).toThrow();
   });

   test("missing/malformed secret fails loud, never silent", () => {
      delete process.env.GEMINI_KEY_SECRET;
      expect(() => encryptApiKey("k")).toThrow(/GEMINI_KEY_SECRET/);
      process.env.GEMINI_KEY_SECRET = "short";
      expect(() => encryptApiKey("k")).toThrow(/GEMINI_KEY_SECRET/);
   });

   test("masked shows tail only", () => {
      expect(maskedKey("AIzaSyABCDEF1234")).toBe("••••1234");
   });
});
