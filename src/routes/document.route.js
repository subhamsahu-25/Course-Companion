// routes/document.route.js
import { Router } from "express";
const router = Router();

import {
   uploadDocument,
   getDocumentsByModule,
   getDocumentById,
   deleteDocument,
} from "../controllers/document.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { handleUpload } from "../middlewares/handle-upload-errors.middleware.js";

import {
   createDocumentValidator,
   validateUploadedFile,
} from "../validators/document.validator.js";
import { moduleIdParamValidator } from "../validators/module.validator.js";

// public reads
router.route("/module/:moduleId").get(moduleIdParamValidator(), validate, getDocumentsByModule);
router.route("/:id").get(getDocumentById);

// secure — upload requires instructor/admin
router
   .route("/module/:moduleId")
   .post(
      authGuard,
      roleGuard("instructor", "admin"),
      moduleIdParamValidator(),
      validate,
      handleUpload(upload.single("file")),
      validateUploadedFile,
      createDocumentValidator(),
      validate,
      uploadDocument
   );

router.route("/:id").delete(authGuard, roleGuard("instructor", "admin"), deleteDocument);

export default router;