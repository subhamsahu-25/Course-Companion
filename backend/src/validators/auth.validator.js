import { body } from "express-validator";
const userRegisterValidator = () => {
   return [
      body("email")
         .trim()
         .notEmpty()
         .withMessage("Email is required") // runs if email is empty ("withMessage" is like the "else" of the above method)
         .isEmail()
         .withMessage("Please enter a valid email address"), // runs if email is not valid ("withMessage" is like the "else" of the above method)

      body("username")
         .trim()
         .notEmpty()
         .withMessage("Username is required") // runs if username is empty ("withMessage" is like the "else" of the above method)
         .isLowercase()
         .withMessage("Username must be lowercase") // runs if username is not lowercase ("withMessage" is like the "else" of the above method)
         .isLength({ min: 3, max: 20 })
         .withMessage("Username must be between 3 and 20 characters"), // runs if username is not between 3 and 20 characters ("withMessage" is like the "else" of the above method)

      body("password")
         .trim()
         .notEmpty()
         .withMessage("Password is required") // runs if password is empty ("withMessage" is like the "else" of the above method)
         .isLength({ min: 6, max: 20 })
         .withMessage("Password must be between 6 and 20 characters"), // runs if password is not between 6 and 20 characters ("withMessage" is like the "else" of the above method)

      body("fullname")
         .trim()
         .optional()
   ]
}

const userLoginValidator = () => {
   return [
      body("email")
         .trim()
         .optional()
         .isEmail()
         .withMessage("Please enter a valid email address"), // runs if email is not valid ("withMessage" is like the "else" of the above method)

      body("password")
         .trim()
         .notEmpty()
         .withMessage("Password is required") // runs if password is empty ("withMessage" is like the "else" of the above method)
   ]
}

const userChangeCurrentPasswordValidator = () => {
   return [
      body("oldPassword")
         .trim()
         .notEmpty()
         .withMessage("Password is required"), // runs if password is empty ("withMessage" is like the "else" of the above method)

      body("newPassword")
         .trim()
         .notEmpty()
         .withMessage("Password is required") // runs if password is empty ("withMessage" is like the "else" of the above method
         .isLength({ min: 6, max: 20 })
         .withMessage("Password must be between 6 and 20 characters"), // runs if password is not between 6 and 20 characters ("withMessage" is like the "else" of the above method)
   ]
}

const userForgotPasswordValidator = () => {
   return [
      body("email")
         .trim()
         .notEmpty()
         .withMessage("Email is required") // runs if email is empty ("withMessage" is like the "else" of the above method)
         .isEmail()
         .withMessage("Please enter a valid email address"), // runs if email is not valid ("withMessage" is like the "else" of the above method)
   ]
}

const userResetForgotPasswordValidator = () => {
   return [
      body("password")
         .trim()
         .notEmpty()
         .withMessage("Password is required") // runs if password is empty ("withMessage" is like the "else" of the above method)
         .isLength({ min: 6, max: 20 })
         .withMessage("Password must be between 6 and 20 characters"), // runs if password is not between 6 and 20 characters ("withMessage" is like the "else" of the above method)
   ]
}

export {
   userRegisterValidator,
   userLoginValidator,
   userChangeCurrentPasswordValidator, 
   userForgotPasswordValidator,
   userResetForgotPasswordValidator,
};