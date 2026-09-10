import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import {
   getQdrantClient,
   getCollectionName,
   ensureQdrantCollection,
} from "./qdrant.js";

const COLLECTION_NAME = getCollectionName();

// Swapped from CustomOllamaEmbedder to Gemini's embedding model. This MUST
// stay in sync with whatever embeds queries at search time (see the
// `embeddings` client in server.js) — if ingestion and querying use
// different embedding models, the resulting vectors live in different
// spaces and similarity search silently returns garbage.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
   console.error("GEMINI_API_KEY is not set — refusing to start.");
   process.exit(1);
}

function getEmbeddings() {
   return new GoogleGenerativeAIEmbeddings({
      apiKey: GEMINI_API_KEY,
      // Must match the model used in server.js at query time — see the
      // comment there for why text-embedding-004 was replaced.
      model: "gemini-embedding-001",
   });
}

// Store handle for writes. Qdrant is addressed by collection name on every
// call (no stale in-memory collection ID like the old Chroma client had),
// so recreating the collection mid-run is always safe.
async function getVectorStore() {
   const client = getQdrantClient();
   await ensureQdrantCollection(client, COLLECTION_NAME);
   return QdrantVectorStore.fromExistingCollection(getEmbeddings(), {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: COLLECTION_NAME,
   });
}

// Extracts plain text from a file buffer. Returns `null` (not a string) for
// file types we have no text-extraction path for yet (video/image/slides) —
// callers use that to distinguish "nothing to index" from "indexed, but
// empty".
async function extractText(buffer, filename) {
   const ext = path.extname(filename).toLowerCase();

   if (ext === ".pdf") {
      let parser;
      try {
         parser = new PDFParse({ data: buffer });
         const result = await parser.getText();
         return result?.text || "";
      } finally {
         if (parser) await parser.destroy();
      }
   }

   if (ext === ".txt") {
      return buffer.toString("utf-8");
   }

   return null;
}

const documentFilter = (documentId) => ({
   must: [{ key: "metadata.documentId", match: { value: documentId } }],
});

// Removes every chunk previously ingested for a given document. Scoped to
// `documentId` via a metadata filter, so — unlike the old bulk ingest,
// which wiped the whole collection — this never touches any other
// document's chunks.
export async function removeDocumentChunks(documentId) {
   const client = getQdrantClient();
   await ensureQdrantCollection(client, COLLECTION_NAME);
   const { count } = await client.count(COLLECTION_NAME, {
      filter: documentFilter(documentId),
      exact: true,
   });
   if (count > 0) {
      await client.delete(COLLECTION_NAME, { filter: documentFilter(documentId) });
   }
   return count;
}

// Ingest (or re-ingest) a single uploaded document into the shared
// collection. This is what actually makes an uploaded document answerable
// by the RAG pipeline — it's called from the backend right after a
// document is saved (see document.controller.js).
//
// Chunks are tagged with `documentId` and `moduleId` metadata so that:
//   - re-uploading/replacing a file can cleanly remove its old chunks first
//     (see removeDocumentChunks) instead of piling up duplicates, and
//   - retrieval can eventually be scoped to a module/course (see
//     server.js's /submit-question), instead of searching every course's
//     material at once.
export async function ingestSingleDocument({ buffer, filename, documentId, moduleId }) {
   if (!documentId) throw new Error("documentId is required");
   if (!buffer || !filename) throw new Error("buffer and filename are required");

   const text = await extractText(buffer, filename);
   if (text === null) {
      return { skipped: true, reason: `No text-extraction support for this file type: ${filename}` };
   }
   if (text.trim().length === 0) {
      return { skipped: true, reason: `No readable text found in ${filename}` };
   }

   const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 150,
   });

   const chunks = await textSplitter.createDocuments([text], [{ source: filename }]);

   // Clear out any chunks left over from a previous ingest of this same
   // document (e.g. the file was replaced) before adding the new ones.
   await removeDocumentChunks(documentId);

   const metadata = { source: filename, documentId };
   if (moduleId) metadata.moduleId = moduleId;

   const vectorStore = await getVectorStore();
   await vectorStore.addDocuments(
      chunks.map((c) => ({ pageContent: c.pageContent, metadata }))
   );

   return { skipped: false, chunksIngested: chunks.length };
}

// Bulk seed path — reads every PDF in ./course_materials and replaces the
// entire collection with their contents. This is the original ingestion
// logic (still used by `node ingest.js` for manually seeding demo course
// materials); it is NOT used by the live upload flow anymore, which calls
// ingestSingleDocument above instead.
export async function ingestDocuments() {
   const directoryPath = "./course_materials";
   const absolutePath = path.resolve(directoryPath);

   console.log(`\n📂 Reading PDFs from: ${absolutePath}`);
   const documents = [];

   if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);
      console.log(`Created missing directory. Please add PDFs to it.`);
      return { chunksIngested: 0, filesProcessed: 0 };
   }

   const files = fs.readdirSync(directoryPath);

   for (const file of files) {
      if (file.startsWith("$") || file.startsWith("~") || file.startsWith(".")) {
         continue;
      }

      if (file.endsWith(".pdf")) {
         const filePath = path.join(directoryPath, file);
         const dataBuffer = fs.readFileSync(filePath);
         let parser;
         try {
            parser = new PDFParse({ data: dataBuffer });
            const result = await parser.getText();
            const rawText = result?.text || "";
            const charCount = rawText.trim().length;

            if (charCount > 0) {
               console.log(` Read ${file}: Extracted ${charCount} characters`);
               documents.push({
                  pageContent: rawText,
                  metadata: { source: file }
               });
            } else {
               console.log(` Skipped ${file}: No readable text found.`);
            }
         } catch (err) {
            console.error(` Failed to parse ${file}:`, err.message);
         } finally {
            if (parser) await parser.destroy();
         }
      }
   }

   if (documents.length === 0) {
      console.log("\n No valid PDFs found.");
      return { chunksIngested: 0, filesProcessed: 0 };
   }

   console.log("\n2. Splitting text into chunks...");
   const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 150,
   });

   const chunks = await textSplitter.createDocuments(
      documents.map(doc => doc.pageContent),
      documents.map(doc => doc.metadata)
   );

   console.log("3. Connecting to Qdrant & Gemini...");
   const client = getQdrantClient();

   // Wipe the collection so a re-seed never piles up duplicates. Unlike the
   // old Chroma setup (where delete + recreate broke server.js's cached
   // collection handle until restart), Qdrant is addressed by name on every
   // call, so the running server keeps working without a restart.
   try {
      await client.deleteCollection(COLLECTION_NAME);
   } catch {
      // Collection didn't exist yet — nothing to wipe.
   }
   await ensureQdrantCollection(client, COLLECTION_NAME);

   console.log("4. Pushing vectors to database...");
   const vectorStore = await getVectorStore();
   await vectorStore.addDocuments(
      chunks.map((c) => ({ pageContent: c.pageContent, metadata: c.metadata }))
   );

   console.log(`🎉 Ingestion complete! Saved ${chunks.length} chunks.`);
   return { chunksIngested: chunks.length, filesProcessed: documents.length };
}
