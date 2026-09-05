// controllers/question.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Question } from "../models/question.model.js";
import { Module } from "../models/module.model.js";

const createQuestion = asyncHandler(async (req, res) => {
   const { module: moduleId, text, type, points } = req.body;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) {
      throw new ApiError(404, "Module not found");
   }

   if (
      req.user.role !== "admin" &&
      module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to add questions to this module");
   }

   const question = await Question.create({
      module: moduleId,
      text,
      type,
      points,
   });

   module.questions.push(question._id);
   await module.save();

   return res
      .status(201)
      .json(new ApiResponse(201, question, "Question created successfully"));
});

// cursor-based pagination — see earlier explanation for why over offset-based
const getQuestionFeed = asyncHandler(async (req, res) => {
   const limit = Math.min(parseInt(req.query.limit) || 20, 100);
   const { cursor, module } = req.query;

   const filter = {};
   if (module) filter.module = module;
   if (cursor) filter._id = { $lt: cursor };

   const questions = await Question.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
         path: "answers",
         // students should only ever see published answers/options
         match: req.user?.role === "student" ? { status: "published" } : {},
      })
      .lean();

   const hasMore = questions.length > limit;
   const results = hasMore ? questions.slice(0, limit) : questions;
   const nextCursor = hasMore ? results[results.length - 1]._id : null;

   return res.status(200).json(
      new ApiResponse(
         200,
         {
            data: results,
            pagination: { nextCursor, hasMore, limit },
         },
         "Question feed fetched successfully"
      )
   );
});

const getQuestionById = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const question = await Question.findById(id).populate("answers");
   if (!question) {
      throw new ApiError(404, "Question not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, question, "Question fetched successfully"));
});

const updateQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { text, type, points, order, explanation } = req.body;

   const question = await Question.findById(id).populate({
      path: "module",
      populate: { path: "course" },
   });
   if (!question) {
      throw new ApiError(404, "Question not found");
   }

   if (
      req.user.role !== "admin" &&
      question.module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to edit this question");
   }

   if (text !== undefined) question.text = text;
   if (type !== undefined) question.type = type;
   if (points !== undefined) question.points = points;
   if (order !== undefined) question.order = order;
   if (explanation !== undefined) question.explanation = explanation;

   await question.save();

   return res
      .status(200)
      .json(new ApiResponse(200, question, "Question updated successfully"));
});

const deleteQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const question = await Question.findById(id).populate({
      path: "module",
      populate: { path: "course" },
   });
   if (!question) {
      throw new ApiError(404, "Question not found");
   }

   if (
      req.user.role !== "admin" &&
      question.module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to delete this question");
   }

   await Module.findByIdAndUpdate(question.module._id, {
      $pull: { questions: question._id },
   });

   await question.deleteOne();
   // NOTE: this does not cascade-delete the Question's Answers — see note below.

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Question deleted successfully"));
});

export {
   createQuestion,
   getQuestionFeed,
   getQuestionById,
   updateQuestion,
   deleteQuestion,
};