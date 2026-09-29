// services/user-key.service.js — BYOK funding decisions: which key (if
// any) funds a given LLM call, usage metering, and cooldown sync.
//
// Plaintext keys flow ONLY through here and the rag call args — decrypted
// from the vault, hashed for health checks, attached to one request, then
// dropped. Nothing here returns or logs key material.
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { decryptApiKey } from "../utils/keyvault.js";
import { checkUserKeyHealth } from "./rag.service.js";

const todayStamp = () => new Date().toISOString().slice(0, 10);

// Milliseconds until next America/Los_Angeles midnight (Google's quota
// reset). DST transitions mid-window make it approximate — fine for a
// cooldown, which only needs "tomorrow-ish".
const millisUntilPtMidnight = () => {
   const ptNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
   const next = new Date(ptNow);
   next.setHours(24, 0, 0, 0);
   return Math.max(0, next - ptNow);
};

const hashKey = (plaintext) =>
   crypto.createHash("sha256").update(String(plaintext), "utf-8").digest("hex");

// Resolves a healthy user key for funding, or null (use shared). Checks,
// in order: cipher present → status active → backend cooldown passed →
// rag-side health ok. Any failure or doubt returns null — shared funding
// is always the safe default.
const resolveHealthyUserKey = async (user) => {
   try {
      if (!user?.geminiApiKeyCipher || user.geminiKeyStatus !== "active") return null;
      if (user.geminiKeyCooldownUntil && new Date(user.geminiKeyCooldownUntil) > new Date()) {
         return null;
      }
      let plaintext;
      try {
         plaintext = decryptApiKey(user.geminiApiKeyCipher);
      } catch (err) {
         console.error(`Key vault decrypt failed for user ${user._id}:`, err.message);
         return null;
      }
      let health = { status: "ok" };
      try {
         health = await checkUserKeyHealth(hashKey(plaintext));
      } catch {
         // Health check itself failed — fail OPEN (include the key). The
         // rag ladder re-validates per attempt and reports back; worst
         // case one wasted call, never a blocked question.
      }
      if (health.status === "invalid") {
         await User.findByIdAndUpdate(user._id, { $set: { geminiKeyStatus: "invalid" } });
         return null;
      }
      if (health.status === "quota") {
         await User.findByIdAndUpdate(user._id, {
            $set: { geminiKeyStatus: "exhausted", geminiKeyCooldownUntil: new Date(Date.now() + millisUntilPtMidnight()) },
         });
         return null;
      }
      return plaintext;
   } catch (err) {
      console.error(`User-key resolution failed for ${user?._id}:`, err.message);
      return null;
   }
};

// Approximate metering: called when a user key was INCLUDED (attempt
// made), not on confirmed success — Google offers no per-key quota API,
// so our own count is the display meter. Day-rolls reset the counter.
const recordKeyUsage = async (userId) => {
   try {
      const today = todayStamp();
      const user = await User.findById(userId).select("geminiKeyUsageDate geminiKeyUsageCount");
      if (!user) return;
      if (user.geminiKeyUsageDate !== today) {
         user.geminiKeyUsageDate = today;
         user.geminiKeyUsageCount = 1;
      } else {
         user.geminiKeyUsageCount = (user.geminiKeyUsageCount || 0) + 1;
      }
      await user.save({ validateBeforeSave: false });
   } catch (err) {
      console.error(`Key usage record failed for ${userId}:`, err.message);
   }
};

// Syncs backend key state from a SYNCHRONOUS rag outcome (direct answers,
// where fundedBy/userKeyStatus are known). Fire-and-forget paths meter on
// supply instead (see recordKeyUsage callers).
const syncKeyOutcome = async (userId, fundedBy, userKeyStatus) => {
   try {
      if (fundedBy === "user") {
         await recordKeyUsage(userId);
         return;
      }
      if (userKeyStatus === "quota") {
         await User.findByIdAndUpdate(userId, {
            $set: {
               geminiKeyStatus: "exhausted",
               geminiKeyCooldownUntil: new Date(Date.now() + millisUntilPtMidnight()),
            },
         });
      } else if (userKeyStatus === "invalid") {
         await User.findByIdAndUpdate(userId, { $set: { geminiKeyStatus: "invalid" } });
      }
   } catch (err) {
      console.error(`Key outcome sync failed for ${userId}:`, err.message);
   }
};

export { resolveHealthyUserKey, recordKeyUsage, syncKeyOutcome };
