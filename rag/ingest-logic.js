import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChromaClient } from "chromadb";
import { PDFParse } from "pdf-parse";

class CustomOllamaEmbedder {
   async generate(texts) {
      const embeddings = [];
      for (const text of texts) {
         const response = await fetch("http://localhost:11434/api/embeddings", {
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
      // Skip hidden Windows files, temporary Word locks, and macOS system files
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
   const client = new ChromaClient({ host: "localhost", port: 8000, ssl: false });

   const embedder = new CustomOllamaEmbedder();

   // IMPORTANT: we no longer delete/recreate the collection here.
   // server.js opens a Chroma vectorstore connection once at startup and
   // caches a reference to the collection as it exists at that moment.
   // Deleting and recreating the collection (even with the same name)
   // gives it a new internal ID, which makes that cached reference stale
   // and causes ChromaNotFoundError on every query until server.js is
   // restarted. Instead, we get-or-create the same collection and just
   // clear out its existing documents, so the collection's identity never
   // changes and server.js keeps working without a restart.
   const collection = await client.getOrCreateCollection({
      name: "course_collection",
      embeddingFunction: embedder
   });

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