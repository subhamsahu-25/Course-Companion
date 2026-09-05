// routes/course.route.js
import { Router } from "express";
const router = Router();

import {
   createCourse,
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
} from "../validators/course.validator.js";

// public — anyone can browse published courses
router.route("/").get(getAllCourses);
router.route("/:id").get(courseIdParamValidator(), validate, getCourseById);

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
      createCourseValidator(),
      validate,
      updateCourse
   )
   .delete(authGuard, roleGuard("instructor", "admin"), courseIdParamValidator(), validate, deleteCourse);

export default router;