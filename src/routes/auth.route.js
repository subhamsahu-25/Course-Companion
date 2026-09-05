import { Router } from "express";
const router = Router();

import {
   registerUser,
   loginUser,
   logoutUser,
   getCurrentUser,
   verifyEmail,
   resendEmailVerification,
   refreshAccessToken,
   forgotPasswordRequest,
   resetForgotPassword,
   changeCurrentPassword
} from "../controllers/auth.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

import {
   userRegisterValidator,
   userLoginValidator,
   userChangeCurrentPasswordValidator,
   userForgotPasswordValidator,
   userResetForgotPasswordValidator
} from "../validators/auth.validator.js";

// unsecure routes
router.route("/register").post(userRegisterValidator(), validate, registerUser);

router.route("/login").post(userLoginValidator(), validate, loginUser);

router.route("/verify-email/:verificationToken").get(verifyEmail);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPasswordRequest);

router.route("/reset-password/:resetToken").post(userResetForgotPasswordValidator(), validate, resetForgotPassword);


// secure routes (always after authGuard middleware)
router.route("/logout").post(authGuard, logoutUser);

router.route("/current-user").post(authGuard, getCurrentUser);

router.route("/change-password").post(authGuard, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);

router.route("/resend-email-verification").post(authGuard, resendEmailVerification);

export default router;