// rag/qdrant.js — shared Qdrant Cloud setup (free tier: 1GB RAM / 4GB disk,
// no credit card). Replaces the old self-hosted ChromaDB, which needed a
// Docker container + persistent disk to survive restarts. Qdrant Cloud holds
// the vectors server-side, so this service stays fully stateless and can run
// on Cloud Run / Render free (where local disk is wiped on every deploy).
import { QdrantClient } from "@qdrant/js-client-rest";

// gemini-embedding-001's default output width. MUST match the embedding model
// in server.js / ingest-logic.js — Qdrant fixes the vector size when the
// collection is created, so switching embedding models later means creating
// a new collection (or re-ingesting into one built with the new size).
export const EMBEDDING_DIM = 3072;

export function getCollectionName() {
   return process.env.QDRANT_COLLECTION || "course_collection";
}

export function getQdrantClient() {
   const url = process.env.QDRANT_URL;
   if (!url) {
      console.error("QDRANT_URL is not set — refusing to start.");
      process.exit(1);
   }
   // QDRANT_API_KEY is required by Qdrant Cloud; a local/self-hosted Qdrant
   // without auth can leave it unset.
   return new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
}

// Creates the collection on first run (ingest or server boot), no-op after.
// Also adds keyword indexes so filtered deletes + module-scoped retrieval
// don't degrade into full scans as the collection grows.
export async function ensureQdrantCollection(client, collectionName) {
   const { collections } = await client.getCollections();
   if (!collections.some((c) => c.name === collectionName)) {
      await client.createCollection(collectionName, {
         vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      });
      console.log(`✅ Created Qdrant collection "${collectionName}" (dim=${EMBEDDING_DIM})`);
   }
   for (const field of ["metadata.documentId", "metadata.moduleId"]) {
      try {
         await client.createPayloadIndex(collectionName, {
            field_name: field,
            field_schema: "keyword",
         });
      } catch {
         // Index already exists — nothing to do.
      }
   }
}
