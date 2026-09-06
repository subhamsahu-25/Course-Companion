// controllers/course.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Course } from "../models/course.model.js";
import { Module } from "../models/module.model.js";
import { Question } from "../models/question.model.js";
import { Document } from "../models/document.model.js";
import { Answer } from "../models/answer.model.js";

const createCourse = asyncHandler(async (req, res) => {
   const { title, description, tags } = req.body;

   const slug = title.trim().toLowerCase().replace(/\s+/g, "-");

   const existing = await Course.findOne({ slug });
   if (existing) {
      throw new ApiError(409, "A course with this title already exists");
   }

   const course = await Course.create({
      title,
      slug,
      description,
      tags,
      instructor: req.user._id,
   });

   return res
      .status(201)
      .json(new ApiResponse(201, course, "Course created successfully"));
});

const getAllCourses = asyncHandler(async (req, res) => {
   const filter = {};
   if (!["admin", "instructor", "ta"].includes(req.user?.role)) {
      filter.isPublished = true;
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

   course.isDeleted = true;
   course.deletedAt = new Date();
   await course.save();

   const now = new Date();
   const moduleIds = await Module.find({ course: course._id }).distinct("_id");
   const questionIds = await Question.find({ module: { $in: moduleIds } }).distinct("_id");

   await Promise.all([
      Module.updateMany({ _id: { $in: moduleIds } }, { isDeleted: true, deletedAt: now }),
      Question.updateMany({ _id: { $in: questionIds } }, { isDeleted: true, deletedAt: now }),
      Document.updateMany({ module: { $in: moduleIds } }, { isDeleted: true, deletedAt: now }),
      Answer.updateMany({ question: { $in: questionIds } }, { isDeleted: true, deletedAt: now }),
   ]);

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Course deleted successfully"));
});

export {
   createCourse,
   getAllCourses,
   getCourseById,
   updateCourse,
   deleteCourse,
};