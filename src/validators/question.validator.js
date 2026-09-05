import { query, body } from "express-validator";

const questionFeedQueryValidator = () => {
   return [
      query("limit")
         .optional()
         .isInt({ min: 1, max: 100 })
         .withMessage("Limit must be between 1 and 100"),

      query("cursor")
         .optional()
         .isMongoId()
         .withMessage("Invalid cursor"),

      query("module")
         .optional()
         .isMongoId()
         .withMessage("Invalid module id"),
   ]
}

const createQuestionValidator = () => {
   return [
      body("module")
         .notEmpty()
         .withMessage("Module id is required")
         .isMongoId()
         .withMessage("Invalid module id"),

      body("text")
         .trim()
         .notEmpty()
         .withMessage("Question text is required"),

      body("type")
         .optional()
         .isIn(["single-choice", "multiple-choice", "true-false", "short-answer"])
         .withMessage("Invalid question type"),

      body("points")
         .optional()
         .isInt({ min: 1 })
         .withMessage("Points must be a positive integer"),
   ]
}

export { questionFeedQueryValidator, createQuestionValidator };