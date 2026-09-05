import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import connectDB from "./db/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 8000;

connectDB()
   .then(() => {
      app.listen(PORT, () => {
         console.log(`Server is running on port http://localhost:${PORT}`);
      });
   })
   .catch((err) => {
      console.error("MongoDB connection failed !!!", err);
      process.exit(1);
   });