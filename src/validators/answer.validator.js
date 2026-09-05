import { body, param } from "express-validator";

const createAnswerValidator = () => {
   return [
      body("question")
         .notEmpty()
         .withMessage("Question id is required")
         .isMongoId()
         .withMessage("Invalid question id"),

      body("text")
         .trim()
         .notEmpty()
         .withMessage("Answer text is required"),

      body("isCorrect")
         .optional()
         .isBoolean()
         .withMessage("isCorrect must be a boolean"),
   ]
}

// mirrors VALID_TRANSITIONS in services/answerWorkflow.js —
// keep this list in sync if you add new statuses
const answerStatusValidator = () => {
   return [
      param("id")
         .isMongoId()
         .withMessage("Invalid answer id"),

      body("status")
         .trim()
         .notEmpty()
         .withMessage("Status is required")
         .isIn(["draft", "reviewed", "published"])
         .withMessage("Status must be one of: draft, reviewed, published"),
   ]
}

export { createAnswerValidator, answerStatusValidator };