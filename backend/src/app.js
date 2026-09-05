import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// some basic configuration
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// cors configuration
app.use(cors({
   origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
   credentials: true,
   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
   allowedHeaders: ["Content-Type", "Authorization"]
}))

// import routes
import authRouter from "./routes/auth.route.js";
import courseRouter from "./routes/course.route.js";
import moduleRouter from "./routes/module.route.js";
import documentRouter from "./routes/document.route.js";
import questionRouter from "./routes/question.route.js";
import answerRouter from "./routes/answer.route.js";
import qaRouter from "./routes/qa.route.js";

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/modules", moduleRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/questions", questionRouter);
app.use("/api/v1/answers", answerRouter);
app.use("/api/v1/qa", qaRouter);

app.get("/", (req, res) => {
   res.send("Hello ! This is my homepage")
})

// global error handler — must be registered LAST, after all routes
import { errorHandler } from "./middlewares/error-handler.middleware.js";
app.use(errorHandler);

export default app;