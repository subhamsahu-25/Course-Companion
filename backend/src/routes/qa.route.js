// backend/src/routes/qa.route.js — add the stats route
import { Router } from "express";
const router = Router();

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import {
   askQuestion,
   getRelatedQuestions,
   getReviewQueue,
   approveQuestion,
   rejectQuestion,
   toggleImportant,
   getImportantQuestions,
   getCourseQaStats,
   getMyAnswer,
   getMyAnswers,
   getStats,
   getModuleHistory,
} from "../controllers/qa.controller.js";

router.route("/ask").post(authGuard, askQuestion);
router.route("/related").get(authGuard, getRelatedQuestions);
router.route("/my-answer/:id").get(authGuard, getMyAnswer);
router.route("/my-answers").get(authGuard, getMyAnswers);
router.route("/stats").get(authGuard, getStats);

router.route("/queue").get(authGuard, roleGuard("ta", "admin"), getReviewQueue);
router.route("/queue/:id/approve").post(authGuard, roleGuard("ta", "admin"), approveQuestion);
router.route("/queue/:id/reject").post(authGuard, roleGuard("ta", "admin"), rejectQuestion);
router.route("/queue/:id/important").post(authGuard, roleGuard("ta", "admin"), toggleImportant);
router.route("/history/:moduleId").get(authGuard, roleGuard("ta", "admin"), getModuleHistory);
// Instructor portal: highlighted questions + per-course activity. The
// instructor of the course (or admin) only — course membership is checked
// inside the controllers.
router.route("/important").get(authGuard, roleGuard("instructor", "admin"), getImportantQuestions);
router.route("/course-stats").get(authGuard, roleGuard("instructor", "admin"), getCourseQaStats);

export default router;