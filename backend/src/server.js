import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import connectDB from "./db/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 8000;

// Connect to MongoDB on function invocation
connectDB().catch((err) => {
   console.error("MongoDB connection failed !!!", err);
});

// Only listen on a port when running locally (not on Vercel)
if (process.env.NODE_ENV !== "production") {
   connectDB().then(() => {
      app.listen(PORT, () => {
         console.log(`Server is running on port http://localhost:${PORT}`);
      });
   });
}

// Export app so Vercel can handle serverless requests
export default app;