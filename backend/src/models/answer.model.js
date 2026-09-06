import mongoose, { Schema } from "mongoose";

const answerSchema = new Schema({
   question: { 
      type: Schema.Types.ObjectId, 
      ref: 'Question', 
      required: true 
   },
   text: { 
      type: String, 
      required: true, 
      trim: true 
   },
   isCorrect: { 
      type: Boolean, 
      default: false 
   },
   status: {
      type: String,
      enum: ['draft', 'reviewed', 'published'],
      default: 'draft',
      index: true
   },
   reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
   },
   reviewedAt: {
      type: Date
   },
   publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
   },
   publishedAt: {
      type: Date
   },
   order: { 
      type: Number, 
      default: 0 
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

// Auto-exclude soft-deleted answers — see Course/Module/Question for the same pattern.
answerSchema.pre(/^find/, function (next) {
   this.where({ isDeleted: false });
});

export const Answer = mongoose.model("Answer", answerSchema);