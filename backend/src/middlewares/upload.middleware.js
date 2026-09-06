// middleware/upload.middleware.js
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = "uploads";

// ensure the uploads directory exists before multer ever tries to write to it
if (!fs.existsSync(UPLOAD_DIR)) {
   fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const ALLOWED_MIME_TYPES = {
   "application/pdf": "pdf",
   "text/plain": "article",
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
   const ext = path.extname(file.originalname).toLowerCase();
   const allowedExt = [".pdf", ".txt"];
   if (ALLOWED_MIME_TYPES[file.mimetype] || allowedExt.includes(ext)) {
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