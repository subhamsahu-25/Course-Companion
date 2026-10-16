// utils/course-access.js
//
// Shared enrollment logic for the join-code system. A course's materials,
// Q&A, and review queue are only reachable by: the course's own
// instructor, any admin, or a user who has joined via the course's
// joinCode (added to `students` or `tas` accordingly). Instructors never
// see another instructor's courses. Every controller that reads
// course-scoped data should go through hasCourseAccess/
// assertCourseAccess (or accessibleCourseFilter for list endpoints)
// rather than re-deriving this logic itself.

import { ApiError } from "./api-error.js";

const STAFF_ROLES = new Set(["admin"]);

// Member entries may be plain ObjectIds OR populated user documents
// (getCourseById populates students/tas/instructor for display). A
// populated doc's toString() is NOT its id, so unwrap _id first —
// otherwise joined members fail their own membership check.
function idString(id) {
   if (!id) return "";
   return (id._id ?? id).toString();
}

function hasCourseAccess(course, user) {
   if (!user) return false;
   if (STAFF_ROLES.has(user.role)) return true;
   if (idString(course.instructor) === user._id.toString()) return true;

   const userId = user._id.toString();
   if (user.role === "student") {
      return course.students?.some((id) => idString(id) === userId) ?? false;
   }
   if (user.role === "ta") {
      return course.tas?.some((id) => idString(id) === userId) ?? false;
   }
   // Instructors see only courses they own — a non-owner instructor has no
   // access here (strict ownership; there is no co-teaching or join path
   // for instructors). Admins bypass via STAFF_ROLES above.
   return false;
}

// Mongoose filter matching list-endpoint visibility: students see
// published member courses, TAs member courses, instructors only courses
// they own, admins everything. Single source so getAllCourses,
// getMyModules, and the question feed can't drift apart.
function accessibleCourseFilter(user) {
   if (!user) return { _id: null };
   if (user.role === "student") return { isPublished: true, students: user._id };
   if (user.role === "ta") return { tas: user._id };
   if (user.role === "instructor") return { instructor: user._id };
   return {};
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

export { hasCourseAccess, assertCourseAccess, generateUniqueJoinCode, accessibleCourseFilter };
