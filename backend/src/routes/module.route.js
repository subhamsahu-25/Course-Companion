// routes/module.route.js
import { Router } from "express";
const router = Router();

import {
   createModule,
   getModulesByCourse,
   getModuleById,
   updateModule,
   deleteModule,
} from "../controllers/module.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

import {
   createModuleValidator,
   moduleIdParamValidator,
} from "../validators/module.validator.js";
import { courseIdParamValidator } from "../validators/course.validator.js";

router.route("/course/:id").get(authGuard, courseIdParamValidator(), validate, getModulesByCourse);
router.route("/:moduleId").get(authGuard, moduleIdParamValidator(), validate, getModuleById);

// secure writes
router
   .route("/")
   .post(authGuard, roleGuard("instructor", "admin"), createModuleValidator(), validate, createModule);

router
   .route("/:moduleId")
   .patch(
      authGuard,
      roleGuard("instructor", "admin"),
      moduleIdParamValidator(),
      validate,
      updateModule
   )
   .delete(authGuard, roleGuard("instructor", "admin"), moduleIdParamValidator(), validate, deleteModule);

export default router;