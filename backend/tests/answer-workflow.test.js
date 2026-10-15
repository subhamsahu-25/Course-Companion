// Answer status machine: draft -> reviewed -> published (terminal),
// reviewed can go back to draft for edits. Anything else is a 409.
import { describe, test, expect } from "vitest";
import { transitionAnswer, VALID_TRANSITIONS } from "../src/services/answer-workflow.service.js";

const mockAnswer = (status) => ({
   status,
   save: async function () {
      this.saved = true;
      return this;
   },
});

describe("transitionAnswer", () => {
   test("draft -> reviewed stamps reviewer", async () => {
      const answer = mockAnswer("draft");
      const out = await transitionAnswer(answer, "reviewed", "ta-1");
      expect(out.status).toBe("reviewed");
      expect(out.reviewedBy).toBe("ta-1");
      expect(out.reviewedAt).toBeInstanceOf(Date);
      expect(out.saved).toBe(true);
   });

   test("draft -> published throws 409", async () => {
      await expect(transitionAnswer(mockAnswer("draft"), "published", "x")).rejects.toMatchObject({
         statusCode: 409,
      });
   });

   test("reviewed -> published stamps publisher", async () => {
      const out = await transitionAnswer(mockAnswer("reviewed"), "published", "admin-1");
      expect(out.status).toBe("published");
      expect(out.publishedBy).toBe("admin-1");
   });

   test("reviewed -> draft allowed (send back for edits)", async () => {
      const out = await transitionAnswer(mockAnswer("reviewed"), "draft", "ta-1");
      expect(out.status).toBe("draft");
   });

   test("published is terminal", async () => {
      await expect(transitionAnswer(mockAnswer("published"), "draft", "x")).rejects.toMatchObject({
         statusCode: 409,
      });
   });

   test("unknown status has no exits", () => {
      expect(VALID_TRANSITIONS.bogus || []).toEqual([]);
   });
});
