// controllers/answer.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Answer } from "../models/answer.model.js";
import { Question } from "../models/question.model.js";
import { transitionAnswer } from "../services/answer-workflow.service.js";

const createAnswer = asyncHandler(async (req, res) => {
   const { question: questionId, text, isCorrect } = req.body;

   const question = await Question.findById(questionId).populate({
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
      throw new ApiError(403, "You are not allowed to add answers to this question");
   }

   // new answers always start in "draft" — status is not client-settable on create
   const answer = await Answer.create({
      question: questionId,
      text,
      isCorrect: isCorrect ?? false,
   });

   question.answers.push(answer._id);
   await question.save();

   return res
      .status(201)
      .json(new ApiResponse(201, answer, "Answer created successfully"));
});

const getAnswersByQuestion = asyncHandler(async (req, res) => {
   const { questionId } = req.params;

   const filter = { question: questionId };
   // students only ever see published answers
   if (req.user?.role === "student") {
      filter.status = "published";
   }

   const answers = await Answer.find(filter).sort({ order: 1 }).lean();

   return res
      .status(200)
      .json(new ApiResponse(200, answers, "Answers fetched successfully"));
});

const updateAnswerStatus = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { status } = req.body;

   const answer = await Answer.findById(id);
   if (!answer) {
      throw new ApiError(404, "Answer not found");
   }

   const updated = await transitionAnswer(answer, status, req.user._id);

   return res
      .status(200)
      .json(new ApiResponse(200, updated, `Answer moved to '${status}'`));
});

const updateAnswerContent = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { text, isCorrect } = req.body;

   const answer = await Answer.findById(id);
   if (!answer) {
      throw new ApiError(404, "Answer not found");
   }

   // editing content after publish should require sending it back to draft first —
   // enforce that here rather than silently allowing edits to a "published" answer
   if (answer.status === "published") {
      throw new ApiError(
         409,
         "Cannot edit a published answer directly — move it back to draft first"
      );
   }

   if (text !== undefined) answer.text = text;
   if (isCorrect !== undefined) answer.isCorrect = isCorrect;

   await answer.save();

   return res
      .status(200)
      .json(new ApiResponse(200, answer, "Answer updated successfully"));
});

const deleteAnswer = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const answer = await Answer.findById(id).populate({
      path: "question",
      populate: { path: "module", populate: { path: "course" } },
   });
   if (!answer) {
      throw new ApiError(404, "Answer not found");
   }

   if (
      req.user.role !== "admin" &&
      answer.question.module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to delete this answer");
   }

   await Question.findByIdAndUpdate(answer.question._id, {
      $pull: { answers: answer._id },
   });

   await answer.deleteOne();

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Answer deleted successfully"));
});

export {
   createAnswer,
   getAnswersByQuestion,
   updateAnswerStatus,
   updateAnswerContent,
   deleteAnswer,
};