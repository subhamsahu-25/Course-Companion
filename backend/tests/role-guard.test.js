// roleGuard must run AFTER authGuard's req.user: no user -> 401, wrong
// role -> 403, allowed role -> next(). Called directly, no HTTP needed.
import { describe, test, expect, vi } from "vitest";
import { roleGuard } from "../src/middlewares/auth.middleware.js";

const runGuard = (guard, user) => {
   const req = user ? { user } : {};
   const next = vi.fn();
   try {
      guard(req, {}, next);
      return { nextCalls: next.mock.calls.length, error: null };
   } catch (error) {
      return { nextCalls: 0, error };
   }
};

describe("roleGuard", () => {
   test("missing user -> 401", () => {
      const { error } = runGuard(roleGuard("ta"), null);
      expect(error?.statusCode).toBe(401);
   });

   test("wrong role -> 403", () => {
      const { error } = runGuard(roleGuard("ta", "admin"), { role: "student" });
      expect(error?.statusCode).toBe(403);
   });

   test("allowed role calls next", () => {
      const { nextCalls, error } = runGuard(roleGuard("ta", "admin"), { role: "ta" });
      expect(error).toBeNull();
      expect(nextCalls).toBe(1);
   });
});
