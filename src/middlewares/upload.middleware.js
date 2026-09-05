// middleware/upload.middleware.js
import multer from "multer";
import path from "path";

const ALLOWED_MIME_TYPES = {
   "application/pdf": "pdf",
   "video/mp4": "video",
   "image/png": "image",
   "image/jpeg": "image",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
   destination: (req, file, cb) => cb(null, "uploads/"),
   filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
   },
});

const fileFilter = (req, file, cb) => {
   if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
   }
   cb(null, true);
};

const upload = multer({
   storage,
   fileFilter,
   limits: { fileSize: MAX_FILE_SIZE },
});

export { upload, ALLOWED_MIME_TYPES, MAX_FILE_SIZE };