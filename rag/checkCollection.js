import { ChromaClient } from "chromadb";

class CustomOllamaEmbedder {
   async generate(texts) {
      const embeddings = [];
      for (const text of texts) {
         const response = await fetch("http://localhost:11434/api/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "nomic-embed-text", prompt: text })
         });
         const data = await response.json();
         embeddings.push(data.embedding);
      }
      return embeddings;
   }
}

const client = new ChromaClient({ host: "localhost", port: 8000, ssl: false });
const collection = await client.getCollection({
   name: "course_collection",
   embeddingFunction: new CustomOllamaEmbedder()
});

console.log("Total chunks:", await collection.count());
const peek = await collection.peek({ limit: 3 });
console.log(JSON.stringify(peek, null, 2));