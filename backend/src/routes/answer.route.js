// routes/answer.route.js
import { Router } from "express";
const router = Router();

import {
   createAnswer,
   getAnswersByQuestion,
   updateAnswerStatus,
   updateAnswerContent,
   deleteAnswer,
} from "../controllers/answer.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

import {
   createAnswerValidator,
   answerStatusValidator,
} from "../validators/answer.validator.js";

router.route("/question/:questionId").get(authGuard, getAnswersByQuestion);

// secure — create/edit content requires instructor/admin
router
   .route("/")
   .post(authGuard, roleGuard("instructor", "admin"), createAnswerValidator(), validate, createAnswer);

router
   .route("/:id")
   .patch(authGuard, roleGuard("instructor", "admin"), updateAnswerContent)
   .delete(authGuard, roleGuard("instructor", "admin"), deleteAnswer);

// status transitions — draft -> reviewed -> published
// note: reviewer/admin can move to "reviewed"; publishing might warrant a stricter
// role check (e.g. admin-only) depending on your actual role list — adjust as needed
router
   .route("/:id/status")
   .patch(authGuard, roleGuard("reviewer", "admin"), answerStatusValidator(), validate, updateAnswerStatus);

export default router;