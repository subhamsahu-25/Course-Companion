// routes/course.route.js
import { Router } from "express";
const router = Router();

import {
   createCourse,
   joinCourseByCode,
   getAllCourses,
   getCourseById,
   updateCourse,
   deleteCourse,
} from "../controllers/course.controller.js";

import { authGuard, roleGuard } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

import {
   createCourseValidator,
   courseIdParamValidator,
   updateCourseValidator
} from "../validators/course.validator.js";

// students/TAs must join with a code first — see getAllCourses /
// getCourseById in the controller for the enrollment check.
router.route("/").get(authGuard, getAllCourses);
router.route("/:id").get(authGuard, courseIdParamValidator(), validate, getCourseById);

router.route("/join").post(authGuard, joinCourseByCode);

// secure — instructor/admin only
router
   .route("/")
   .post(authGuard, roleGuard("instructor", "admin"), createCourseValidator(), validate, createCourse);

router
   .route("/:id")
   .patch(
      authGuard,
      roleGuard("instructor", "admin"),
      courseIdParamValidator(),
      updateCourseValidator(),
      validate,
      updateCourse
   )
   .delete(authGuard, roleGuard("instructor", "admin"), courseIdParamValidator(), validate, deleteCourse);

export default router;