import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFParse } from "pdf-parse";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
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

// Chat model shared by overview + figure captions. Env-overridable like
// server.js (GEMINI_MODEL) so quota-constrained testing can drop to
// flash-lite without code changes.
function getChatModel() {
   return new ChatGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      temperature: 0,
   });
}

// Figures, charts, and equations are invisible to text extraction —
// without this step every diagram in a PDF is silently lost to the
// pipeline. Embedded images are captioned through the vision-capable
// chat model (formulas transcribed as text) and ingested as ordinary
// chunks tagged { figure: true, page }, so they're retrievable and
// citable like everything else. Bounded (MAX_FIGURES, MIN_DIM) so one
// image-heavy PDF can't blow up ingest cost; every figure is best-effort
// and the whole step never fails the ingest.
const MAX_FIGURES = 8;
const MIN_FIGURE_DIM = 200;

async function captionAndChunkFigures(buffer, baseMetadata, vectorStore) {
   let parser;
   try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getImage().catch(() => null);
      const pages = result?.pages || [];
      const figures = [];
      for (let i = 0; i < pages.length && figures.length < MAX_FIGURES; i++) {
         const pageNum = pages[i]?.num ?? i + 1;
         for (const img of pages[i]?.images || []) {
            if (figures.length >= MAX_FIGURES) break;
            if ((img.width || 0) < MIN_FIGURE_DIM && (img.height || 0) < MIN_FIGURE_DIM) continue;
            if (!img.dataUrl) continue;
            figures.push({ page: pageNum, dataUrl: img.dataUrl });
         }
      }
      if (figures.length === 0) return 0;

      const llm = getChatModel();

      let ingested = 0;
      for (const figure of figures) {
         try {
            const raw = await llm.invoke([
               new HumanMessage({
                  content: [
                     {
                        type: "text",
                        text: "Describe this figure, chart, or equation in plain sentences a student can learn from. " +
                           "Transcribe any formulas, labels, numbers, and axis titles exactly as shown. " +
                           "If it carries no learnable information, reply with exactly: NO_CONTENT.",
                     },
                     { type: "image_url", image_url: { url: figure.dataUrl } },
                  ],
               }),
            ]);
            const text = typeof raw?.content === "string" ? raw.content : String(raw?.content ?? "");
            if (!text.trim() || text.trim() === "NO_CONTENT.") continue;
            const caption = text.trim().replace(/^NO_CONTENT\.?$/i, "").trim();
            if (!caption) continue;

            const chunks = await chunkPages(
               [{ page: figure.page, text: `Figure on page ${figure.page}: ${caption}` }],
               { ...baseMetadata, figure: true }
            );
            await vectorStore.addDocuments(chunks);
            ingested += chunks.length;
         } catch (err) {
            console.error(`Figure caption failed (page ${figure.page}):`, err.message);
         }
      }
      return ingested;
   } catch (err) {
      console.error("Figure extraction failed:", err.message);
      return 0;
   } finally {
      if (parser) await parser.destroy().catch(() => {});
   }
}

// One short LLM call per upload — deliberately separate from chunking so
// a failure here can never fail the ingest itself (callers treat null as
// "no blurb"). Reads only the opening of the document: titles and
// headings live up front, which is what an orientation blurb needs.
async function generateOverview(pages) {
   const head = pages
      .map((p) => p.text)
      .join("\n")
      .slice(0, 5000);
   if (head.trim().length < 200) return null;

   const llm = getChatModel();
   const raw = await llm.invoke(
      "Summarize what the document below covers in 3-4 plain sentences, " +
      "so a student can decide whether to read it. Use the document's own " +
      "terms for topics and names. No preamble, no bullet list, just the " +
      "summary.\n\nDocument:\n" + head
   );
   const text = typeof raw?.content === "string"
      ? raw.content
      : String(raw?.content ?? "");
   return text.trim().slice(0, 800) || null;
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

// Extracts per-page text from a file buffer: [{ page, text }]. Page numbers
// are what power the "which PDF, which page, which line" citation tags —
// chunk metadata records them, so answers stay traceable to their source
// location. Returns `null` (not an array) for file types we have no
// text-extraction path for yet (video/image/slides) — callers use that to
// distinguish "nothing to index" from "indexed, but empty" ([]).
// Exported for diagnostics / future tests (see checkRetrieval.js) —
// ingestion itself only uses these internally.
export async function extractPages(buffer, filename) {
   const ext = path.extname(filename).toLowerCase();

   if (ext === ".pdf") {
      let parser;
      try {
         parser = new PDFParse({ data: buffer });
         // One pass yields both the concatenated text and the per-page
         // breakdown (TextResult.pages: [{ num, text }]).
         const result = await parser.getText();
         const pages = (result?.pages || [])
            .map((p) => ({ page: p.num, text: p.text || "" }))
            .filter((p) => p.text.trim().length > 0);
         if (pages.length > 0) return pages;
         const flat = result?.text || "";
         return flat.trim().length > 0 ? [{ page: 1, text: flat }] : [];
      } finally {
         if (parser) await parser.destroy();
      }
   }

   if (ext === ".txt") {
      const text = buffer.toString("utf-8");
      // Plain text has no pages — everything lives on page 1, with real
      // line numbers inside it.
      return text.trim().length > 0 ? [{ page: 1, text }] : [];
   }

   return null;
}

// Locates a chunk inside its page text and converts the character offset
// into 1-based line numbers (lines = newline-split page text). Approximate
// by nature — chunk overlap means boundaries are fuzzy — but it points at
// the right region of the page, which is what the citation tag promises.
function locateLines(pageText, chunkText) {
   const anchor = chunkText.slice(0, 80);
   const found = pageText.indexOf(anchor);
   const start = found < 0 ? 0 : found;
   const lineStart = pageText.slice(0, start).split("\n").length;
   const lineEnd = pageText.slice(0, start + chunkText.length).split("\n").length;
   return { lineStart, lineEnd };
}

// Splits each page separately so chunks never straddle a page boundary
// (which would make their page number a lie), tagging every chunk with
// its page + line range alongside the caller-supplied base metadata.
export async function chunkPages(pages, baseMetadata) {
   const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 150,
   });
   const out = [];
   for (const { page, text } of pages) {
      const chunks = await textSplitter.createDocuments([text], [{ source: baseMetadata.source }]);
      for (const c of chunks) {
         const { lineStart, lineEnd } = locateLines(text, c.pageContent);
         out.push({
            pageContent: c.pageContent,
            metadata: { ...baseMetadata, page, lineStart, lineEnd },
         });
      }
   }
   return out;
}

const documentFilter = (documentId) => ({
   must: [{ key: "metadata.documentId", match: { value: documentId } }],
});

// Builds a Qdrant filter scoping points to one course and/or one module.
// Every retrieval path funnels through this so a question asked in course A
// can never draw on course B's material. Either key may be absent (legacy
// chunks, unscoped queries) — absent keys simply don't constrain.
export function scopeFilter({ courseId, moduleId } = {}) {
   const must = [];
   if (courseId) must.push({ key: "metadata.courseId", match: { value: courseId } });
   if (moduleId) must.push({ key: "metadata.moduleId", match: { value: moduleId } });
   return must.length > 0 ? { must } : undefined;
}

// sha256 of the extracted text — the idempotency key for incremental
// ingestion. Same text re-uploaded (retry, duplicate upload, re-seed)
// short-circuits before any embedding call, so re-ingests are free.
function contentHash(text) {
   return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

// Returns the stored content hash for a documentId, or null when nothing
// is indexed for it yet.
async function storedContentHash(documentId) {
   const client = getQdrantClient();
   await ensureQdrantCollection(client, COLLECTION_NAME);
   const { points } = await client.scroll(COLLECTION_NAME, {
      filter: documentFilter(documentId),
      limit: 1,
      with_payload: true,
      with_vector: false,
   });
   return points?.[0]?.payload?.metadata?.contentHash ?? null;
}

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

// Removes every chunk in a course/module scope — documents, TA-verified
// ("golden") answers, anything carrying the scope tags. Used when a course
// is hard-deleted so neither material nor learned answers outlive it. At
// least one of moduleIds / courseId is required; refuses to run unscoped
// rather than risk wiping the whole collection.
export async function removeScopeChunks({ moduleIds, courseId } = {}) {
   const ids = Array.isArray(moduleIds) ? moduleIds.filter(Boolean) : [];
   if (ids.length === 0 && !courseId) {
      throw new Error("removeScopeChunks requires moduleIds or courseId");
   }
   const must = [];
   if (ids.length > 0) {
      must.push({ key: "metadata.moduleId", match: { any: ids } });
   }
   if (courseId) {
      must.push({ key: "metadata.courseId", match: { value: courseId } });
   }
   const client = getQdrantClient();
   await ensureQdrantCollection(client, COLLECTION_NAME);
   const filter = { must };
   const { count } = await client.count(COLLECTION_NAME, { filter, exact: true });
   if (count > 0) {
      await client.delete(COLLECTION_NAME, { filter });
   }
   return count;
}

// Ingest (or re-ingest) a single uploaded document into the shared
// collection. This is what actually makes an uploaded document answerable
// by the RAG pipeline — it's called from the backend right after a
// document is saved (see document.controller.js).
//
// Incremental: the extracted text is hashed, and when the stored hash for
// this documentId already matches, ingestion short-circuits before a single
// embedding call — retries and duplicate uploads are free. Changed content
// removes the old chunks first (see removeDocumentChunks) instead of
// piling up duplicates.
//
// Chunks are tagged with `documentId`, `moduleId`, and `courseId` metadata
// so retrieval can be scoped to the asking student's course/module (see
// scopeFilter + server.js's /submit-question) instead of searching every
// course's material at once.
export async function ingestSingleDocument({ buffer, filename, documentId, moduleId, courseId }) {
   if (!documentId) throw new Error("documentId is required");
   if (!buffer || !filename) throw new Error("buffer and filename are required");

   const pages = await extractPages(buffer, filename);
   if (pages === null) {
      return { skipped: true, reason: `No text-extraction support for this file type: ${filename}`, overview: null };
   }
   if (pages.length === 0) {
      return { skipped: true, reason: `No readable text found in ${filename}`, overview: null };
   }

   const hash = contentHash(pages.map((p) => p.text).join("\n"));
   if ((await storedContentHash(documentId)) === hash) {
      return { skipped: true, reason: "unchanged — same content already indexed", contentHash: hash, overview: null };
   }

   // Clear out any chunks left over from a previous ingest of this same
   // document (e.g. the file was replaced) before adding the new ones.
   await removeDocumentChunks(documentId);

   const metadata = { source: filename, documentId, contentHash: hash };
   if (moduleId) metadata.moduleId = moduleId;
   if (courseId) metadata.courseId = courseId;

   const chunks = await chunkPages(pages, metadata);
   const vectorStore = await getVectorStore();
   await vectorStore.addDocuments(chunks);

   // Figures/diagrams the text extractor can't see (best-effort, bounded).
   const figureChunks = await captionAndChunkFigures(buffer, metadata, vectorStore);

   // Orientation blurb for the student portal — best-effort: an LLM outage
   // must never fail the ingest, worst case this document just shows no
   // blurb until re-uploaded.
   let overview = null;
   try {
      overview = await generateOverview(pages);
   } catch (err) {
      console.error(`Overview generation failed for ${filename}:`, err.message);
   }

   return { skipped: false, chunksIngested: chunks.length + figureChunks, contentHash: hash, overview };
}

// Ingests a TA-approved answer back into the collection as a "golden"
// chunk set, so the pipeline learns from human review instead of repeating
// mistakes TAs already corrected. Keyed as documentId `golden:<reviewId>`
// with remove-then-add, so re-approving the same item never duplicates.
//
// Golden chunks carry the question's course/module scope (they only ever
// answer for that scope) and the TA's star rating when one was given.
export async function ingestGoldenAnswer({ question, answer, reviewId, moduleId, courseId, rating }) {
   if (!reviewId) throw new Error("reviewId is required");
   if (!answer || answer.trim().length === 0) {
      return { skipped: true, reason: "empty answer — nothing to learn from" };
   }

   const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 150,
   });
   const chunks = await textSplitter.createDocuments(
      [answer],
      [{ source: "TA-verified answer" }]
   );
   // Plus the question itself as a match target: related-question search
   // is question-to-question (strong signal), while answer chunks match
   // question-to-answer (weak — question words rarely appear in answers).
   // Without this, near-random answers surface as "related".
   const questionChunk = {
      pageContent: `Question: ${question}`,
      metadata: { source: "TA-verified answer" },
   };

   const documentId = `golden:${reviewId}`;
   await removeDocumentChunks(documentId);

   const metadata = {
      source: "TA-verified answer",
      documentId,
      golden: true,
      contentHash: contentHash(answer),
      // Qdrant keyword payloads need comparable scalars — keep the question
      // short and the rating numeric-or-absent.
      question: String(question ?? "").slice(0, 500),
   };
   if (moduleId) metadata.moduleId = moduleId;
   if (courseId) metadata.courseId = courseId;
   if (rating !== null && rating !== undefined) metadata.rating = rating;

   const vectorStore = await getVectorStore();
   await vectorStore.addDocuments(
      chunks.map((c) => ({ pageContent: c.pageContent, metadata }))
   );
   // The question chunk carries the same scope/rating, flagged so related
   // search can prefer question-to-question matches.
   await vectorStore.addDocuments([
      {
         pageContent: questionChunk.pageContent,
         metadata: { ...metadata, questionChunk: true },
      },
   ]);

   return { skipped: false, chunksIngested: chunks.length + 1 };
}

// Bulk seed path — reads every PDF in ./course_materials and upserts each
// file's chunks idempotently (still used by `node ingest.js` for manually
// seeding demo course materials); it is NOT used by the live upload flow,
// which calls ingestSingleDocument above instead.
//
// Incremental, never destructive: each file is keyed as documentId
// `seed:<filename>` with a content hash, so re-running the seed only
// re-embeds files that actually changed. Files removed from the directory
// have their seeded chunks swept — scoped to `seeded:true` points only, so
// live-uploaded documents are never touched. (The old version wiped the
// whole collection on every run, including live uploads.)
export async function ingestDocuments() {
   const directoryPath = "./course_materials";
   const absolutePath = path.resolve(directoryPath);

   console.log(`\n📂 Reading PDFs from: ${absolutePath}`);

   if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);
      console.log(`Created missing directory. Please add PDFs to it.`);
      return { chunksIngested: 0, filesProcessed: 0 };
   }

   const files = fs.readdirSync(directoryPath).filter(
      (file) =>
         file.endsWith(".pdf") &&
         !file.startsWith("$") &&
         !file.startsWith("~") &&
         !file.startsWith(".")
   );

   if (files.length === 0) {
      console.log("\n No valid PDFs found — leaving the collection untouched.");
      return { chunksIngested: 0, filesProcessed: 0 };
   }

   const vectorStore = await getVectorStore();

   let chunksIngested = 0;
   let filesProcessed = 0;
   for (const file of files) {
      const dataBuffer = fs.readFileSync(path.join(directoryPath, file));
      try {
         const pages = await extractPages(dataBuffer, file);
         if (!pages || pages.length === 0) {
            console.log(` Skipped ${file}: No readable text found.`);
            continue;
         }

         const documentId = `seed:${file}`;
         const hash = contentHash(pages.map((p) => p.text).join("\n"));
         if ((await storedContentHash(documentId)) === hash) {
            console.log(` Skipped ${file}: unchanged since last seed.`);
            continue;
         }

         await removeDocumentChunks(documentId);
         const seedMetadata = {
            source: file,
            documentId,
            seeded: true,
            contentHash: hash,
         };
         const chunks = await chunkPages(pages, seedMetadata);
         await vectorStore.addDocuments(chunks);
         const figureChunks = await captionAndChunkFigures(dataBuffer, seedMetadata, vectorStore);
         chunksIngested += chunks.length + figureChunks;
         filesProcessed += 1;
         console.log(` Ingested ${file}: ${chunks.length} chunks + ${figureChunks} figure captions.`);
      } catch (err) {
         console.error(` Failed to parse ${file}:`, err.message);
      }
   }

   // Sweep seeded chunks whose file is gone from the directory. Scoped to
   // `seeded:true` — live uploads (seeded absent) can never match.
   const client = getQdrantClient();
   const sweepFilter = {
      must: [{ key: "metadata.seeded", match: { value: true } }],
      must_not: [{ key: "metadata.source", match: { any: files } }],
   };
   const { count: stale } = await client.count(COLLECTION_NAME, {
      filter: sweepFilter,
      exact: true,
   });
   if (stale > 0) {
      await client.delete(COLLECTION_NAME, { filter: sweepFilter });
      console.log(` Swept ${stale} stale seeded chunks (files removed).`);
   }

   console.log(`🎉 Seed complete! ${chunksIngested} chunks across ${filesProcessed} changed files.`);
   return { chunksIngested, filesProcessed };
}
