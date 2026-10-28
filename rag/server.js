import "@napi-rs/canvas";
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { GEMINI_API_KEY, initClients, getSharedQuotaState } from "./clients.js";
import ingestRouter from "./routes/ingest.js";
import reviewRouter from "./routes/review.js";

const app = express();
// Raised from the default 100kb limit: the backend sends uploaded files
// here as base64 JSON, which needs headroom for anything near the 50MB
// upload cap the backend enforces.
app.use(express.json({ limit: "65mb" }));

// Public liveness probe for uptime monitors (cron-job.org etc.) —
// everything else on this service sits behind the service-key gate,
// so monitors need one ungated URL that answers 200 when alive.
app.get("/health", (req, res) => {
    const sharedQuota = getSharedQuotaState();
    res.status(200).json({
        status: "ok",
        service: "rag",
        // Shared-quota signal for the frontend strain nudge: null when no
        // shared failure has been seen (recently restarted or all clear).
        sharedQuota: {
            ok: sharedQuota.ok,
            lastFailureAt: sharedQuota.lastFailureAt,
        },
    });
});

// 0. Service-to-service auth.
// This service exposes internal endpoints (approve/reject a TA review, read
// any student's answers) that should only ever be called by the main
// backend, never hit directly by a browser. RAG_SERVICE_KEY is a shared
// secret configured identically here and in backend/.env.
const REQUIRED_SERVICE_KEY = process.env.RAG_SERVICE_KEY;
app.use((req, res, next) => {
    if (!REQUIRED_SERVICE_KEY) {
        // Fail loud in every environment rather than silently running open —
        // an unset key is a misconfiguration, not "no auth needed".
        console.error("RAG_SERVICE_KEY is not set — refusing all requests.");
        return res.status(500).json({ error: "Service is misconfigured" });
    }
    if (req.header("x-service-key") !== REQUIRED_SERVICE_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

// 0.5 Connect to MongoDB — same cluster/DB the main backend uses, so this
// service's data lives alongside the rest of the app's data instead of
// disappearing on every restart like the old in-memory Map did.
await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
console.log("✅ RAG service connected to MongoDB");

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set — refusing to start.");
    process.exit(1);
}

// Vector store + payload indexes. Must complete before serving — every
// retrieval path assumes the collection and its filters exist.
await initClients();

// Domain routers (see routes/ for the handlers, services/ for the logic).
app.use("/", ingestRouter);
app.use("/", reviewRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
