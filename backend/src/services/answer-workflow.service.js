// services/answer-workflow.service.js
import { ApiError } from "../utils/api-error.js";

const VALID_TRANSITIONS = {
   draft: ["reviewed"],
   reviewed: ["published", "draft"], // allow sending back for edits
   published: [], // terminal — add "draft" here if you want to allow unpublishing
};

const transitionAnswer = async (answer, targetStatus, userId) => {
   const allowed = VALID_TRANSITIONS[answer.status] || [];
   if (!allowed.includes(targetStatus)) {
      throw new ApiError(
         409,
         `Cannot transition from '${answer.status}' to '${targetStatus}'`
      );
   }

   answer.status = targetStatus;
   if (targetStatus === "reviewed") {
      answer.reviewedBy = userId;
      answer.reviewedAt = new Date();
   }
   if (targetStatus === "published") {
      answer.publishedBy = userId;
      answer.publishedAt = new Date();
   }

   await answer.save();
   return answer;
};

export { transitionAnswer, VALID_TRANSITIONS };