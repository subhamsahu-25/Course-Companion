// utils/keyvault.js — AES-256-GCM vault for user-supplied Gemini API keys.
//
// One hard rule: plaintext keys exist ONLY in function arguments and the
// decrypted return value, both of which stay server-side. The database
// holds opaque blobs, no API response or log line may ever include key
// material (use maskedKey() for display).
//
// Requires GEMINI_KEY_SECRET: 64 hex chars (32 bytes). Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Missing/malformed secret fails LOUD at first use — silently running
// without encryption would be worse than refusing.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getSecret() {
   const hex = process.env.GEMINI_KEY_SECRET || "";
   if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
         "GEMINI_KEY_SECRET must be 64 hex chars (32 bytes). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
   }
   return Buffer.from(hex, "hex");
}

// "iv:authTag:ciphertext", all base64 — single string column, no schema fuss.
const encryptApiKey = (plaintext) => {
   if (!plaintext || typeof plaintext !== "string") {
      throw new Error("encryptApiKey requires a non-empty string");
   }
   const iv = crypto.randomBytes(12);
   const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
   const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
   const tag = cipher.getAuthTag();
   return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};

const decryptApiKey = (blob) => {
   const [ivB64, tagB64, dataB64] = String(blob || "").split(":");
   if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("Malformed key blob");
   }
   const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), Buffer.from(ivB64, "base64"));
   decipher.setAuthTag(Buffer.from(tagB64, "base64"));
   return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
   ]).toString("utf8");
};

// Safe-for-display fingerprint: last 4 chars only, e.g. "••••ab12".
const maskedKey = (plaintext) => {
   const tail = String(plaintext || "").slice(-4);
   return tail ? `••••${tail}` : "••••";
};

export { encryptApiKey, decryptApiKey, maskedKey };
