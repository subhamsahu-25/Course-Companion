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
   explanation: { // shown after answering by the rag llm model
      type: String, 
      trim: true 
   }, 
}, 
{ 
   timestamps: true 
});

export const Question = mongoose.model("Question", questionSchema);