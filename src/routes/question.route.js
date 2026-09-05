// routes/question.route.js
import { Router } from "express";
const router = Router();

import {
   createQuestion,
   getQuestionFeed,
   getQuestionById,
   updateQuestion,
   deleteQuestion,
} from "../controllers/question.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

import {
   createQuestionValidator,
   questionFeedQueryValidator,
} from "../validators/question.validator.js";

// feed — requires login so req.user.role can gate answer visibility,
// but any authenticated role (student included) can read it
router.route("/feed").get(authGuard, questionFeedQueryValidator(), validate, getQuestionFeed);

router.route("/:id").get(authGuard, getQuestionById);

// secure writes
router
   .route("/")
   .post(authGuard, roleGuard("instructor", "admin"), createQuestionValidator(), validate, createQuestion);

router
   .route("/:id")
   .patch(authGuard, roleGuard("instructor", "admin"), createQuestionValidator(), validate, updateQuestion)
   .delete(authGuard, roleGuard("instructor", "admin"), deleteQuestion);

export default router;