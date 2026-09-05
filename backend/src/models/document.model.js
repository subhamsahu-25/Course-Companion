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
      default: 'other',
      max: [50 * 1024 * 1024, 'File size cannot exceed 50 MB'] 
   },
   url: { // for hosted files / external links
      type: String 
   }, 
   order: { 
      type: Number, 
      default: 0 
   },
   durationSeconds: { // for video content
      type: Number 
   }, 
}, 
{ 
   timestamps: true 
});

export const Document = mongoose.model("Document", documentSchema);