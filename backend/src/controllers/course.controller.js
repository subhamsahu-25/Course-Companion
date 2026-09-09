// controllers/course.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Course } from "../models/course.model.js";
import { Module } from "../models/module.model.js";
import { Question } from "../models/question.model.js";
import { Document } from "../models/document.model.js";
import { Answer } from "../models/answer.model.js";
import { assertCourseAccess, generateUniqueJoinCode } from "../utils/course-access.js";
import fs from "fs";
import path from "path";
import * as ragService from "../services/rag.service.js";

const createCourse = asyncHandler(async (req, res) => {
   const { title, description, tags } = req.body;

   const slug = title.trim().toLowerCase().replace(/\s+/g, "-");

   const existing = await Course.findOne({ slug });
   if (existing) {
      throw new ApiError(409, "A course with this title already exists");
   }

   const joinCode = await generateUniqueJoinCode(Course);

   const course = await Course.create({
      title,
      slug,
      description,
      tags,
      instructor: req.user._id,
      joinCode,
   });

   return res
      .status(201)
      .json(new ApiResponse(201, course, "Course created successfully"));
});

// Lets a student or TA self-enroll with the 5-digit code the
// instructor/admin shared with them. Which list they're added to
// (students vs tas) is decided by their existing account role — there's
// no separate "student code" vs "TA code".
const joinCourseByCode = asyncHandler(async (req, res) => {
   const { code } = req.body;

   if (!code || !/^\d{5}$/.test(code)) {
      throw new ApiError(400, "Enter the 5-digit course code.");
   }

   const course = await Course.findOne({ joinCode: code });
   if (!course) {
      throw new ApiError(404, "No course found with that code.");
   }

   const userId = req.user._id;

   if (req.user.role === "student") {
      if (!course.students.some((id) => id.toString() === userId.toString())) {
         course.students.push(userId);
         await course.save();
      }
   } else if (req.user.role === "ta") {
      if (!course.tas.some((id) => id.toString() === userId.toString())) {
         course.tas.push(userId);
         await course.save();
      }
   } else {
      // admin/instructor already have access without joining — treat as a
      // harmless no-op rather than an error, so the same form can't
      // confuse someone about whether it "worked".
   }

   return res
      .status(200)
      .json(new ApiResponse(200, course, `Joined "${course.title}"`));
});

const getAllCourses = asyncHandler(async (req, res) => {
   const filter = {};

   // Students and TAs only ever see courses they've joined with a code —
   // "published" alone no longer implies visible to everyone. Admins and
   // instructors keep seeing every course, same as before.
   if (req.user?.role === "student") {
      filter.isPublished = true;
      filter.students = req.user._id;
   } else if (req.user?.role === "ta") {
      filter.tas = req.user._id;
   }

   const courses = await Course.find(filter)
      .populate("instructor", "username fullname")
      .sort({ createdAt: -1 })
      .lean();

   return res
      .status(200)
      .json(new ApiResponse(200, courses, "Courses fetched successfully"));
});

const getCourseById = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const course = await Course.findById(id)
      .populate("instructor", "username fullname")
      .populate({
         path: "modules",
         options: { sort: { order: 1 } },
      });

   if (!course) {
      throw new ApiError(404, "Course not found");
   }

   assertCourseAccess(course, req.user);

   return res
      .status(200)
      .json(new ApiResponse(200, course, "Course fetched successfully"));
});

const updateCourse = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { title, description, tags, isPublished } = req.body;

   const course = await Course.findById(id);
   if (!course) {
      throw new ApiError(404, "Course not found");
   }

   if (
      req.user.role !== "admin" &&
      course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to edit this course");
   }

   if (title !== undefined) {
      course.title = title;
      course.slug = title.trim().toLowerCase().replace(/\s+/g, "-");
   }
   if (description !== undefined) course.description = description;
   if (tags !== undefined) course.tags = tags;
   if (isPublished !== undefined) course.isPublished = isPublished;

   await course.save();

   return res
      .status(200)
      .json(new ApiResponse(200, course, "Course updated successfully"));
});

// A course deletion is a hard delete, cascading all the way down: the
// course, its modules, its documents (DB record + the file on disk + its
// Chroma vectors), and its Q&A history are all permanently removed —
// nothing is left behind for a student/TA to stumble onto later, and
// nothing lingers in the vector store to leak into unrelated answers.
const deleteCourse = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const course = await Course.findById(id);
   if (!course) {
      throw new ApiError(404, "Course not found");
   }

   if (
      req.user.role !== "admin" &&
      course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to delete this course");
   }

   const moduleIds = await Module.find({ course: course._id }).distinct("_id");
   const documents = await Document.find({ module: { $in: moduleIds } });

   // Remove each document's file off disk and its vectors out of Chroma.
   // Best-effort per document — one missing file or an unreachable rag
   // service shouldn't block deleting everything else.
   await Promise.all(
      documents.map(async (doc) => {
         if (doc.url) {
            const filePath = path.resolve("uploads", path.basename(doc.url));
            try {
               await fs.promises.unlink(filePath);
            } catch (err) {
               if (err.code !== "ENOENT") {
                  console.error(`Failed to delete file for document ${doc._id}:`, err.message);
               }
            }
         }

         if (doc.isIndexed) {
            try {
               await ragService.removeIngestedDocument(doc._id.toString());
            } catch (err) {
               console.error(`Failed to remove vectors for document ${doc._id}:`, err.message);
            }
         }
      })
   );

   // The Q&A history (ReviewQueueItem) lives in the rag service's own
   // MongoDB connection, keyed by moduleId — the backend can't delete it
   // directly, so ask the rag service to purge it.
   if (moduleIds.length > 0) {
      try {
         await ragService.purgeReviewQueueForModules(moduleIds.map((mid) => mid.toString()));
      } catch (err) {
         console.error(`Failed to purge review queue for course ${course._id}:`, err.message);
      }
   }

   const questionIds = await Question.find({ module: { $in: moduleIds } }).distinct("_id");

   await Promise.all([
      Answer.deleteMany({ question: { $in: questionIds } }),
      Question.deleteMany({ module: { $in: moduleIds } }),
      Document.deleteMany({ module: { $in: moduleIds } }),
      Module.deleteMany({ _id: { $in: moduleIds } }),
   ]);

   await Course.deleteOne({ _id: course._id });

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Course deleted permanently !"));
});

export {
   createCourse,
   joinCourseByCode,
   getAllCourses,
   getCourseById,
   updateCourse,
   deleteCourse,
};