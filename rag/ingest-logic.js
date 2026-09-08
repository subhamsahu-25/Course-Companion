import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChromaClient } from "chromadb";
import { PDFParse } from "pdf-parse";

const COLLECTION_NAME = "course_collection";

class CustomOllamaEmbedder {
   constructor(baseUrl) {
      this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
   }

   async generate(texts) {
      const embeddings = [];
      for (const text of texts) {
         const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               model: "nomic-embed-text",
               prompt: text
            })
         });
         const data = await response.json();
         embeddings.push(data.embedding);
      }
      return embeddings;
   }
}

// Both ingest.js and the old version of this file hardcoded
// `{ host: "localhost", port: 8000 }`, ignoring CHROMA_URL entirely. That
// happened to work only because localhost:8000 is also the default. Reading
// CHROMA_URL here means this still works out of the box, but also works if
// Chroma ever runs somewhere else (e.g. a docker-compose service name).
function getChromaClient() {
   const url = process.env.CHROMA_URL || "http://localhost:8000";
   const parsed = new URL(url);
   return new ChromaClient({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 8000,
      ssl: parsed.protocol === "https:",
   });
}

async function getCollection() {
   const client = getChromaClient();
   const embedder = new CustomOllamaEmbedder();
   return client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embedder,
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

// Removes every chunk previously ingested for a given document. Scoped to
// `documentId` via a metadata filter, so — unlike the old bulk ingest,
// which wiped the whole collection — this never touches any other
// document's chunks.
export async function removeDocumentChunks(documentId, collection) {
   const col = collection || (await getCollection());
   const existing = await col.get({ where: { documentId } });
   if (existing.ids.length > 0) {
      await col.delete({ ids: existing.ids });
   }
   return existing.ids.length;
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

   const collection = await getCollection();

   // Clear out any chunks left over from a previous ingest of this same
   // document (e.g. the file was replaced) before adding the new ones.
   await removeDocumentChunks(documentId, collection);

   const metadata = { source: filename, documentId };
   if (moduleId) metadata.moduleId = moduleId;

   const ids = chunks.map((_, i) => `doc_${documentId}_chunk_${i}`);
   await collection.add({
      ids,
      documents: chunks.map((c) => c.pageContent),
      metadatas: chunks.map(() => metadata),
   });

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

   console.log("3. Connecting to ChromaDB & local Ollama...");
   const collection = await getCollection();

   // IMPORTANT: we no longer delete/recreate the collection here.
   // server.js opens a Chroma vectorstore connection once at startup and
   // caches a reference to the collection as it exists at that moment.
   // Deleting and recreating the collection (even with the same name)
   // gives it a new internal ID, which makes that cached reference stale
   // and causes ChromaNotFoundError on every query until server.js is
   // restarted. Instead, we get-or-create the same collection and just
   // clear out its existing documents, so the collection's identity never
   // changes and server.js keeps working without a restart.
   const existing = await collection.get();
   if (existing.ids.length > 0) {
      await collection.delete({ ids: existing.ids });
      console.log(`Cleared ${existing.ids.length} existing chunks.`);
   }

   console.log("4. Pushing vectors to database...");
   const ids = chunks.map((_, i) => `chunk_${Date.now()}_${i}`);
   await collection.add({
      ids: ids,
      documents: chunks.map(c => c.pageContent),
      metadatas: chunks.map(c => ({ source: c.metadata.source }))
   });

   console.log(`🎉 Ingestion complete! Saved ${chunks.length} chunks.`);
   return { chunksIngested: chunks.length, filesProcessed: documents.length };
}
