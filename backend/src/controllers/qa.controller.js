// backend/src/controllers/qa.controller.js — update askQuestion, add getStats
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Module } from "../models/module.model.js";
import { Course } from "../models/course.model.js";
import * as ragService from "../services/rag.service.js";
import { assertCourseAccess } from "../utils/course-access.js";

const askQuestion = asyncHandler(async (req, res) => {
   const { question, moduleId } = req.body;
   if (!question) throw new ApiError(400, "Question is required");
   if (!moduleId) throw new ApiError(400, "A module is required");

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   // Trust the server's own membership check here, not just the fact that
   // the client sent a moduleId — otherwise the module dropdown is only a
   // UI nicety and anyone could still submit questions against courses
   // they were never given the join code for.
   assertCourseAccess(module.course, req.user);

   const result = await ragService.submitQuestion(req.user._id.toString(), question, moduleId);
   return res.status(200).json(new ApiResponse(200, result, "Question submitted for review"));
});

const getReviewQueue = asyncHandler(async (req, res) => {
   const queue = await ragService.getReviewQueue();

   // Admins oversee every course, same as elsewhere in the app — no
   // filtering needed for them.
   if (req.user.role === "admin") {
      return res.status(200).json(new ApiResponse(200, queue, "Review queue fetched"));
   }

   // TAs only review questions for courses they've joined. Previously this
   // endpoint had no course scoping at all — any TA saw every pending
   // question platform-wide, regardless of which course(s) they actually
   // belonged to.
   const moduleIds = [...new Set(queue.map((item) => item.moduleId).filter(Boolean))];
   const modules = await Module.find({ _id: { $in: moduleIds } })
      .populate("course")
      .lean();

   const taId = req.user._id.toString();
   const accessibleModuleIds = new Set(
      modules
         .filter((m) => m.course?.tas?.some((id) => id.toString() === taId))
         .map((m) => m._id.toString())
   );

   const filtered = queue.filter(
      (item) => item.moduleId && accessibleModuleIds.has(item.moduleId)
   );

   return res.status(200).json(new ApiResponse(200, filtered, "Review queue fetched"));
});

const approveQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { editedAnswer } = req.body;
   const result = await ragService.approveAnswer(id, editedAnswer);
   return res.status(200).json(new ApiResponse(200, result, "Answer approved"));
});

const rejectQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { note } = req.body;
   const result = await ragService.rejectAnswer(id, note);
   return res.status(200).json(new ApiResponse(200, result, "Answer rejected"));
});

const getMyAnswer = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const result = await ragService.getMyAnswer(id);
   return res.status(200).json(new ApiResponse(200, result, "Answer status fetched"));
});

const getMyAnswers = asyncHandler(async (req, res) => {
   const result = await ragService.getMyAnswers(req.user._id.toString());
   return res.status(200).json(new ApiResponse(200, result, "Answers fetched"));
});

const getStats = asyncHandler(async (req, res) => {
   // rag's own /stats/:id is a flat count over every question this
   // student has ever asked, with no idea what a "course" is. That's what
   // made the dashboard show all-time numbers even for courses the
   // student isn't in (or isn't in anymore) — so instead, pull the raw
   // list and scope it down to their current enrollments here.
   const items = await ragService.getMyAnswers(req.user._id.toString());

   const moduleIds = [...new Set(items.map((item) => item.moduleId).filter(Boolean))];
   const modules = await Module.find({ _id: { $in: moduleIds } }).lean();
   const moduleToCourse = new Map(modules.map((m) => [m._id.toString(), m.course.toString()]));

   const candidateCourseIds = [...new Set(moduleToCourse.values())];
   const myCourses = await Course.find({
      _id: { $in: candidateCourseIds },
      students: req.user._id,
   }).lean();
   const myCourseIds = new Set(myCourses.map((c) => c._id.toString()));

   const scoped = items.filter((item) => {
      const courseId = item.moduleId && moduleToCourse.get(item.moduleId);
      return courseId && myCourseIds.has(courseId);
   });

   const stats = {
      total: scoped.length,
      pending: scoped.filter((i) => i.status === "pending").length,
      approved: scoped.filter((i) => i.status === "approved").length,
      rejected: scoped.filter((i) => i.status === "rejected").length,
   };

   return res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
});

const getModuleHistory = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   // Same enrollment check as everywhere else — a TA can only pull
   // history for a module in a course they've actually joined.
   assertCourseAccess(module.course, req.user);

   const history = await ragService.getModuleHistory(moduleId);
   return res.status(200).json(new ApiResponse(200, history, "Module history fetched"));
});

export {
   askQuestion,
   getReviewQueue,
   approveQuestion,
   rejectQuestion,
   getMyAnswer,
   getMyAnswers,
   getStats,
   getModuleHistory,
};