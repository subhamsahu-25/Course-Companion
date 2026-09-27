// controllers/document.controller.js
import fs from "fs";
import path from "path";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Document } from "../models/document.model.js";
import { Module } from "../models/module.model.js";
import { ALLOWED_MIME_TYPES } from "../middlewares/upload.middleware.js";
import * as ragService from "../services/rag.service.js";
import { assertCourseAccess } from "../utils/course-access.js";
import {
   uploadDocumentToCloudinary,
   deleteFromCloudinary,
   cloudinary,
} from "../utils/cloudinary.js";

// Only these produce plain text the rag service knows how to chunk today.
// Other types (video/image/link/etc.) are stored and streamable but never
// indexed — there's no extraction path for them yet.
const INDEXABLE_TYPES = new Set(["pdf", "article"]);

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
      throw new ApiError(404, "Module not found");
   }

   if (
      req.user.role !== "admin" &&
      module.course.instructor.toString() !== req.user._id.toString()
   ) {
      throw new ApiError(403, "You are not allowed to upload to this module");
   }

   const ext = path.extname(req.file.originalname).toLowerCase();
   const docType = ALLOWED_MIME_TYPES[req.file.mimetype] || (ext === ".pdf" ? "pdf" : "other");

   // Durable storage FIRST: Cloudinary. Railway's disk is ephemeral — every
   // redeploy used to wipe uploads/ and orphan DB records ("File is not
   // available"). Nothing touches disk anymore; the buffer goes to
   // Cloudinary and (below) to the RAG ingester.
   let fileUrl, publicId;
   try {
      const uploaded = await uploadDocumentToCloudinary(
         req.file.buffer,
         req.file.originalname
      );
      fileUrl = uploaded.secure_url;
      publicId = uploaded.public_id;
   } catch (err) {
      throw new ApiError(502, `File storage failed: ${err.message || err}`);
   }

   const document = await Document.create({
      title: title || req.file.originalname,
      module: moduleId,
      type: docType,
      url: fileUrl,
      cloudinaryPublicId: publicId,
      fileSizeBytes: req.file.size,
   });

   module.documents.push(document._id);
   await module.save();

   // Kick off indexing so this document is actually answerable by the RAG
   // pipeline.
   //
   // Awaited (not fire-and-forget) so the response can honestly report
   // whether indexing worked, but a failure here doesn't fail the upload —
   // the file and record are already saved either way, and this can be
   // retried later.
   if (INDEXABLE_TYPES.has(docType)) {
      try {
         const result = await ragService.ingestDocument(
            document._id.toString(),
            moduleId,
            module.course._id.toString(),
            req.file.originalname,
            req.file.buffer.toString("base64"),
         );

         // The ingester is idempotent: re-uploading identical content
         // reports skipped/"unchanged", which still means indexed.
         if (result?.contentHash) {
            document.contentHash = result.contentHash;
         }
         if (result?.skipped && result?.reason !== "unchanged — same content already indexed") {
            document.indexingError = result.reason || "Indexing was skipped";
         } else {
            document.isIndexed = true;
            document.indexingError = null;
         }
      } catch (err) {
         // rag service may be down/unreachable — don't block the upload on it
         document.indexingError = err.message || "Failed to reach the rag service";
      }
      await document.save();
   }

   return res
      .status(201)
      .json(new ApiResponse(201, document, "Document uploaded successfully"));
});

const getDocumentsByModule = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) {
      throw new ApiError(404, "Module not found");
   }
   assertCourseAccess(module.course, req.user);

   const documents = await Document.find({ module: moduleId })
      .sort({ order: 1 })
      .lean();

   return res
      .status(200)
      .json(new ApiResponse(200, documents, "Documents fetched successfully"));
});

const getDocumentById = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const document = await Document.findById(id).populate({
      path: "module",
      populate: { path: "course" },
   });
   if (!document) {
      throw new ApiError(404, "Document not found");
   }
   assertCourseAccess(document.module.course, req.user);

   return res
      .status(200)
      .json(new ApiResponse(200, document, "Document fetched successfully"));
});

const streamDocumentFile = asyncHandler(async (req, res) => {
   const { id } = req.params;

   const document = await Document.findById(id).populate({
      path: "module",
      populate: { path: "course" },
   });
   if (!document?.url) {
      throw new ApiError(404, "Document not found");
   }
   assertCourseAccess(document.module.course, req.user);

   // Cloudinary-hosted files (everything uploaded since durable storage):
   // access stays checked here, then hand off to the CDN.
   if (/^https?:\/\//i.test(document.url || "")) {
      return res.redirect(document.url);
   }

   // Legacy local-disk records (pre-Cloudinary uploads, plus localhost
   // dev) — kept as a fallback path.
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

   // Best-effort — don't fail the delete just because the rag service is
   // unreachable. Worst case, stale chunks linger until this is retried.
   if (document.isIndexed) {
      try {
         await ragService.removeIngestedDocument(document._id.toString());
      } catch (err) {
         console.error(`Failed to remove ingested chunks for document ${document._id}:`, err.message);
      }
   }

   // Best-effort Cloudinary cleanup (PDFs may live under image or raw
   // type depending on how Cloudinary classified them — try both).
   if (document.cloudinaryPublicId) {
      try {
         await deleteFromCloudinary(document.cloudinaryPublicId);
      } catch {
         try {
            await cloudinary.uploader.destroy(document.cloudinaryPublicId, {
               resource_type: "raw",
            });
         } catch (err) {
            console.error(
               `Failed to remove Cloudinary file for document ${document._id}:`,
               err.message
            );
         }
      }
   }

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