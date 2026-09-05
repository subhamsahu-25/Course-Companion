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
}, 
{ 
   timestamps: true
});

export const Module = mongoose.model("Module", moduleSchema);