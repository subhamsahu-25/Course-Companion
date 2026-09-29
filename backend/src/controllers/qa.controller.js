// backend/src/controllers/qa.controller.js — update askQuestion, add getStats
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Module } from "../models/module.model.js";
import { Course } from "../models/course.model.js";
import { User } from "../models/user.model.js";
import { answerApprovedMailgenContent, sendEmail } from "../utils/mail.js";
import { resolveHealthyUserKey, recordKeyUsage, syncKeyOutcome } from "../services/user-key.service.js";
import * as ragService from "../services/rag.service.js";
import { assertCourseAccess } from "../utils/course-access.js";

const askQuestion = asyncHandler(async (req, res) => {
   // threadId joins the question to a follow-up thread (History →
   // "Follow up"); absent means a fresh thread. Never trusted beyond
   // scoping — the module's course check below still gates everything.
   const { question, moduleId, threadId } = req.body;
   if (!question) throw new ApiError(400, "Question is required");
   if (!moduleId) throw new ApiError(400, "A module is required");

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   // Trust the server's own membership check here, not just the fact that
   // the client sent a moduleId — otherwise the module dropdown is only a
   // UI nicety and anyone could still submit questions against courses
   // they were never given the join code for.
   assertCourseAccess(module.course, req.user);

   // The course id is derived server-side from the module (already
   // populated above for the access check) — never trusted from the client.
   // It scopes the question's retrieval to this course's material, so one
   // course's documents can never answer another course's questions.
   const courseId = module.course._id.toString();
   // BYOK funding: the asker's own key first (their quota), shared pool
   // otherwise. Metered on supply (attempt made) — approximate by design,
   // since fire-and-forget generation reports no synchronous outcome.
   // Synchronous outcomes (direct answers) additionally sync key state.
   const userKey = await resolveHealthyUserKey(req.user);
   const result = await ragService.submitQuestion(req.user._id.toString(), question, moduleId, courseId, threadId, userKey);
   if (userKey) {
      recordKeyUsage(req.user._id.toString());
      if (result?.fundedBy || result?.userKeyStatus) {
         syncKeyOutcome(req.user._id.toString(), result.fundedBy, result.userKeyStatus);
      }
   }
   // Instant answers and direct follow-up answers skip review entirely —
   // say so plainly instead of pointing the student at a queue their
   // question never entered.
   const message = result?.autoServed
      ? "Answered instantly from a verified answer"
      : result?.threadAnswered
         ? "Answered"
         : "Question submitted for review";
   return res.status(200).json(new ApiResponse(200, result, message));
});

const getReviewQueue = asyncHandler(async (req, res) => {
   const queue = await ragService.getReviewQueue();

   // Triage order: shakiest drafts first (lowest retrieval confidence,
   // unknown-confidence last), then oldest first. A TA opening the queue
   // meets the drafts most likely to be wrong before the routine ones.
   queue.sort((a, b) => {
      const ca = a.confidence ?? Number.POSITIVE_INFINITY;
      const cb = b.confidence ?? Number.POSITIVE_INFINITY;
      if (ca !== cb) return ca - cb;
      return new Date(a.createdAt) - new Date(b.createdAt);
   });

   // Admins oversee every course, same as elsewhere in the app — no
   // filtering needed for them.
   if (req.user.role === "admin") {
      return res.status(200).json(new ApiResponse(200, queue, "Review queue fetched"));
   }

   // TAs only review questions for courses they've joined. Previously this
   // endpoint had no course scoping at all — any TA saw every pending
   // question platform-wide, regardless of which course(s) they actually
   // belonged to.
   const moduleIds = [...new Set(queue.map((item) => item.moduleId).filter(Boolean))];
   const modules = await Module.find({ _id: { $in: moduleIds } })
      .populate("course")
      .lean();

   const taId = req.user._id.toString();
   const accessibleModuleIds = new Set(
      modules
         .filter((m) => m.course?.tas?.some((id) => id.toString() === taId))
         .map((m) => m._id.toString())
   );

   const filtered = queue.filter(
      (item) => item.moduleId && accessibleModuleIds.has(item.moduleId)
   );

   return res.status(200).json(new ApiResponse(200, filtered, "Review queue fetched"));
});

const approveQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;
   // rating is the TA's 1–5 star score, or null/undefined when left
   // unattended. Range-checked in the rag service (400 on invalid) — passed
   // straight through here. reviewedBy records WHO resolved it (server-side
   // identity, never trusted from the client) for the instructor's
   // per-TA reviewed counts.
   const { editedAnswer, rating } = req.body;
   const result = await ragService.approveAnswer(id, editedAnswer, rating, req.user._id.toString());

   // "Your answer is ready" email — fire-and-forget on purpose: sendEmail
   // already swallows its own failures, and a notification must never slow
   // down (or fail) the approval itself. Auto-served answers skip this —
   // the student got them instantly, no waiting involved.
   if (result?.studentId) {
      User.findById(result.studentId)
         .select("email fullName username")
         .lean()
         .then((student) => {
            if (!student?.email) return;
            return sendEmail({
               email: student.email,
               subject: "Your answer is ready — Course Companion",
               mailgenContent: answerApprovedMailgenContent(
                  student.fullName || student.username || "there",
                  result?.question || "your question"
               ),
            });
         })
         .catch((err) => console.error(`Approval email failed for ${id}:`, err.message));
   }

   return res.status(200).json(new ApiResponse(200, result, "Answer approved"));
});

const rejectQuestion = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { note } = req.body;
   const result = await ragService.rejectAnswer(id, note, req.user._id.toString());
   return res.status(200).json(new ApiResponse(200, result, "Answer rejected"));
});

// Retries generation for a stuck pending item whose draft failed. The new
// draft lands on next queue refresh — nothing else about the item changes.
const retryAnswer = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const result = await ragService.retryAnswer(id);
   return res.status(200).json(new ApiResponse(200, result, "Answer generation retried"));
});

// Toggles the calling TA's important mark on a question. Any TA (or admin)
// may mark; unmarking is the same call again (checkbox semantics).
const toggleImportant = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const result = await ragService.toggleImportant(id, req.user._id.toString());
   return res.status(200).json(new ApiResponse(200, result, "Important mark toggled"));
});

// Questions in a course with enough TA important marks to highlight —
// shown on the instructor portal below the TA roster, questions only.
const getImportantQuestions = asyncHandler(async (req, res) => {
   const { courseId } = req.query;
   if (!courseId) throw new ApiError(400, "courseId query param is required");

   const course = await Course.findById(courseId);
   if (!course) throw new ApiError(404, "Course not found");
   assertCourseAccess(course, req.user);

   const result = await ragService.getImportantQuestions(courseId);
   return res.status(200).json(new ApiResponse(200, result, "Important questions fetched"));
});

// Per-course activity for the instructor portal: how many questions each
// student asked, how many reviews each TA resolved. Rag returns bare ids +
// counts; user names/roll numbers are joined here where the User model lives.
const getCourseQaStats = asyncHandler(async (req, res) => {
   const { courseId } = req.query;
   if (!courseId) throw new ApiError(400, "courseId query param is required");

   const course = await Course.findById(courseId);
   if (!course) throw new ApiError(404, "Course not found");
   assertCourseAccess(course, req.user);

   const { asked, reviewed } = await ragService.getCourseQaStats(courseId);
   const ids = [
      ...new Set([...asked.map((a) => a.studentId), ...reviewed.map((r) => r.taId)]),
   ];
   const users = await User.find({ _id: { $in: ids } })
      .select("fullName username rollNo")
      .lean();
   const byId = new Map(users.map((u) => [u._id.toString(), u]));

   return res.status(200).json(
      new ApiResponse(
         200,
         {
            asked: asked.map((a) => ({ ...a, user: byId.get(a.studentId) || null })),
            reviewed: reviewed.map((r) => ({ ...r, user: byId.get(r.taId) || null })),
         },
         "Course Q&A stats fetched"
      )
   );
});

// Live related answers for the ask form: verified answers in the same
// module matching what the student is typing. Scoped through the
// module's own course — same membership check as asking.
const getRelatedQuestions = asyncHandler(async (req, res) => {
   const { moduleId, q } = req.query;
   if (!moduleId) throw new ApiError(400, "moduleId query param is required");
   if (!q || q.trim().length < 3) return res.status(200).json(new ApiResponse(200, [], "Related questions fetched"));

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   assertCourseAccess(module.course, req.user);

   const result = await ragService.getRelatedQuestions(moduleId, module.course._id.toString(), q.trim());
   return res.status(200).json(new ApiResponse(200, result, "Related questions fetched"));
});

// Shared-quota strain signal for the frontend nudge ("out of shared
// answers — add your key"). Strained = a shared failure within the last
// 6h; older blips and fresh restarts read as healthy.
const getQuotaStatus = asyncHandler(async (req, res) => {
   try {
      const health = await ragService.getQuotaStatus();
      const lastFailure = health?.sharedQuota?.lastFailureAt
         ? new Date(health.sharedQuota.lastFailureAt).getTime()
         : null;
      const strained = lastFailure !== null && Date.now() - lastFailure < 6 * 3600 * 1000;
      return res.status(200).json(new ApiResponse(200, { strained }, "Quota status fetched"));
   } catch {
      // Rag unreachable — no signal either way, never block the UI on it.
      return res.status(200).json(new ApiResponse(200, { strained: false }, "Quota status fetched"));
   }
});

// Saves a verified related answer into the student's own history (same
// course + module). No generation, no review — the source already passed
// both. Membership is checked on the module before anything is cloned.
const saveAnswer = asyncHandler(async (req, res) => {
   const { sourceId, moduleId } = req.body;
   if (!sourceId) throw new ApiError(400, "sourceId is required");
   if (!moduleId) throw new ApiError(400, "moduleId is required");

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   assertCourseAccess(module.course, req.user);

   const result = await ragService.saveAnswer(
      req.user._id.toString(),
      sourceId,
      moduleId,
      module.course._id.toString()
   );
   return res.status(200).json(new ApiResponse(200, result, "Answer saved to your history"));
});

// Removes one of the student's own saved/instant answers from history.
// Ownership + auto-served checks live in the rag service; the controller
// only forwards the authenticated identity (never trusted from body).
const unsaveAnswer = asyncHandler(async (req, res) => {
   const { requestId } = req.body;
   if (!requestId) throw new ApiError(400, "requestId is required");
   const result = await ragService.unsaveAnswer(req.user._id.toString(), requestId);
   return res.status(200).json(new ApiResponse(200, result, "Saved answer removed"));
});

const getMyAnswer = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const result = await ragService.getMyAnswer(id);
   return res.status(200).json(new ApiResponse(200, result, "Answer status fetched"));
});

const getMyAnswers = asyncHandler(async (req, res) => {
   // Thread (chatbot) items stay out of History — the chatbot is their
   // home. Callers that need the full set (thread view, stats) opt in.
   const includeThreads = req.query.includeThreads === "1";
   const result = await ragService.getMyAnswers(req.user._id.toString(), includeThreads);
   return res.status(200).json(new ApiResponse(200, result, "Answers fetched"));
});

const getStats = asyncHandler(async (req, res) => {
   // rag's own /stats/:id is a flat count over every question this
   // student has ever asked, with no idea what a "course" is. That's what
   // made the dashboard show all-time numbers even for courses the
   // student isn't in (or isn't in anymore) — so instead, pull the raw
   // list and scope it down to their current enrollments here.
   const items = await ragService.getMyAnswers(req.user._id.toString(), true);

   const moduleIds = [...new Set(items.map((item) => item.moduleId).filter(Boolean))];
   const modules = await Module.find({ _id: { $in: moduleIds } }).lean();
   const moduleToCourse = new Map(modules.map((m) => [m._id.toString(), m.course.toString()]));

   const candidateCourseIds = [...new Set(moduleToCourse.values())];
   const myCourses = await Course.find({
      _id: { $in: candidateCourseIds },
      students: req.user._id,
   }).lean();
   const myCourseIds = new Set(myCourses.map((c) => c._id.toString()));

   const scoped = items.filter((item) => {
      const courseId = item.moduleId && moduleToCourse.get(item.moduleId);
      return courseId && myCourseIds.has(courseId);
   });

   const stats = {
      total: scoped.length,
      pending: scoped.filter((i) => i.status === "pending").length,
      approved: scoped.filter((i) => i.status === "approved").length,
      rejected: scoped.filter((i) => i.status === "rejected").length,
   };

   return res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
});

const getModuleHistory = asyncHandler(async (req, res) => {
   const { moduleId } = req.params;

   const module = await Module.findById(moduleId).populate("course");
   if (!module) throw new ApiError(404, "Module not found");
   // Same enrollment check as everywhere else — a TA can only pull
   // history for a module in a course they've actually joined.
   assertCourseAccess(module.course, req.user);

   const history = await ragService.getModuleHistory(moduleId);
   return res.status(200).json(new ApiResponse(200, history, "Module history fetched"));
});

export {
   askQuestion,
   getRelatedQuestions,
   saveAnswer,
   unsaveAnswer,
   retryAnswer,
   getQuotaStatus,
   getReviewQueue,
   approveQuestion,
   rejectQuestion,
   toggleImportant,
   getImportantQuestions,
   getCourseQaStats,
   getMyAnswer,
   getMyAnswers,
   getStats,
   getModuleHistory,
};