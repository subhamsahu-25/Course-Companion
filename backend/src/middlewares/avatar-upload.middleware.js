import multer from "multer";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
   if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/webp") {
      return cb(null, true);
   }
   return cb(new Error("Only JPG, PNG or WebP images are allowed"), false);
};

const avatarUpload = multer({
   storage,
   fileFilter,
   limits: { fileSize: MAX_AVATAR_SIZE },
});

export { avatarUpload, MAX_AVATAR_SIZE };
