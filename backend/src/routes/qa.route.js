// backend/src/routes/qa.route.js
import { Router } from "express";
const router = Router();

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import {
   askQuestion,
   getReviewQueue,
   approveQuestion,
   rejectQuestion,
   getMyAnswer,
} from "../controllers/qa.controller.js";

// students ask questions and check on their own submissions
router.route("/ask").post(authGuard, askQuestion);
router.route("/my-answer/:id").get(authGuard, getMyAnswer);

// TA/reviewer-only moderation
router.route("/queue").get(authGuard, roleGuard("reviewer", "admin"), getReviewQueue);
router.route("/queue/:id/approve").post(authGuard, roleGuard("reviewer", "admin"), approveQuestion);
router.route("/queue/:id/reject").post(authGuard, roleGuard("reviewer", "admin"), rejectQuestion);

export default router;