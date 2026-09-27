# Course Companion

An AI-assisted course Q&A tool. Students ask questions about course
material; a retrieval-augmented (RAG) pipeline drafts an answer from the
uploaded course documents; a TA reviews and approves or rejects the draft
before the student ever sees it. Admins and instructors manage courses,
modules, and quiz-style questions.

## Live demo

- **App:** <https://course-companion-navy.vercel.app>
- **API:** `https://course-companion-production-2147.up.railway.app/api/v1`

## Architecture

This is a three-service project:

| Service    | Path        | Stack                                                | Responsibility |
|------------|-------------|-------------------------------------------------------|----------------|
| `backend`  | `/backend`  | Node.js, Express, MongoDB (Mongoose)                   | Auth, courses/modules/documents, quiz questions & answers, proxies Q&A to `rag` |
| `rag`      | `/rag`      | Node.js, Express, LangChain, Gemini, Qdrant, MongoDB   | Ingests course PDFs into a vector store; runs the RAG pipeline; persists the TA review queue |
| `frontend` | `/frontend` | React 19, Vite, Tailwind v4                            | Admin/Instructor, TA, and Student UIs |

The `frontend` only ever talks to `backend`. `backend` is the only service
that talks to `rag` (authenticated with a shared service key — see below).

**Roles:** `admin`, `instructor`, `ta`, `student`. Anyone can self-register
as `student`, `instructor`, or `ta`; `admin` accounts must be created
directly in the database (there's no self-registration path for it, by
design).

## What the pipeline does

- **Course-scoped retrieval** — every chunk carries `courseId`/`moduleId`
  tags; questions only ever draw on their own course's material.
- **Incremental ingestion** — re-uploads short-circuit on a content hash;
  the bulk seed upserts per file instead of wiping the collection.
- **TA feedback loop** — approvals (unrated or ≥ 3★) flow back in as
  TA-verified ("golden") chunks that take precedence in future drafts;
  1–2★ answers are quarantined. Optional 1–5 star ratings stay `null`
  when unattended.
- **Traceable citations** — chunks carry source file, page, and line
  ranges; answers show PDF + page tags in student history.
- **Repeat answers** — exact or near-certain matches to verified answers
  serve instantly with no review; related answers surface while typing.
- **Follow-up threads** — chatbot-style threads with shared context;
  direct answers may go beyond the material but are labeled as such.
- **Triage & analytics** — confidence-scored queue (shakiest first),
  content-gap radar, answer-quality panel, per-member activity, and
  TA "important" highlights (2+ marks) for instructors.
- **Figure captions** — embedded diagrams/equations are vision-captioned
  at ingest (bounded, best-effort) so they stay retrievable.
- **Per-PDF orientation blurbs** generated at ingest, shown expandably in
  the student portal.
- **Notifications** — students are emailed when an answer is approved.
- **Optimistic UI + browser cache** — instant submits/removals with
  rollback; per-user catalog cache (wiped on logout) with
  stale-while-revalidate.

## Prerequisites

- Node.js 18+
- MongoDB (local install or a connection string, e.g. from Atlas)
- A [Google AI Studio](https://aistudio.google.com) API key (`GEMINI_API_KEY`)
  — generation uses `gemini-3.6-flash` (overridable via `GEMINI_MODEL`),
  embeddings use `gemini-embedding-001`
- A [Qdrant](https://cloud.qdrant.io) cluster (free tier works);
  `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`
- A [Cloudinary](https://cloudinary.com) account for durable file storage —
  with **Settings → Security → “Allow delivery of PDF and ZIP files”**
  enabled, otherwise uploaded PDFs 401 on delivery even when public
- An SMTP provider for mail — [Brevo](https://www.brevo.com) preferred
  (Railway blocks SMTP ports); [Mailtrap](https://mailtrap.io) works as a
  non-delivering sandbox for dev

## Setup

Each service has its own `.env.example` — copy it to `.env` and fill in the
values before running that service.

```bash
cp backend/.env.example backend/.env
cp rag/.env.example rag/.env
cp frontend/.env.example frontend/.env
```

`RAG_SERVICE_KEY` must be set to the **same value** in `backend/.env` and
`rag/.env` — the backend authenticates to the rag service with it.
`MONGODB_URI` / `DB_NAME` should also point at the same database in both
`backend/.env` and `rag/.env`, since the rag service stores its review
queue there alongside the backend's own collections.

For cross-site auth (frontend and backend on different origins), the
backend needs:

```bash
CORS_ORIGIN=https://your-frontend-url[,http://localhost:5173]
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

Without all three, browsers silently drop the session cookies and every
reload signs the user out.

### 1. Backend

```bash
cd backend
npm install
npm run dev      # nodemon, restarts on change
# or: npm start
```

Runs on the port set in `backend/.env` (default `8000`).

If you have existing data in MongoDB from before the soft-delete support on
`Module`/`Question`/`Document`/`Answer` was added, run this once first:

```bash
npm run migrate:soft-delete
```

(New/empty databases don't need this — it's only for pre-existing documents
that predate the `isDeleted` field.)

### 2. RAG service

First, put course PDFs in `rag/course_materials/`, then seed them
(idempotent per file — re-runs only embed what changed):

```bash
cd rag
npm install
node ingest.js
```

Then start the service:

```bash
npm run dev      # or: npm start
```

Runs on the port set in `rag/.env` (default `3000`). First boot creates
the Qdrant payload indexes automatically. For quota-free local testing
(`gemini-3.6-flash` is ~20 req/day free), set
`GEMINI_MODEL=gemini-3.1-flash-lite` in `rag/.env`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite's dev server prints the local URL (default `http://localhost:5173`).
`VITE_API_BASE_URL` must point at the backend (e.g.
`http://localhost:8888/api/v1`).

The UI theme lives in one place — `frontend/src/index.css` `@theme`
(`--color-bg/surface/accent/heading/body/border/star`). Reskinning is
editing those values; no component carries raw hex.

## Known limitations

- Material ingested before course/page tagging only matches unscoped
  queries — re-upload (or re-seed) to tag it.
- `gemini-3.6-flash` free tier is ~20 requests/day; heavy testing needs
  `GEMINI_MODEL=gemini-3.1-flash-lite` or a paid tier.
- Qdrant Cloud free clusters sleep — first contact after idle can time
  out while the cluster wakes.
- No automated tests yet.
