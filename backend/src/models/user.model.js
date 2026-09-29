import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// AVAILABLE USER ROLES
export const AvailableUserRoles = {
   ADMIN: "admin",
   INSTRUCTOR: "instructor",
   TA: "ta",
   STUDENT: "student",
};
// MONGOOSE SCHEMA FOR USER MODEL 
const userSchema = new Schema(
   {
      role: {
         type: String,
         enum: Object.values(AvailableUserRoles),
         default: AvailableUserRoles.STUDENT,
         required: true,
      },
      username: {
         type: String,
         required: true,
         unique: true,
         lowercase: true,
         trim: true,
         index: true
      },
      email: {
         type: String,
         required: true,
         unique: true,
         lowercase: true,
         trim: true
      },
      fullName: {
         type: String,
         trim: true
      },
      // Student/TA roll number, collected at signup. Optional at the schema
      // level so pre-existing accounts (created before this field existed)
      // keep working — signup validation requires it for new accounts.
      rollNo: {
         type: String,
         trim: true
      },
      avatar: {
         type: String,
         trim: true
      },
      password: {
         type: String,
         required: [true, "Password is required"],
      },
      isEmailVerified: {
         type: Boolean,
         default: false
      },
      refreshToken: {
         type: String
      },
      forgotPasswordToken: {
         type: String
      },
      forgotPasswordExpiry: {
         type: Date
      },
      emailVerificationToken: {
         type: String
      },
      emailVerificationExpiry: {
         type: Date
      },
      // User-supplied Gemini API key (BYOK hybrid) — AES-256-GCM blob,
      // NEVER plaintext. Funds that user's own premium answers; the
      // shared quota stays the fallback. See utils/keyvault.js — this
      // field must never leave the server (no API response, no logs).
      geminiApiKeyCipher: {
         type: String,
         default: null,
      },
      geminiKeyStatus: {
         type: String,
         enum: ["active", "exhausted", "invalid", null],
         default: null,
      },
      geminiKeyCooldownUntil: {
         type: Date,
         default: null,
      },
      // Approximate daily meter (our own call count — Google offers no
      // per-key quota API). Resets when the calendar day rolls over.
      geminiKeyUsageDate: {
         type: String,
         default: null,
      },
      geminiKeyUsageCount: {
         type: Number,
         default: 0,
      },
   },
   {
      timestamps: true
   }
);

// MONGOOSE HOOKS - USED IT HERE TO HASH THE PASSWORD ONLY WHEN IT IS BEING CHANGED OR RESETED.
userSchema.pre("save", async function () {
   if (!this.isModified("password")) return;
   this.password = await bcrypt.hash(this.password, 10);
});

// MONGOOSE METHODS - USED IT HERE TO COMPARE THE PASSWORD
userSchema.methods.isPasswordCorrect = async function (password) {
   return await bcrypt.compare(password, this.password);
}

// MONGOOSE METHODS - USED IT HERE TO GENERATE ACCESS TOKEN
userSchema.methods.generateAccessToken = function () {
   return jwt.sign(
      {
         _id: this._id,
         email: this.email,
         username: this.username,
         role: this.role
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
         expiresIn: process.env.ACCESS_TOKEN_EXPIRY
      }
   )
};

// MONGOOSE METHODS - USED IT HERE TO GENERATE REFRESH TOKEN
userSchema.methods.generateRefreshToken = function () {
   return jwt.sign(
      {
         _id: this._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
         expiresIn: process.env.REFRESH_TOKEN_EXPIRY
      }
   )
};

// MONGOOSE METHODS - USED IT HERE TO GENERATE TEMPORARY TOKEN - USED FOR PASSWORD RESET, VERIFYING THE USER
userSchema.methods.generateTemporaryToken = function () {
   const unHashedToken = crypto
      .randomBytes(20)
      .toString("hex");

   const hashedToken = crypto
      .createHash("sha256")
      .update(unHashedToken)
      .digest("hex");

   const tokenExpiry = Date.now() + (20 * 60 * 1000);

   return {
      hashedToken,
      tokenExpiry,
      unHashedToken
   };
}

export const User = mongoose.model("User", userSchema); 