// App-level guarantees via supertest — no database needed because every
// assertion hits validation, headers, or routing that runs before any DB
// call: helmet headers present, rate-limit headers present, empty login
// rejected by validators (400) rather than reaching the controller.
import { describe, test, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("security headers + validation", () => {
   test("helmet headers on the homepage", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
   });

   test("rate-limit headers are emitted", async () => {
      const res = await request(app).get("/");
      expect(res.headers["ratelimit-limit"]).toBeDefined();
   });

   test("empty login body fails validation, not the controller", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
   });

   test("unknown route is a 404", async () => {
      const res = await request(app).get("/api/v1/nope-not-real");
      expect(res.status).toBe(404);
   });
});
