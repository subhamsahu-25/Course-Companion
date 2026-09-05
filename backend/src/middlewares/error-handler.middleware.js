// middleware/error-handler.middleware.js
import mongoose from "mongoose";
import { ApiError } from "../utils/api-error.js";

const errorHandler = (err, req, res, next) => {
   let error = err;

   // normalize non-ApiError errors into ApiError so the response shape stays consistent
   if (!(error instanceof ApiError)) {
      let statusCode = error.statusCode || 500;
      let message = error.message || "Something went wrong";

      // Mongoose bad ObjectId (e.g. malformed :id slipped past validation)
      if (error instanceof mongoose.Error.CastError) {
         statusCode = 400;
         message = `Invalid ${error.path}: ${error.value}`;
      }

      // Mongoose schema validation errors (in case something bypasses express-validator)
      if (error instanceof mongoose.Error.ValidationError) {
         statusCode = 400;
         message = Object.values(error.errors)
            .map((val) => val.message)
            .join(", ");
      }

      // Mongo duplicate key error (e.g. unique slug/email collision)
      if (error.code === 11000) {
         statusCode = 409;
         const field = Object.keys(error.keyValue || {})[0];
         message = `Duplicate value for field: ${field}`;
      }

      // JWT errors from your auth guard
      if (error.name === "JsonWebTokenError") {
         statusCode = 401;
         message = "Invalid token";
      }
      if (error.name === "TokenExpiredError") {
         statusCode = 401;
         message = "Token expired";
      }

      // Multer errors (file size / unexpected field) that weren't already caught in the route
      if (error.name === "MulterError") {
         statusCode = 400;
         message = error.message;
      }

      error = new ApiError(statusCode, message, error?.errors || [], err.stack);
   }

   const response = {
      ...error,
      message: error.message,
      // only leak stack trace in development
      ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
   };

   return res.status(error.statusCode).json(response);
};

export { errorHandler };