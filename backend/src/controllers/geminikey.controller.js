// controllers/gemini-key.controller.js — BYOK management: the user views
// (masked), adds/replaces, tests, and deletes their own Gemini API key.
//
// Security shape, read twice:
// - The plaintext key arrives in the request body, is validated with ONE
//   cheap Google ping, encrypted, and stored. It is NEVER returned, NEVER
//   logged, and NEVER embedded in another response.
// - Responses carry only { present, masked, status, cooldownUntil,
//   usageToday }.
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { User } from "../models/user.model.js";
import { encryptApiKey, maskedKey } from "../utils/keyvault.js";

// One cheap validation ping — models.list with pageSize=1. 200 = good
// key; 400 = bad key. Never throws the key into logs.
const pingGeminiKey = async (apiKey) => {
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 12000);
   try {
      const res = await fetch(
         `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`,
         { signal: controller.signal }
      );
      return res.ok;
   } catch {
      return null; // network failure — indeterminate, not "invalid"
   } finally {
      clearTimeout(timeout);
   }
};

const todayStamp = () => new Date().toISOString().slice(0, 10);

const statusPayload = (user) => ({
   present: !!user.geminiApiKeyCipher,
   masked: user.geminiApiKeyCipher ? maskedKey("xxxx") : null,
   status: user.geminiKeyStatus,
   cooldownUntil: user.geminiKeyCooldownUntil,
   usageToday:
      user.geminiKeyUsageDate === todayStamp() ? user.geminiKeyUsageCount || 0 : 0,
});

const getGeminiKey = asyncHandler(async (req, res) => {
   const user = await User.findById(req.user._id)
      .select("geminiApiKeyCipher geminiKeyStatus geminiKeyCooldownUntil geminiKeyUsageDate geminiKeyUsageCount")
      .lean();
   if (!user) throw new ApiError(404, "User not found");
   // Masked fingerprint needs the tail — derive without exposing: we only
   // ever stored the cipher, so show presence + status. The tail is shown
   // at save time only (see below).
   return res
      .status(200)
      .json(new ApiResponse(200, { ...statusPayload(user), masked: user.geminiApiKeyCipher ? "••••" : null }, "Gemini key status fetched"));
});

const setGeminiKey = asyncHandler(async (req, res) => {
   const { apiKey } = req.body;
   if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
      throw new ApiError(400, "A valid Gemini API key is required");
   }
   const key = apiKey.trim();

   const ping = await pingGeminiKey(key);
   if (ping === false) {
      throw new ApiError(400, "That key was rejected by Google — check it and try again");
   }
   // ping === null means OUR network to Google failed (indeterminate, not
   // invalid) — save anyway with a warning; first real use re-validates,
   // and a bad key gets flagged invalid automatically.

   const user = await User.findById(req.user._id);
   if (!user) throw new ApiError(404, "User not found");

   user.geminiApiKeyCipher = encryptApiKey(key);
   user.geminiKeyStatus = "active";
   user.geminiKeyCooldownUntil = null;
   user.geminiKeyUsageDate = todayStamp();
   user.geminiKeyUsageCount = 0;
   await user.save({ validateBeforeSave: false });

   // Tail shown exactly once, at save time — never again, never stored.
   return res.status(200).json(
      new ApiResponse(
         200,
         {
            present: true,
            masked: maskedKey(key),
            status: "active",
            cooldownUntil: null,
            usageToday: 0,
            verified: ping === true,
         },
         ping === true ? "Gemini key saved and verified" : "Gemini key saved (could not verify — check it works)"
      )
   );
});

const deleteGeminiKey = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(req.user._id, {
      $unset: {
         geminiApiKeyCipher: "",
         geminiKeyCooldownUntil: "",
         geminiKeyUsageDate: "",
      },
      $set: { geminiKeyStatus: null, geminiKeyUsageCount: 0 },
   });
   return res.status(200).json(new ApiResponse(200, { present: false }, "Gemini key removed"));
});

export { getGeminiKey, setGeminiKey, deleteGeminiKey };
