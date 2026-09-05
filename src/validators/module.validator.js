import { body, param } from "express-validator";

const createModuleValidator = () => {
   return [
      body("title")
         .trim()
         .notEmpty()
         .withMessage("Title is required"),

      body("course")
         .trim()
         .notEmpty()
         .withMessage("Course id is required")
         .isMongoId()
         .withMessage("Invalid course id"),

      body("order")
         .optional()
         .isInt({ min: 0 })
         .withMessage("Order must be a non-negative integer"),
   ]
}

const moduleIdParamValidator = () => {
   return [
      param("moduleId")
         .isMongoId()
         .withMessage("Invalid module id"),
   ]
}

export { createModuleValidator, moduleIdParamValidator };