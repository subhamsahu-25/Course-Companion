// controllers/document.controller.js
import fs from "fs";
import path from "path";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Document } from "../models/document.model.js";
import { Module } from "../models/module.model.js";
import { ALLOWED_MIME_TYPES } from "../middlewares/upload.middleware.js";

const uploadDocument = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;
   const { title } = req.body;

   // validateUploadedFile middleware already guarantees req.file exists,
   // but we double check here in case controller is ever reused elsewhere
   if (!req.file) {
      throw new ApiError(400, "A file is required");
   }

   const module = await Module.findById(moduleId).populate("course");
   if (!module) {
      // clean up the orphaned file we already saved to disk
      fs.unlink(req.file.path, () => { });
      throw new ApiError(404, "Module not found");
   }

   if (
      req.user.role !== "admin" &&
      module.course.instructor.toString() !== req.user._id.toString()
   ) {
      fs.unlink(req.file.path, () => { });
      throw new ApiError(403, "You are not allowed to upload to this module");
   }

   const ext = path.extname(req.file.originalname).toLowerCase();
   const document = await Document.create({
      title: title || req.file.originalname,
      module: moduleId,
      type: ALLOWED_MIME_TYPES[req.file.mimetype] || (ext === ".pdf" ? "pdf" : "other"),
      url: `/uploads/${req.file.filename}`,
      fileSizeBytes: req.file.size,
   });

   module.documents.push(document._id);
   await module.save();

   return res
      .status(201)
      .json(new ApiResponse(201, document, "Document uploaded successfully"));
});

const getDocumentsByModule = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const documents = await Document.find({ module: moduleId })
      .sort({ order: 1 })
      .lean();

   return res
      .status(200)
      .json(new ApiResponse(200, documents, "Documents fetched successfully"));
});

const getDocumentById = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const document = await Document.findById(id);
   if (!document) {
      throw new ApiError(404, "Document not found");
   }

   return res
      .status(200)
      .json(new ApiResponse(200, document, "Document fetched successfully"));
});

const streamDocumentFile = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const document = await Document.findById(id);
   if (!document?.url) {
      throw new ApiError(404, "Document not found");
   }

   const filename = path.basename(document.url);
   const filePath = path.resolve("uploads", filename);

   if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "File is not available");
   }

   const ext = path.extname(filename).toLowerCase();
   const mimeTypes = {
      ".pdf": "application/pdf",
      ".txt": "text/plain; charset=utf-8",
   };

   res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
   res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(document.title || filename)}"`,
   );
   fs.createReadStream(filePath).pipe(res);
});

const deleteDocument = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const document = await Document.findById(id).populate({
      path: "module",
      populate: { path: "course" },
   });
   if (!document) {
      throw new ApiError(404, "Document not found");
   }

   if (
      req.user.role !== "admin" &&
      document.module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to delete this document");
   }

   await Module.findByIdAndUpdate(document.module._id, {
      $pull: { documents: document._id },
   });

   document.isDeleted = true;
   document.deletedAt = new Date();
   await document.save();

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Document deleted successfully"));
});

export {
   uploadDocument,
   getDocumentsByModule,
   getDocumentById,
   streamDocumentFile,
   deleteDocument,
};