// backend/scripts/purge-soft-deleted.js
//
// One-off cleanup for rows left behind by the OLD soft-delete flow, from
// before deleteCourse/deleteModule were rewritten to hard-delete.
//
// Why this is needed: every model (Course, Module, Question, Document,
// Answer) has a
//   schema.pre(/^find/, function (next) { this.where({ isDeleted: false }); })
// hook, so any Mongoose query (including the app's own duplicate-slug
// check in createCourse) silently never sees a row with isDeleted: true —
// but the row still physically exists in the collection, and still trips
// unique indexes (e.g. Course.slug), still gets returned by aggregations,
// etc.
//
// This script talks to the raw MongoDB collections directly (bypassing
// Mongoose entirely, so the pre-find hook can't hide anything from it),
// finds every document still flagged isDeleted: true, and permanently
// removes it — across all five collections in one pass. It also cleans
// up what a hard delete of those Document rows would have cleaned up:
//   - the uploaded file on disk (backend/uploads/<filename>)
//   - the document's chunks/vectors in the rag service's Chroma store
//
// Usage (from backend/):
//   node scripts/purge-soft-deleted.js
//
// Safe to run more than once — if there's nothing left with
// isDeleted: true, it just reports 0 deleted and exits. File/rag cleanup
// is best-effort per document: a missing file or an unreachable rag
// service logs a warning but doesn't stop the rest of the purge.
//
// NOTE: This is a destructive, irreversible operation. It's meant to be
// run once against your Atlas cluster to clear out pre-hard-delete
// leftovers. Consider taking a quick Atlas backup/snapshot first if
// you're not sure what's in there.

import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import * as ragService from "../src/services/rag.service.js";

const COLLECTIONS = ["courses", "modules", "questions", "documents", "answers"];

async function purgeDocumentFilesAndVectors(connection) {
   const documentsCollection = connection.connection.collection("documents");

   const staleDocuments = await documentsCollection
      .find({ isDeleted: true })
      .project({ _id: 1, url: 1, isIndexed: 1, title: 1 })
      .toArray();

   if (staleDocuments.length === 0) return;

   console.log(
      `  documents: cleaning up files/vectors for ${staleDocuments.length} soft-deleted document(s)...`
   );

   for (const doc of staleDocuments) {
      // Delete the file off disk, if it had one.
      if (doc.url) {
         const filePath = path.resolve("uploads", path.basename(doc.url));
         try {
            await fs.promises.unlink(filePath);
            console.log(`    - deleted file for ${doc._id} (${doc.title || "untitled"})`);
         } catch (err) {
            if (err.code !== "ENOENT") {
               console.warn(
                  `    ! could not delete file for ${doc._id}: ${err.message}`
               );
            }
            // ENOENT (file already gone) is fine — nothing to clean up.
         }
      }

      // Remove its chunks from the vector store, if it was ever indexed.
      if (doc.isIndexed) {
         try {
            await ragService.removeIngestedDocument(doc._id.toString());
            console.log(`    - removed vectors for ${doc._id}`);
         } catch (err) {
            console.warn(
               `    ! could not remove vectors for ${doc._id} (is the rag service running?): ${err.message}`
            );
         }
      }
   }
}

async function run() {
   if (!process.env.MONGODB_URI || !process.env.DB_NAME) {
      console.error("MONGODB_URI and DB_NAME must be set (see backend/.env.example).");
      process.exit(1);
   }

   const connection = await mongoose.connect(
      `${process.env.MONGODB_URI}/${process.env.DB_NAME}`
   );
   console.log(
      `✅ Connected to MongoDB (${connection.connection.host}/${connection.connection.name})`
   );

   // Files + vectors first, while the document rows (with their url/
   // isIndexed fields) still exist to clean up after.
   await purgeDocumentFilesAndVectors(connection);

   let totalDeleted = 0;

   for (const collectionName of COLLECTIONS) {
      const collection = connection.connection.collection(collectionName);

      const toDelete = await collection
         .find({ isDeleted: true })
         .project({ _id: 1, slug: 1, title: 1, text: 1 })
         .toArray();

      if (toDelete.length > 0) {
         console.log(`  ${collectionName}: found ${toDelete.length} soft-deleted document(s):`);
         for (const doc of toDelete) {
            const label = doc.slug || doc.title || doc.text || doc._id.toString();
            console.log(`    - ${doc._id} (${label})`);
         }
      }

      const result = await collection.deleteMany({ isDeleted: true });
      totalDeleted += result.deletedCount;

      console.log(`  ${collectionName}: permanently deleted ${result.deletedCount} document(s)`);
   }

   console.log(`✅ Purge complete. ${totalDeleted} document(s) removed in total.`);
   await mongoose.disconnect();
}

run().catch((error) => {
   console.error("❌ Purge failed:", error);
   process.exit(1);
});