// middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { User } from "../models/user.model.js";

// Verifies the JWT sent by the client and attaches the authenticated
// user document to req.user so downstream controllers/middleware can use it.
const authGuard = asyncHandler(async (req, res, next) => {
   const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

   if (!token) {
      throw new ApiError(401, "Unauthorized request — no token provided");
   }

   // jwt.verify throws JsonWebTokenError / TokenExpiredError on bad/expired tokens.
   // We don't catch it here — it propagates to asyncHandler → errorHandler,
   // which already knows how to map those error names to a 401 response.
   const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

   const user = await User.findById(decoded._id).select("-password -refreshToken");

   if (!user) {
      throw new ApiError(401, "Invalid access token — user no longer exists");
   }

   req.user = user;
   next();
});

// Restricts a route to specific roles. Must run AFTER authGuard,
// since it depends on req.user already being set.
//
// Usage: roleGuard("admin"), roleGuard("instructor", "admin"), etc.
const roleGuard = (...allowedRoles) => {
   return (req, res, next) => {
      if (!req.user) {
         throw new ApiError(401, "Unauthorized request");
      }

      if (!allowedRoles.includes(req.user.role)) {
         throw new ApiError(
            403,
            `Role '${req.user.role}' is not permitted to perform this action`
         );
      }

      next();
   };
};

export { authGuard, roleGuard };