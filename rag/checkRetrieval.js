import 'dotenv/config';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";

const embeddings = new GoogleGenerativeAIEmbeddings({
   apiKey: process.env.GEMINI_API_KEY,
   model: "gemini-embedding-001",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
   url: process.env.QDRANT_URL,
   apiKey: process.env.QDRANT_API_KEY,
   collectionName: process.env.QDRANT_COLLECTION || "course_collection",
});

const query = process.argv[2] || "what are the july tasks?";
console.log("Query:", query);

const results = await vectorStore.similaritySearchWithScore(query, 5);

console.log(
   JSON.stringify(
      results.map(([doc, score]) => ({
         score,
         pageContent: doc.pageContent.slice(0, 300),
         metadata: doc.metadata,
      })),
      null,
      2
   )
);
