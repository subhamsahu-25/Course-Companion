// rag/clients.js — shared external clients: Gemini (chat + embeddings),
// Qdrant vector store, and per-user-key health bookkeeping.
//
// Call initClients() once at boot (server.js does this before listening);
// everything else is a getter so route/service modules never hold stale
// handles. Nothing here knows about HTTP or Mongoose models.
import crypto from 'crypto';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import {
    getQdrantClient,
    getCollectionName,
    ensureQdrantCollection,
} from "./qdrant.js";

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Model selection (env-overridable). Follow-ups pin to LIGHT_MODEL:
// high daily quota, and threads need speed, not frontier reasoning.
export const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
export const LIGHT_MODEL = process.env.GEMINI_LIGHT_MODEL || FALLBACK_MODEL;

export function getEmbeddings() {
    return new GoogleGenerativeAIEmbeddings({
        apiKey: GEMINI_API_KEY,
        // text-embedding-004 was shut down by Google on Jan 14, 2026 (that's
        // the 404 you may have seen). gemini-embedding-001 is the current
        // replacement — note it outputs 3072-dim vectors instead of 768, so
        // this MUST match whatever ingest-logic.js uses too, or retrieval
        // breaks silently.
        model: "gemini-embedding-001",
    });
}

// Per-request funding: a caller-supplied user key replaces the shared one
// for this client only. The key itself is never stored or logged here —
// it arrives per call and dies with the request.
export function buildKeyedChatModel(model, apiKey) {
    return new ChatGoogleGenerativeAI({
        apiKey: apiKey || GEMINI_API_KEY,
        model,
        temperature: 0,
    });
}

// True when the failure is quota/rate-limiting (worth replaying on the
// fallback) as opposed to a real error (bad request, auth, network).
export function isQuotaError(error) {
    if (error?.status === 429) return true;
    return /429|quota|rate.?limit|exhausted|retry.?later/i.test(error?.message || "");
}

// 401/403-shaped rejections mean the KEY is bad (not empty quota).
export function isInvalidKeyError(error) {
    if (error?.status === 401 || error?.status === 403) return true;
    return /api key not valid|invalid.*key|key.*invalid|permission denied/i.test(error?.message || "");
}

// Per-user-key health, keyed by sha256 hex of the key (never the key).
// Lets repeat failures short-circuit without burning calls: quota →
// cooled until next PT midnight; invalid → parked until the key changes
// (a new key hashes differently, so it starts clean automatically).
export const userKeyHealth = new Map();

export function hashUserKey(userKey) {
    return crypto.createHash("sha256").update(String(userKey), "utf-8").digest("hex");
}

export function pruneKeyHealth() {
    const now = Date.now();
    for (const [hash, entry] of userKeyHealth) {
        if (entry.until && entry.until <= now) userKeyHealth.delete(hash);
    }
}

// 'ok' | 'quota' | 'invalid'. Unknown keys are 'ok' (first try is free).
export function checkUserKeyHealth(userKey) {
    if (!userKey) return 'ok';
    pruneKeyHealth();
    return userKeyHealth.get(hashUserKey(userKey))?.status ?? 'ok';
}

export function noteUserKeyFailure(userKey, status) {
    if (!userKey) return;
    if (status === 'invalid') {
        userKeyHealth.set(hashUserKey(userKey), { status: 'invalid', until: null });
        return;
    }
    if (status === 'quota') {
        userKeyHealth.set(hashUserKey(userKey), { status: 'quota', until: nextPtMidnightMs() });
    }
}

export function clearUserKeyHealth(userKey) {
    if (userKey) userKeyHealth.delete(hashUserKey(userKey));
}

export function nextPtMidnightMs() {
    const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const next = new Date(ptNow);
    next.setHours(24, 0, 0, 0);
    return Date.now() + (next - ptNow);
}

// Shared-key quota signal for the quota-status endpoint (powers the
// frontend "shared answers strained" nudge).
let lastSharedQuotaFailureAt = null;

export function recordSharedQuotaFailure() {
    lastSharedQuotaFailureAt = Date.now();
}

export function getSharedQuotaState() {
    return { ok: lastSharedQuotaFailureAt === null, lastFailureAt: lastSharedQuotaFailureAt };
}

let vectorStoreInstance = null;
let retrieverInstance = null;

export function getVectorStore() {
    if (!vectorStoreInstance) {
        throw new Error("Vector store not initialized — call initClients() at boot.");
    }
    return vectorStoreInstance;
}

export function getRetriever() {
    if (!retrieverInstance) {
        throw new Error("Retriever not initialized — call initClients() at boot.");
    }
    return retrieverInstance;
}

// Connects to the existing vector collection. Qdrant Cloud persists the
// vectors server-side, so unlike the old self-hosted Chroma this service
// is fully stateless — local disk being wiped on every restart/redeploy
// (Cloud Run / Render free) loses nothing.
export async function initClients() {
    const qdrantClient = getQdrantClient();
    const collectionName = getCollectionName();
    await ensureQdrantCollection(qdrantClient, collectionName);
    vectorStoreInstance = await QdrantVectorStore.fromExistingCollection(getEmbeddings(), {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
    });
    retrieverInstance = vectorStoreInstance.asRetriever(8);
}
