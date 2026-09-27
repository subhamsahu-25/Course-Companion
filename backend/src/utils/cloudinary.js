import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// cloudinary.config() at module top-level runs BEFORE server.js's
// dotenv.config() (ESM hoists imports), leaving api_key empty and every
// upload failing with "Must supply api_key". So: load env here too
// (idempotent) and (re)configure lazily at upload time, when env is ready.
dotenv.config({ path: "./.env" });

const configureCloudinary = () => {
   cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
   });
};

configureCloudinary();

const uploadToCloudinary = (
   buffer,
   folder = "course-companion/avatars",
   resourceType = "image"
) => {
   configureCloudinary();
   return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
         { folder, resource_type: resourceType },
         (error, result) => {
            if (error) return reject(error);
            resolve(result);
         }
      );
      stream.end(buffer);
   });
};

// Course documents (PDF/TXT) — "auto" lets Cloudinary serve each type
// correctly instead of forcing image semantics onto a PDF.
const uploadDocumentToCloudinary = (buffer, originalname) => {
   const publicId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
   return new Promise((resolve, reject) => {
      configureCloudinary();
      const stream = cloudinary.uploader.upload_stream(
         {
            folder: "course-companion/documents",
            public_id: publicId,
            resource_type: "auto",
            // Explicitly public: if the cloud ever defaults uploads to
            // authenticated/private, delivery of the stored URL 401s in
            // students' browsers ("deny or ACL failure") even though the
            // upload itself succeeded. Belt and suspenders with the
            // account-level default.
            type: "upload",
            access_mode: "public",
         },
         (error, result) => {
            if (error) return reject(error);
            resolve(result);
         }
      );
      stream.end(buffer);
   });
};

const deleteFromCloudinary = async (publicId) => {
   if (!publicId) return;
   try {
      await cloudinary.uploader.destroy(publicId);
   } catch {
      // best-effort cleanup — a stale image is better than a failed request
   }
};

// Avatar URLs are stored as full https URLs; the public_id is embedded in
// the path after the folder prefix so we can delete the old image on replace.
const publicIdFromUrl = (url) => {
   if (!url || typeof url !== "string") return null;
   const marker = "course-companion/avatars/";
   const idx = url.indexOf(marker);
   if (idx === -1) return null;
   const after = url.slice(idx).split(".")[0];
   return after;
};

export { cloudinary, uploadToCloudinary, uploadDocumentToCloudinary, deleteFromCloudinary, publicIdFromUrl };
