import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-error.js";

export const validate = (req, res, next) => {
   const errors = validationResult(req);
   if (errors.isEmpty())
      return next();

   const extractedErrors = [];
   errors.array().map((err) => extractedErrors.push(
      {
         [err.path]: err.msg
      }
   ));

   // NOTE: ApiError's 3rd param is `data` (always nulled) and 4th is
   // `errors` — passing the field details as 3rd arg silently discards
   // them, which is why clients used to see an empty errors array.
   throw new ApiError(422, "validation failed for the incoming data", null, extractedErrors);
}

// this middleware will run after the validator function and will check if there are any errors

// it is used to collect all the errros from the validator function