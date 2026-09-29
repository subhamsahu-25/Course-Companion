// routes/gemini-key.route.js — BYOK endpoints (any logged-in role).
import { Router } from "express";
const router = Router();

import { authGuard } from "../middlewares/auth.middleware.js";
import {
   getGeminiKey,
   setGeminiKey,
   deleteGeminiKey,
} from "../controllers/geminikey.controller.js";

router.route("/").get(authGuard, getGeminiKey);
router.route("/").post(authGuard, setGeminiKey);
router.route("/").delete(authGuard, deleteGeminiKey);

export default router;
