import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema({
   title: {
      type: String,
      required: true,
      trim: true
   },
   module: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true
   },
   type: {
      type: String,
      enum: ['pdf', 'video', 'article', 'slides', 'link', 'other'],
      default: 'other'
   },
   fileSizeBytes: {
      type: Number,
      max: [50 * 1024 * 1024, 'File size cannot exceed 50 MB']
   },
   url: { // for hosted files / external links
      type: String
   },
   // Whether this document has been chunked + embedded into the RAG
   // vector store yet. Only pdf/article (txt) files can be indexed today —
   // other types (video/slides/link/other) stay false since there's no
   // text-extraction path for them.
   isIndexed: {
      type: Boolean,
      default: false,
   },
   indexingError: {
      type: String,
      default: null,
   },
   order: {
      type: Number,
      default: 0
   },
   durationSeconds: { // for video content
      type: Number
   },
   isDeleted: {
      type: Boolean,
      default: false,
      index: true
   },
   deletedAt: {
      type: Date,
      default: null
   },
},
   {
      timestamps: true
   });

// Auto-exclude soft-deleted documents — see Course/Module for the same pattern.
documentSchema.pre(/^find/, function (next) {
   this.where({ isDeleted: false });
});

export const Document = mongoose.model("Document", documentSchema);