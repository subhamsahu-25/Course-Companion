import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema({
   module: { 
      type: Schema.Types.ObjectId, 
      ref: 'Module', 
      required: true 
   },
   text: { 
      type: String, 
      required: true, 
      trim: true 
   },
   type: {
      type: String,
      enum: ['single-choice', 'multiple-choice', 'true-false', 'short-answer'],
      default: 'single-choice',
   },
   answers: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Answer' 
   }],
   order: { 
      type: Number, 
      default: 0 
   },
   points: {
      type: Number,
      default: 1,
      min: 0
   },
   explanation: { // shown after answering by the rag llm model
      type: String, 
      trim: true 
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

// Auto-exclude soft-deleted questions — see Course/Module for the same pattern.
questionSchema.pre(/^find/, function (next) {
   this.where({ isDeleted: false });
});

export const Question = mongoose.model("Question", questionSchema);