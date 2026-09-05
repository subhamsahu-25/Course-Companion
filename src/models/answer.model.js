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
   order: { 
      type: Number, 
      default: 0 
   },
}, 
{ 
   timestamps: true 
});

export const Answer = mongoose.model("Answer", answerSchema);