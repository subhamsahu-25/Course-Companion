import {User, AvailableUserRoles} from "../models/user.model.js";
import {ApiResponse} from "../utils/api-response.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import { sendEmail, emailVerificationMailgenContent, forgotPasswordMailgenContent } from "../utils/mail.js";
import { cookieOptions } from "../utils/cookies.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const generateAccessAndRefreshToken = async(userId) => {
   try {
      const user = await User.findById(userId);
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      await user.save({validateBeforeSave: false});

      return {accessToken, refreshToken};
   } catch (error) {
      throw new ApiError(500, "Something went wrong while regenerating tokens");
   }
}

const registerUser = asyncHandler(async(req, res) => {
   // ACCEPTING THE DATA COMING FROM FRONTEND (FOR NOW - BODY)
   const { email, username, password, role } = req.body;

   // Anyone can self-register as a student, instructor, or TA, but never as
   // admin — admin accounts must be granted by an existing admin, not chosen
   // by whoever fills in the signup form.
   const SELF_REGISTERABLE_ROLES = [
      AvailableUserRoles.STUDENT,
      AvailableUserRoles.INSTRUCTOR,
      AvailableUserRoles.TA,
   ];
   const requestedRole = role && SELF_REGISTERABLE_ROLES.includes(role)
      ? role
      : AvailableUserRoles.STUDENT;

   // CHECKING IF THE USER ALREADY EXISTS
   const userExists = await User.findOne({
      $or: [{username}, {email}]
   });

   if(userExists) {
      throw new ApiError(400, "Username / Email already exists");
   }

   // CREATING A NEW USER
   const user = await User.create({
      username,
      email,
      password,
      role: requestedRole,
      isEmailVerified: false,
   });

   // GENERATING TEMPORARY TOKEN FOR THE NEW USER TO SEND HIM THE EMAIL VERIFICATION
   const { hashedToken, tokenExpiry, unHashedToken } = user.generateTemporaryToken();

   user.emailVerificationToken = hashedToken;
   user.emailVerificationExpiry = tokenExpiry;
   await user.save({validateBeforeSave: false});

   // SENDING THE EMAIL VERIFICATION EMAIL
   await sendEmail(
      {
         email: user.email,
         subject: "PLEASE VERIFY YOUR EMAIL",
         mailgenContent: emailVerificationMailgenContent(user.username, `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`)
      }
   );

   // SENDING THE RESPONSE
   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
   )

   if(!createdUser) 
      throw new ApiError(500, "Something went wrong while registering the user");

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {user: createdUser},
            "User registered successfully"
         )
      )

   })
   
const loginUser = asyncHandler(async(req, res) => {
   // ACCEPTING THE DATA COMING FROM FRONTEND (FOR NOW - BODY)
   const { email, password, username } = req.body;

   if(!username && !email)
      throw new ApiError(400, "Username or Email is required");

   // CHECKING IF THE USER ALREADY EXISTS — by whichever identifier was sent
   const user = await User.findOne(
      email ? { email } : { username }
   );

   if(!user)
      throw new ApiError(400, "Username / Email is required");
   
   // CHECKING IF THE PASSWORD IS CORRECT
   const isPasswordValid = await user.isPasswordCorrect(password);

   if(!isPasswordValid)
      throw new ApiError(400, "Password is incorrect");

   // GENERATING ACCESS AND REFRESH TOKENS
   const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

   // SENDING THE RESPONSE
   const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
   )

   // SETTING THE COOKIES (flags come from utils/cookies.js so prod can
   // flip to SameSite=None; Secure for cross-site Vercel → Render auth)
   const options = cookieOptions()

   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               user: loggedInUser,
               accessToken,
               refreshToken
            },
            "User logged in successfully"
         )
      )
})

const logoutUser = asyncHandler(async(req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: ""
         }
      },
      {
         new: true
      }
   );

   const options = cookieOptions()

   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(
         new ApiResponse(
            200, 
            {},
            "User logged out successfully"
         )
      )
})

const getCurrentUser = asyncHandler(async(req, res) => {
   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            req.user,
            "User fetched successfully"
         )
      )
})

const verifyEmail = asyncHandler(async(req, res) => {
   const {verificationToken} = req.params; // we extracted the temporary token from the url

   if(!verificationToken)
      throw new ApiError(400, "Email verification token is required"); // if there is no temporary token, then the request is invalid 

   let hashedToken = crypto // creating a hash of the temporary token
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex")

   const user = await User.findOne({ // finding the user with the temporary token
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: {$gt: Date.now()}
   })

   if(!user)
      throw new ApiError(400, "token is invalid / expired"); // if the user is not found, then the request is invalid

   user.isEmailVerified = true; // setting the isEmailVerified field to true
   await user.save({validateBeforeSave: false});

   user.emailVerificationToken = undefined; //just to clean up the database space
   user.emailVerificationExpiry = undefined; //just to clean up the database space
   await user.save({validateBeforeSave: false});

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {
               isEmailVerified: user.isEmailVerified
            },
            "Email verified successfully"
         )
      )
})

const resendEmailVerification = asyncHandler(async(req, res) => {
   const user = await User.findById(req.user?._id);

   if(!user)
      throw new ApiError(404, "User not found");

   if(user.isEmailVerified)
      throw new ApiError(400, "Email is already verified");

   const { hashedToken, tokenExpiry, unHashedToken } = user.generateTemporaryToken();

   user.emailVerificationToken = hashedToken;
   user.emailVerificationExpiry = tokenExpiry;
   await user.save({ validateBeforeSave: false });

   await sendEmail(
      {
         email: user?.email,
         subject: "PASSWORD RESET REQUEST",
         mailgenContent: forgotPasswordMailgenContent(user.username, `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`)
      }
   );

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {},
            "Email verification link sent successfully"
         )
      )

});

const refreshAccessToken = asyncHandler(async(req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

   if(!incomingRefreshToken)
      throw new ApiError(400, "Refresh token is required"); //checking if we even have a refresh token

   try {
      const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

      const user = await User.findById(decodedToken?._id);;

      if(!user)
         throw new ApiError(401, "Invalid refresh token"); //checking if the received refresh token is valid

      if(incomingRefreshToken !== user.refreshToken)
         throw new ApiError(401, "Refresh Token has expired"); //checking if the received refresh token is present in the db or not
 
      const options = cookieOptions()

      const {accessToken, refreshToken: newRT} = await generateAccessAndRefreshToken(user._id); //generating new access and refresh token and casting the new refresh token to avoid confusion

      user.refreshToken = newRT;
      await user.save({validateBeforeSave: false});

      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newRT, options)
         .json(
            new ApiResponse(
               200,
               {
                  accessToken,
                  refreshToken: newRT
               },
               "Access token refreshed successfully"
            )
         )

   } catch (error) {
      throw new ApiError(401, "invalid refresh token");
   }
})

const forgotPasswordRequest = asyncHandler(async(req, res) => {
   const {email} = req.body;

   const user = await User.findOne({email});

   if(!user)
      throw new ApiError(404, "User not found");

   const {hashedToken, tokenExpiry, unHashedToken} = user.generateTemporaryToken();

   user.forgotPasswordToken = hashedToken;
   user.forgotPasswordExpiry = tokenExpiry;

   await user.save({validateBeforeSave: false});

   await sendEmail({
      email: user?.email,
      subject: "PLEASE VERIFY YOUR EMAIL",
      mailgenContent: emailVerificationMailgenContent(user.username, `${req.protocol}://${req.get("host")}/api/v1/users/forgot-password/${unHashedToken}`)
   });

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {},
            "Password reset mail was sent successfully"
         )
      );
});

const resetForgotPassword = asyncHandler(async(req, res) => {
   const {resetToken} = req.params;
   const {newPassword} = req.body;

   let hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

   const user = await User.findOne({
      forgotPasswordToken: hashedToken,
      forgotPasswordExpiry: { $gt: Date.now() } 
   });

   if(!user)
      throw new ApiError(404, "User not found");

   user.forgotPasswordToken = undefined;
   user.forgotPasswordExpiry = undefined;

   user.password = newPassword;

   await user.save({validateBeforeSave: false});

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {},
            "Password reset successfully"
         )
      )
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
   const {oldPassword, newPassword} = req.body;

   const user = await User.findById(req.user?._id);

   if(!user)
      throw new ApiError(404, "User not found");

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword); // in the user model we wrote the mongoose method for this 

   if(!isPasswordCorrect)
      throw new ApiError(400, "Old password is incorrect");

   user.password = newPassword;

   await user.save({validateBeforeSave: false});

   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            {},
            "Password changed successfully"
         )
      )
});

export {
   registerUser, 
   loginUser,
   logoutUser,
   getCurrentUser,
   verifyEmail,
   resendEmailVerification,
   refreshAccessToken,
   forgotPasswordRequest, 
   resetForgotPassword,
   changeCurrentPassword
};

// diff between req.user._id and req.user?._id - the former one assumes that the user must have an id and crashes if the user doesn't have an id BUT the later one takes it as optional and just returns an error instead of crasing.