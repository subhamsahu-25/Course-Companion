import mongoose, { Schema } from "mongoose";

const courseSchema = new Schema(
   {
      title: {
         type: String,
         required: true,
         trim: true
      },
      slug: {
         type: String,
         required: true,
         unique: true,
         lowercase: true,
         trim: true,
         index: true
      },
      description: {
         type: String,
         trim: true
      },
      tags: [{
         type: String,
         trim: true,
         lowercase: true
      }],
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
      isDeleted: {
         type: Boolean,
         default: false,
         index: true
      },
      deletedAt: {
         type: Date,
         default: null
      }
   },
   {
      timestamps: true
   }
);

// Auto-exclude soft-deleted courses on any find/findOne/findOneAndUpdate queries
courseSchema.pre(/^find/, function (next) {
   this.where({ isDeleted: false });
});

export const Course = mongoose.model("Course", courseSchema);