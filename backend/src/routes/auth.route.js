import { Router } from "express";
const router = Router();

import {
   registerUser,
   loginUser,
   logoutUser,
   getCurrentUser,
   updateProfile,
   updateAvatar,
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
   userResetForgotPasswordValidator,
   userResendEmailVerificationValidator,
   userUpdateProfileValidator
} from "../validators/auth.validator.js";
import { avatarUpload } from "../middlewares/avatar-upload.middleware.js";
import { handleUpload } from "../middlewares/handle-upload-errors.middleware.js";

// unsecure routes
router.route("/register").post(userRegisterValidator(), validate, registerUser);

router.route("/login").post(userLoginValidator(), validate, loginUser);

router.route("/verify-email/:verificationToken").get(verifyEmail);

// Public on purpose: unverified users have no session, so they can't pass
// authGuard — and blocking resend behind login would permanently lock out
// anyone who lost their verification email.
router.route("/resend-email-verification").post(userResendEmailVerificationValidator(), validate, resendEmailVerification);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPasswordRequest);

router.route("/reset-password/:resetToken").post(userResetForgotPasswordValidator(), validate, resetForgotPassword);


// secure routes (always after authGuard middleware)
router.route("/logout").post(authGuard, logoutUser);

router.route("/current-user").post(authGuard, getCurrentUser);

router.route("/change-password").post(authGuard, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);

router.route("/profile").patch(authGuard, userUpdateProfileValidator(), validate, updateProfile);

router
   .route("/avatar")
   .post(authGuard, handleUpload(avatarUpload.single("avatar")), updateAvatar);

export default router;