import { Router } from "express";
import {
    ingestSingleDocument,
    removeDocumentChunks,
    removeScopeChunks,
} from "../ingest-logic.js";

const router = Router();

// 3.5 Ingestion — called by the backend right after a document is
// uploaded (or deleted), so the vector store actually stays in sync with
// what's in the router. Uploading a document used to only save the file and
// a DB record; nothing ever told the RAG pipeline the document existed,
// which is why questions about newly uploaded material always fell
// through to "I don't know."
router.post('/ingest', async (req, res) => {
    try {
        const { documentId, moduleId, courseId, filename, fileBase64, user_key } = req.body;

        if (!documentId || !filename || !fileBase64) {
            return res.status(400).json({ error: "documentId, filename and fileBase64 are required." });
        }

        const buffer = Buffer.from(fileBase64, "base64");
        const result = await ingestSingleDocument({ buffer, filename, documentId, moduleId, courseId, userKey: user_key ?? null });
        res.json(result);
    } catch (error) {
        console.error("Error ingesting document:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Removes every vector in a course/module scope (documents, golden
// answers, stragglers). Called by the backend on course hard-delete, where
// per-document cleanup alone would leak TA-verified answers — those aren't
// Document records, but they carry the same scope tags.
router.post('/ingest/purge', async (req, res) => {
    try {
        const { moduleIds, courseId } = req.body ?? {};
        const removed = await removeScopeChunks({ moduleIds, courseId });
        res.json({ removed });
    } catch (error) {
        console.error("Error purging vectors:", error);
        res.status(400).json({ error: error.message || "Internal server error" });
    }
});

// Removes a document's chunks (e.g. when it's deleted in the app) so
// stale content doesn't keep showing up in answers.
router.delete('/ingest/:documentId', async (req, res) => {
    try {
        const removed = await removeDocumentChunks(req.params.documentId);
        res.json({ removed });
    } catch (error) {
        console.error("Error removing document chunks:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
