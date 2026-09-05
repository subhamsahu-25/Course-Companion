// backend/src/controllers/qa.controller.js
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import * as ragService from "../services/rag.service.js";

const askQuestion = asyncHandler(async (req, res) => {
   const { question } = req.body;
   if (!question) throw new ApiError(400, "Question is required");

   const result = await ragService.submitQuestion(req.user._id.toString(), question);
   return res.status(200).json(new ApiResponse(200, result, "Question submitted for review"));
});

const getReviewQueue = asyncHandler(async (req, res) => {
   const queue = await ragService.getReviewQueue();
   return res.status(200).json(new ApiResponse(200, queue, "Review queue fetched"));
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

export { askQuestion, getReviewQueue, approveQuestion, rejectQuestion, getMyAnswer };