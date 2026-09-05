// middleware/handle-upload-errors.middleware.js
// wraps multer's .single()/.array() call so its errors go through YOUR error shape,
// not multer's raw error object — this is what actually gets used in the route,
// not `upload` directly
import multer from "multer";
import { ApiError } from "../utils/api-error.js";

const handleUpload = (multerMiddleware) => {
   return (req, res, next) => {
      multerMiddleware(req, res, (err) => {
         if (err instanceof multer.MulterError) {
            // e.g. "File too large", "Unexpected field"
            return next(new ApiError(400, err.message));
         }
         if (err) {
            // thrown from fileFilter — unsupported type
            return next(new ApiError(400, err.message));
         }
         next();
      });
   };
};

export { handleUpload };