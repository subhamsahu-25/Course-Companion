// middleware/upload.middleware.js
import multer from "multer";

const ALLOWED_MIME_TYPES = {
   "application/pdf": "pdf",
   "text/plain": "article",
   "video/mp4": "video",
   "image/png": "image",
   "image/jpeg": "image",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Memory storage (not disk): Railway's disk is ephemeral and every
// redeploy wiped uploads/, orphaning DB records ("File is not available").
// Files go straight from the buffer to Cloudinary (durable) and to the
// RAG ingester (base64) — nothing ever needs to touch disk.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
   const allowedExt = [".pdf", ".txt"];
   const ext = (file.originalname || "").toLowerCase();
   const hasAllowedExt = allowedExt.some((e) => ext.endsWith(e));
   if (ALLOWED_MIME_TYPES[file.mimetype] || hasAllowedExt) {
      return cb(null, true);
   }
   return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
};

const upload = multer({
   storage,
   fileFilter,
   limits: { fileSize: MAX_FILE_SIZE },
});

export { upload, ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
