import 'dotenv/config';
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

async function ingestDocuments() {
    const directoryPath = "./course_materials";
    const absolutePath = path.resolve(directoryPath);
    
    console.log(`\n📂 Reading PDFs from: ${absolutePath}`);
    const documents = [];
    
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath);
        console.log(`Created missing directory. Please add PDFs to it.`);
        return;
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
                // pdf-parse v2 uses a class-based API: pass the buffer via
                // { data: buffer } and call getText() to actually extract text.
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
                // Release the underlying PDF resources
                if (parser) await parser.destroy();
            }
        }
    }

    if (documents.length === 0) {
        console.log("\n No valid PDFs found. Add a real PDF containing text to the folder above and run again.");
        return;
    }

    console.log("\n2. Splitting text into chunks...");
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });
    
    const chunks = await textSplitter.createDocuments(
        documents.map(doc => doc.pageContent),
        documents.map(doc => doc.metadata)
    );

    console.log("3. Connecting to ChromaDB & local Ollama...");
    const client = new ChromaClient({ path: "http://localhost:8000" });
    
    const embedder = new CustomOllamaEmbedder();
    
    const collection = await client.getOrCreateCollection({
        name: "course_collection",
        embeddingFunction: embedder
    });

    console.log("4. Pushing vectors to database...");
    const ids = chunks.map((_, i) => `chunk_${Date.now()}_${i}`);
    await collection.add({
        ids: ids,
        documents: chunks.map(c => c.pageContent),
        metadatas: chunks.map(c => c.metadata)
    });

    console.log(`🎉 Ingestion complete! Saved ${chunks.length} chunks.`);
}

ingestDocuments();
