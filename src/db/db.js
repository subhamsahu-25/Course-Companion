import mongoose from "mongoose";

const connectDB = async () => {
   try {
      const connectionInstance = await mongoose.connect(
         `${process.env.MONGODB_URI}/${process.env.DB_NAME}`
      );

      console.log(
         `✅ MongoDB connected! DB host: ${connectionInstance.connection.host}`
      );
   } catch (error) {
      console.error("❌ MongoDB connection failed:", error.message);
      process.exit(1); // fail fast — no point running the server without a DB
   }
};

export default connectDB;