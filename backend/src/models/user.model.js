import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// AVAILABLE USER ROLES
export const AvailableUserRoles = {
   ADMIN: "admin",
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
      }
   },
   {
      timestamps: true
   }
);

// MONGOOSE HOOKS - USED IT HERE TO HASH THE PASSWORD ONLY WHEN IT IS BEING CHANGED OR RESETED.
userSchema.pre("save", async function (next) {
   if (!this.isModified("password"))
      return next();
   this.password = await bcrypt.hash(this.password, 10);
   next();
})

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