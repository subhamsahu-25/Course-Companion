import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Behind Railway/Vercel the client IP arrives via X-Forwarded-For —
// without this, rate limiting sees one shared proxy IP for everyone.
app.set("trust proxy", 1);

app.use(helmet());

// Global abuse brake. Auth + ask endpoints get tighter limits below.
app.use(
   rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
   })
);

// some basic configuration
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
// NOTE: no /uploads static mount on purpose — course files must never be
// served anonymously (see document.route.js :id/file, which enforces
// course membership first). Legacy local files, if any, are unreachable.
app.use(cookieParser());

// cors configuration
app.use(cors({
   origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
   credentials: true,
   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
   allowedHeaders: ["Content-Type", "Authorization"]
}))

// Tight limits where abuse hurts: credential stuffing on auth, LLM spend
// on ask (one account must not burn the shared Gemini quota alone).
// Registered BEFORE the routers — Express runs middleware in order, so a
// limiter mounted after its router would never fire.
const authLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   limit: 10,
   standardHeaders: true,
   legacyHeaders: false,
});
const askLimiter = rateLimit({
   windowMs: 60 * 60 * 1000,
   limit: 50,
   standardHeaders: true,
   legacyHeaders: false,
   message: { success: false, message: "Too many questions this hour — try again later." },
});

// import routes
import authRouter from "./routes/auth.route.js";
import courseRouter from "./routes/course.route.js";
import moduleRouter from "./routes/module.route.js";
import documentRouter from "./routes/document.route.js";
import questionRouter from "./routes/question.route.js";
import answerRouter from "./routes/answer.route.js";
import qaRouter from "./routes/qa.route.js";
import geminiKeyRouter from "./routes/geminikey.route.js";

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/resend-email-verification", authLimiter);
app.use("/api/v1/qa/ask", askLimiter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/modules", moduleRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/questions", questionRouter);
app.use("/api/v1/answers", answerRouter);
app.use("/api/v1/qa", qaRouter);
app.use("/api/v1/users/me/gemini-key", geminiKeyRouter);

app.get("/", (req, res) => {
   res.send("Hello ! This is my homepage")
})

// global error handler — must be registered LAST, after all routes
import { errorHandler } from "./middlewares/error-handler.middleware.js";
app.use(errorHandler);

export default app;