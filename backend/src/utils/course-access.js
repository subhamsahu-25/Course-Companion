// utils/course-access.js
//
// Shared enrollment logic for the join-code system. A course's materials,
// Q&A, and review queue are only reachable by: the course's own
// instructor, any admin, or a user who has joined via the course's
// joinCode (added to `students` or `tas` accordingly). Every controller
// that reads course-scoped data should go through hasCourseAccess/
// assertCourseAccess rather than re-deriving this logic itself.

import { ApiError } from "./api-error.js";

const STAFF_ROLES = new Set(["admin"]);

function hasCourseAccess(course, user) {
   if (!user) return false;
   if (STAFF_ROLES.has(user.role)) return true;
   if (course.instructor?.toString() === user._id.toString()) return true;

   const userId = user._id.toString();
   if (user.role === "student") {
      return course.students?.some((id) => id.toString() === userId) ?? false;
   }
   if (user.role === "ta") {
      return course.tas?.some((id) => id.toString() === userId) ?? false;
   }
   // Other instructors (not the owner) currently keep the platform-wide
   // visibility that existed before join codes — unchanged from prior
   // behavior, just centralized here.
   return user.role === "instructor";
}

function assertCourseAccess(course, user) {
   if (!hasCourseAccess(course, user)) {
      throw new ApiError(
         403,
         "You need to join this course with its code before you can access it."
      );
   }
}

// Generates a unique 5-digit numeric join code (as a string, so a leading
// zero is preserved). Retries on the rare collision instead of trusting a
// single random draw against the unique index.
async function generateUniqueJoinCode(Course) {
   for (let attempt = 0; attempt < 10; attempt++) {
      const code = String(Math.floor(10000 + Math.random() * 90000));
      const existing = await Course.findOne({ joinCode: code }).lean();
      if (!existing) return code;
   }
   throw new ApiError(500, "Could not generate a unique join code, please try again.");
}

export { hasCourseAccess, assertCourseAccess, generateUniqueJoinCode };
