import { body } from "express-validator";

// runs AFTER multer, so req.file already exists by validation time —
// this checks the text fields that travel alongside the file in the multipart body
const createDocumentValidator = () => {
   return [
      body("title")
         .trim()
         .optional() // falls back to original filename if omitted
         .isLength({ max: 150 })
         .withMessage("Title must not exceed 150 characters"),

      body("type")
         .optional()
         .isIn(["pdf", "video", "article", "slides", "link", "other"])
         .withMessage("Invalid document type"),
   ]
}

// separate check for the file itself — express-validator has no native multer hook,
// so this runs as a plain middleware, not a body() chain
const validateUploadedFile = (req, res, next) => {
   if (!req.file) {
      throw new ApiError(422, "validation failed for the incoming data", [
         { file: "A file is required" },
      ]);
   }
   next();
}

export { createDocumentValidator, validateUploadedFile };