import { body, param } from "express-validator";

const createCourseValidator = () => {
   return [
      body("title")
         .trim()
         .notEmpty()
         .withMessage("Title is required")
         .isLength({ min: 3, max: 100 })
         .withMessage("Title must be between 3 and 100 characters"),

      body("description")
         .trim()
         .optional()
         .isLength({ max: 1000 })
         .withMessage("Description must not exceed 1000 characters"),

      body("tags")
         .optional()
         .isArray()
         .withMessage("Tags must be an array")
   ]
}

const courseIdParamValidator = () => {
   return [
      param("id")
         .isMongoId()
         .withMessage("Invalid course id"),
   ]
}

export { createCourseValidator, courseIdParamValidator };