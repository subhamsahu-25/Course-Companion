// backend/scripts/migrate-soft-delete.js
//
// One-time backfill for the soft-delete rollout on Module, Question,
// Document, and Answer.
//
// Why this is needed: each of those models now has a
//   schema.pre(/^find/, function (next) { this.where({ isDeleted: false }); })
// hook, so every find/findOne/findById/populate call implicitly filters on
// isDeleted: false. MongoDB's query matching treats a missing field as NOT
// equal to false, so any document that existed before this change — and
// therefore has no isDeleted field at all — would silently disappear from
// every query the moment this ships.
//
// Run this once, before deploying the updated models, against the same
// database your backend/.env points at:
//
//   node scripts/migrate-soft-delete.js
//
// It's safe to run more than once — updateMany with an $exists filter only
// touches documents that still need it, so a second run is a no-op.

import "dotenv/config";
import mongoose from "mongoose";

const COLLECTIONS = ["modules", "questions", "documents", "answers"];

async function run() {
   if (!process.env.MONGODB_URI || !process.env.DB_NAME) {
      console.error("MONGODB_URI and DB_NAME must be set (see backend/.env.example).");
      process.exit(1);
   }

   const connection = await mongoose.connect(
      `${process.env.MONGODB_URI}/${process.env.DB_NAME}`
   );
   console.log(`✅ Connected to MongoDB (${connection.connection.host}/${connection.connection.name})`);

   for (const collectionName of COLLECTIONS) {
      const collection = connection.connection.collection(collectionName);

      const result = await collection.updateMany(
         { isDeleted: { $exists: false } },
         { $set: { isDeleted: false, deletedAt: null } }
      );

      console.log(
         `  ${collectionName}: backfilled ${result.modifiedCount} document(s)`
      );
   }

   console.log("✅ Migration complete.");
   await mongoose.disconnect();
}

run().catch((error) => {
   console.error("❌ Migration failed:", error);
   process.exit(1);
});
