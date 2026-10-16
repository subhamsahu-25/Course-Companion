# Course Companion — Feature Inventory & Engineering Notes

A role-based course Q&A platform where students ask questions about course material, a RAG pipeline drafts grounded answers, and **teaching assistants review every answer before it reaches a student** — with a human-in-the-loop feedback system that teaches the pipeline from each correction.

This document is the complete feature list plus the "why" behind each decision, written to double as interview talking points.

---

## 1. Platform at a glance

| | |
|---|---|
| **Architecture** | 3 services — React SPA → Express backend → Node RAG service |
| **Frontend** | React 19, Vite, Tailwind CSS v4 |
| **Backend** | Node.js, Express 5, Mongoose, JWT, bcrypt |
| **RAG service** | Node.js, Express, LangChain, Google Gemini, Qdrant |
| **Vector DB** | Qdrant Cloud (3072-dim, cosine) |
| **Storage** | MongoDB (shared DB) + Cloudinary (files/avatars) |
| **Roles** | admin, instructor, ta, student |
| **Auth** | short-lived access token (15m) + refresh token (7d), cookie **and** Bearer |

---

## 2. Roles & permissions

| Capability | Student | TA | Instructor | Admin |
|---|:--:|:--:|:--:|:--:|
| Join a course with a code | ✓ | ✓ | — (auto) | — (auto) |
| Browse modules + open material | ✓ | ✓ | ✓ | ✓ |
| Ask questions (RAG) | ✓ | — | — | — |
| Follow-up thread chatbot | ✓ | — | — | — |
| View own question history/stats | ✓ | — | — | — |
| Save/unsave related answers | ✓ | — | — | — |
| Review queue (approve/reject/edit/rate) | — | ✓ | — | ✓ |
| Flag question "important" | — | ✓ | — | ✓ |
| Module history (all statuses) | — | ✓ | — | ✓ |
| Create courses/modules, upload material | — | — | ✓ (own) | ✓ |
| Manage roster (remove members) | — | — | ✓ (own) | ✓ |
| Instructor analytics (quality/gaps/important) | — | — | ✓ (own) | ✓ |
| Bring-your-own Gemini key | ✓ | — | ✓ | ✓ |

Guarded server-side by `authGuard` + `roleGuard(...)` and by `assertCourseAccess()` (membership), never by the UI alone.

---

## 3. Authentication & account features

- **Registration** with role selection, username, email, roll number, full name.
- **Email verification** — login is hard-blocked until verified; verification link travels as `?verifyToken=...` (no SPA route config needed on Vercel), then the token is scrubbed from the URL.
- **Dual-channel tokens** — httpOnly cookies **plus** in-memory access/refresh tokens mirrored as `Authorization: Bearer`. Compensates for cross-site cookies (Vercel → Railway) being dropped by some browsers.
- **Silent refresh** — a 401 on any non-auth call triggers one `/auth/refresh-token` + retry; auth endpoints are excluded so a wrong password isn't masked as an expired session.
- **Session restore on reload** — one explicit refresh before `current-user`, with an 8-second fail-safe so a down backend never leaves the app stuck on "Loading…".
- **Forgot / reset password** — emailed link, reset/verify screens take priority over an active session.
- **Change password** and **avatar upload** (Cloudinary, JPG/PNG/WebP ≤ 5MB) from the Account page.
- **Join-code enrollment** — unique 5-digit code per course; which list you land in (`students` vs `tas`) is decided by your own account role server-side.

## 4. Course, module & document management

- **Courses** with title, slug, description, tags, unique join code, publish/draft toggle.
- **Instructor isolation** — instructors only ever see courses they own; students/TAs only courses they've joined; admins see everything. Enforced in one place (`hasCourseAccess` + `accessibleCourseFilter`), never by the UI alone.
- **Modules** ordered within a course; material is uploaded per module.
- **Document upload** — PDF/TXT, up to 20MB (backend enforces ≤ 50MB `fileSizeBytes`); real **XHR upload progress** with an indexing estimate ("RAG is chunking this file… ~Xs left") and an honest overrun message instead of a fake countdown.
- **Durable storage** — files go straight to Cloudinary; the app no longer touches local disk (Railway's disk is ephemeral and used to wipe uploads on redeploy).
- **Access-controlled download** — Cloudinary URLs are only handed out after `assertCourseAccess`; the old static `/uploads` mount was removed on purpose.
- **Soft delete** — Documents/Modules/Questions/Answers carry `isDeleted`/`deletedAt` with a `pre(/^find/)` filter; hard cascade only for whole-course delete.
- **Auto-generated orientation blurbs** — each PDF gets a 3–4 sentence summary (generated at ingest) shown as a collapsible "About this PDF" on the student's module view.

## 5. The RAG Q&A system (the core)

### 5.1 Asking

- **Instant answers** — an exact-normalized match or a golden-chunk cosine ≥ 0.80 serves a previously verified answer with **no TA wait**; the UI shows *which* verified question matched.
- **Related answers while typing** — debounced semantic search surfaces already-verified answers in the same module before the student even submits; they can save one into their history instead of filing a new question.
- **TA review by default** — anything not instantly verifiable becomes a `pending` item; the student polls `/my-answer/:id` and is told when it's ready.
- **Follow-up threads** — a chatbot mode where follow-ups inherit the thread's resolved history as context and are answered synchronously (they skip review because they're never used to teach).

### 5.2 Grounding & retrieval

- **Scope isolation** — every retrieval funnels through `scopeFilter` on `courseId`/`moduleId`; one course's material can never answer another course's question. The course id is derived server-side from the module, never trusted from the client.
- **Golden-first context** — TA-approved answers are retrieved separately and placed *ahead of* raw material so a human correction beats the document that produced the original mistake.
- **Strict grounded prompt** — answer from context only, reuse the source's exact terms/numbers, bullet multi-point answers, and respond exactly `"I don't know."` when the material can't answer. A separate **relaxed prompt** for follow-ups allows labelled general knowledge (`(Beyond course material)`).
- **Real citations** — the documents actually placed in context are recorded on the item (source file, page, line range), *not* the model's self-reported sources; the history view renders file + page tags.
- **Retrieval confidence** — the top cosine score is stored on each draft, letting the TA queue triage shakiest-first.

### 5.3 Ingestion

- **Idempotent, incremental** — a per-document sha256 of extracted text skips re-embeds on retry/duplicate; changed content removes old points first. Re-seeding only re-embeds changed files.
- **Page + line metadata** — chunks never straddle pages, and each carries `page`/`lineStart`/`lineEnd` for traceable citations.
- **Figure captioning** — the vision-capable model describes diagrams/charts and transcribes equations that text extraction can't see (bounded: ≤ 8 figures, ≥ 200px, best-effort).
- **Document-type awareness** — only PDF/article produce text; other types are stored but not indexed (explicitly surfaced, not silently lost).
- **Scope-aware cleanup** — `removeDocumentChunks`, `removeScopeChunks`, and a seeded-only sweep on re-seed; refuses to run unscoped.

## 6. TA review workflow

- **Course/module filters with red pending-count badges**, computed live from the queue.
- **Approve as-is, edit-then-approve, or reject with an optional note.**
- **Optional 1–5 star rating** that decides whether the answer teaches the pipeline (`null` or ≥ 3 teaches; 1–2★ stays out).
- **Retry** for a stuck pending item whose generation failed (with attempt count and the raw error shown).
- **Important flag** — checkbox per question; reaching the course's own `importantThreshold` (default 2 distinct-TA marks, configurable by an admin on the course's Modules page) highlights it to the instructor. The section always renders (with an empty state), and each module card has a "See important questions" link that scrolls + filters to that module.
- **Module history** — every question in a module across all statuses, with "My reviews" narrowing.
- **Optimistic UI** — cards leave instantly with a 1-second acknowledgement beat; failures roll the card back and show an error.
- **Approval email** — fire-and-forget "your answer is ready" notification to the student.

## 7. Instructor analytics portal

- **Important questions** — questions TAs collectively flagged (at or above the per-course threshold), hottest first, each labelled by module — plus the threshold editor itself.
- **Answer quality** — avg TA rating, improved-vs-approved-as-is, approved/rejected/pending outcomes, mean resolution time (asked → resolved).
- **Content gaps** — per-module count of `"I don't know."` drafts — the curriculum radar for material students needed but didn't have.
- **Roster management** — students and TAs per course with questions-asked / reviews-resolved counts, sorted by roll number, with removal.

## 8. BYOK — bring-your-own Gemini key

- **Encrypted vault** — AES-256-GCM (`iv:authTag:ciphertext`), keyed by a 64-hex `GEMINI_KEY_SECRET`.
- **One cheap Google ping** validates the key on save; network failure saves anyway (indeterminate ≠ invalid).
- **Per-key health map** keyed by sha256 (never the key): `quota` cools until next Pacific midnight, `invalid` parks until the key changes.
- **Funding ladder** — user key → shared primary → shared fallback, advancing only on quota-shaped failures.
- **Approximate metering** — usage counted on supply (Google exposes no per-key quota API), reset on the day boundary; the Account page shows status + today's count.
- **Privacy** — the plaintext key is never returned, logged, or embedded in any response; only the tail is shown once at save time.
- **Strain nudge** — when the shared pool is exhausted and a student has no key, the Ask page points them to Account.

## 9. Platform & reliability features

- **Tiered rate limiting** — global 300/15min, auth 10/15min, ask 50/hr; `trust proxy` set for Railway.
- **Hardening** — `helmet`, `express.json` limited to 16kb, service-key gate on every RAG route (fails loud if unset), CORS allow-list.
- **Error hygiene** — a normalising error handler maps Cast/Validation/duplicate-key/JWT/Multer errors to correct statuses; the frontend folds 422 field details into readable messages.
- **Human-readable outage messages** — HTML error pages from a sleeping RAG/backend are detected and translated instead of surfacing "Unexpected token '<'".
- **Stateless RAG** — Qdrant Cloud holds vectors server-side, so redeploys lose nothing; MongoDB persists the review queue (the old in-memory Map lost everything on restart).
- **Privacy-first logout** — cached catalog data is wiped per user id so nothing personal survives on a shared machine.

---

## 10. Engineering decisions worth explaining (interview points)

**"Why a separate RAG service?"** — Isolation of the heavy ML dependency chain (LangChain, Gemini, Qdrant) from the auth/course CRUD path; independent scaling and deploys; a shared service key keeps its internal endpoints (approve/reject, any student's answers) off the public internet.

**"Why does a TA review everything?"** — Student trust is the product. An unreviewed hallucination is worse than a slow answer, so the default path is human-in-the-loop. The instant/live paths only re-serve **already-verified** content.

**"How do you stop bad answers from spreading?"** — Answers only teach the pipeline at `null`/≥3★ approval (`GOLDEN_MIN_RATING = 3`); instant-serve and related only surface `SERVABLE_RATINGS` (null or ≥3). Poor drafts can't self-perpetuate.

**"How is the auto-serve threshold chosen?"** — Empirically. On real golden answers, true paraphrases score 0.84–0.98 and unrelated same-scope questions top out at 0.70, so 0.80 sits in the clean gap (`calibrate-goldens.js`). An exact-normalized-text leg bypasses it entirely because it can't false-positive.

**"How do you avoid duplicate ingestion cost?"** — sha256 content hashing as an idempotency key; retries and duplicate uploads short-circuit before any embedding call. Re-seeding sweeps only `seeded:true` points so live uploads are never touched.

**"Two embedding models must match — how do you keep that safe?"** — `gemini-embedding-001` is pinned in both ingest and query paths and documented next to `EMBEDDING_DIM = 3072`; Qdrant fixes the dimension at collection creation, so a model switch forces a conscious new collection.

**"How do you handle a sleeping free-tier service?"** — Detected as an HTML content-type, translated to a clear message; every cross-service call is best-effort on the delete paths and degrades gracefully on the analytics paths.

**"Why percent-encode nothing and use `?token=` for files?"** — Direct file links open in a new tab where no header can be attached and cross-site cookies may be blocked; `authGuard` accepts the access token as a query param for exactly that case, after which access is still membership-checked.

**"Cookies aren't reliable cross-site — how do you stay logged in?"** — Dual channels: cookies where allowed, in-memory Bearer everywhere, one silent refresh-and-retry on 401, and an explicit refresh on cold reload so an idle tab doesn't sign out.

---

## 11. Endpoint surface (backend → RAG)

| Backend route | RAG endpoint | Purpose |
|---|---|---|
| `POST /documents/module/:id` (upload) | `POST /ingest` | chunk/embed a new document |
| course delete | `POST /ingest/purge` | scope-wide vector purge |
| document delete | `DELETE /ingest/:documentId` | remove one document's chunks |
| `POST /qa/ask` | `POST /submit-question` | ask (instant / thread / queue) |
| `GET /qa/related` | `GET /related-questions` | live verified matches |
| `POST /qa/save` / `unsave` | `POST /save-answer` / `/unsave-answer` | clone/remove verified answers |
| `GET /qa/queue` | `GET /review-queue` | pending items for TAs |
| `POST /qa/queue/:id/approve` | `POST /review-queue/:id/approve` | approve (+ golden ingest) |
| `POST /qa/queue/:id/reject` | `POST /review-queue/:id/reject` | reject |
| `POST /qa/queue/:id/retry` | `POST /review-queue/:id/retry` | regenerate failed draft |
| `POST /qa/queue/:id/important` | `POST /review-queue/:id/important` | toggle important mark |
| `GET /qa/important` | `GET /review-queue/important` | instructor highlights |
| `GET /qa/course-stats` | `GET /review-queue/course-stats` | activity + quality + gaps |
| `GET /qa/my-answer/:id` | `GET /my-answer/:id` | single status/answer |
| `GET /qa/my-answers` | `GET /my-answers/:studentId` | history |
| `GET /qa/stats` | `GET /my-answers` (re-scoped) | dashboard counts, scoped to current enrollments |
| `GET /qa/history/:moduleId` | `GET /module-history/:moduleId` | TA module history |
| (BYOK health) | `GET /user-key-health?hash=` | funding decision |
| (quota nudge) | `GET /health` | shared-pool strain signal |
| course/member delete | `POST /review-queue/purge` / `purge-member` | Q&A history cleanup |
