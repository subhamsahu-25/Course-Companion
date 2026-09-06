// controllers/module.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Module } from "../models/module.model.js";
import { Course } from "../models/course.model.js";

const createModule = asyncHandler(async (req, res) => {
   const { title, description, course: courseId, order } = req.body;

   const course = await Course.findById(courseId);
   if (!course) {
      throw new ApiError(404, "Course not found");
   }

   if (
      req.user.role !== "admin" &&
      course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to add modules to this course");
   }

   const module = await Module.create({
      title,
      description,
      course: courseId,
      order: order ?? 0,
   });

   // keep Course.modules array in sync
   course.modules.push(module._id);
   await course.save();

   return res
      .status(201)
      .json(new ApiResponse(201, module, "Module created successfully"));
});

const getModulesByCourse = asyncHandler(async (req, res) => {
   const { id: courseId } = req.params;

   const modules = await Module.find({ course: courseId })
      .sort({ order: 1 })
      .populate({ path: "documents", options: { sort: { order: 1 } } })
      .lean();

   return res
      .status(200)
      .json(new ApiResponse(200, modules, "Modules fetched successfully"));
});

const getModuleById = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const module = await Module.findById(moduleId)
      .populate({ path: "documents", options: { sort: { order: 1 } } })
      .populate({ path: "questions", options: { sort: { order: 1 } } });

   if (!module) {
      throw new ApiError(404, "Module not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, module, "Module fetched successfully"));
});

const updateModule = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;
   const { title, description, order, isPublished } = req.body;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) {
      throw new ApiError(404, "Module not found");
   }

   if (
      req.user.role !== "admin" &&
      module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to edit this module");
   }

   if (title !== undefined) module.title = title;
   if (description !== undefined) module.description = description;
   if (order !== undefined) module.order = order;
   if (isPublished !== undefined) module.isPublished = isPublished;

   await module.save();

   return res
      .status(200)
      .json(new ApiResponse(200, module, "Module updated successfully"));
});

const deleteModule = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) {
      throw new ApiError(404, "Module not found");
   }

   if (
      req.user.role !== "admin" &&
      module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to delete this module");
   }

   await Course.findByIdAndUpdate(module.course._id, {
      $pull: { modules: module._id },
   });

   await module.deleteOne();

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Module deleted successfully"));
});

export {
   createModule,
   getModulesByCourse,
   getModuleById,
   updateModule,
   deleteModule,
};