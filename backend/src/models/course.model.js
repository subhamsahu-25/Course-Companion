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
      // 5-digit numeric code, shared by the instructor/admin with students
      // and TAs so they can self-enroll instead of every course being
      // visible to every account platform-wide.
      joinCode: {
         type: String,
         required: true,
         unique: true,
         index: true
      },
      students: [{
         type: Schema.Types.ObjectId,
         ref: 'User'
      }],
      tas: [{
         type: Schema.Types.ObjectId,
         ref: 'User'
      }],
      modules: [{
         type: Schema.Types.ObjectId,
         ref: 'Module'
      }],
      isPublished: {
         type: Boolean,
         default: false
      },
      // Distinct-TA important marks needed before a question highlights on
      // the instructor portal. Per-course (not global): a solo-TA course
      // can set 1, a large course can demand more. Defaults to 2, the
      // prior hardcoded bar — older courses without the field behave as
      // before until an admin sets it.
      importantThreshold: {
         type: Number,
         default: 2,
         min: 1
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