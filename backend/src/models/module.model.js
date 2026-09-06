import mongoose, { Schema } from "mongoose";

const moduleSchema = new Schema({
   title: { 
      type: String, 
      required: true, 
      trim: true 
   },
   description: { 
      type: String, 
      trim: true 
   },
   course: { 
      type: Schema.Types.ObjectId, 
      ref: 'Course', 
      required: true 
   },
   order: { // position within course
      type: Number, 
      required: true, 
      default: 0 
   }, 
   documents: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Document' 
   }],
   questions: [{
      type: Schema.Types.ObjectId,
      ref: 'Question'
   }],
   isPublished: {
      type: Boolean,
      default: false
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

// Auto-exclude soft-deleted modules, mirroring Course's soft-delete pattern —
// keeps a soft-deleted course's modules from still being directly reachable
// via /modules/:moduleId or /modules/course/:id.
moduleSchema.pre(/^find/, function (next) {
   this.where({ isDeleted: false });
});

export const Module = mongoose.model("Module", moduleSchema);