import mongoose, { Schema } from "mongoose";

const courseSchema = new Schema({
   title: { 
      type: String, 
      required: true, 
      trim: true 
   },
   description: { 
      type: String, 
      trim: true 
   },
   instructor: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
   },
   modules: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Module' 
   }],
   isPublished: { 
      type: Boolean, 
      default: false 
   },
},
{ 
   timestamps: true
});

export const Course = mongoose.model("Course", courseSchema);