// backend/src/routes/qa.route.js — add the stats route
import { Router } from "express";
const router = Router();

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import {
   askQuestion,
   getReviewQueue,
   approveQuestion,
   rejectQuestion,
   getMyAnswer,
   getMyAnswers,
   getStats,
   getModuleHistory,
} from "../controllers/qa.controller.js";

router.route("/ask").post(authGuard, askQuestion);
router.route("/my-answer/:id").get(authGuard, getMyAnswer);
router.route("/my-answers").get(authGuard, getMyAnswers);
router.route("/stats").get(authGuard, getStats);

router.route("/queue").get(authGuard, roleGuard("ta", "admin"), getReviewQueue);
router.route("/queue/:id/approve").post(authGuard, roleGuard("ta", "admin"), approveQuestion);
router.route("/queue/:id/reject").post(authGuard, roleGuard("ta", "admin"), rejectQuestion);
router.route("/history/:moduleId").get(authGuard, roleGuard("ta", "admin"), getModuleHistory);

export default router;