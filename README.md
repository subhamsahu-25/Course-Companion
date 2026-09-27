# Course Companion

An AI-assisted course Q&A tool. Students ask questions about course
material; a retrieval-augmented (RAG) pipeline drafts an answer from the
uploaded course documents; a TA reviews and approves or rejects the draft
before the student ever sees it. Admins and instructors manage courses,
modules, and quiz-style questions.

## Architecture

This is a three-service project:

| Service    | Path        | Stack                                                | Responsibility |
|------------|-------------|-------------------------------------------------------|----------------|
| `backend`  | `/backend`  | Node.js, Express, MongoDB (Mongoose)                   | Auth, courses/modules/documents, quiz questions & answers, proxies Q&A to `rag` |
| `rag`      | `/rag`      | Node.js, Express, LangChain, Gemini, Qdrant, MongoDB | Ingests course PDFs into a vector store; runs the RAG pipeline; persists the TA review queue |
| `frontend` | `/frontend` | React 19, Vite, Tailwind                               | Admin/Instructor, TA, and Student UIs |

The `frontend` only ever talks to `backend`. `backend` is the only service
that talks to `rag` (authenticated with a shared service key — see below).

**Roles:** `admin`, `instructor`, `ta`, `student`. Anyone can self-register
as `student`, `instructor`, or `ta`; `admin` accounts must be created
directly in the database (there's no self-registration path for it, by
design).

## Prerequisites

- Node.js 18+
- MongoDB (local install or a connection string, e.g. from Atlas)
- [Ollama](https://ollama.com) running locally, with the `llama3` and
  `nomic-embed-text` models pulled:
  ```bash
  ollama pull llama3
  ollama pull nomic-embed-text
  ```
- [ChromaDB](https://docs.trychroma.com/) running locally (e.g.
  `chroma run --path ./chroma-data` or via Docker)

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

First, put course PDFs in `rag/course_materials/`, then ingest them into
ChromaDB (this wipes and rebuilds the collection each time it's run):

```bash
cd rag
npm install
node ingest.js
```

Then start the service:

```bash
npm run dev      # or: npm start
```

Runs on the port set in `rag/.env` (default `3000`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite's dev server prints the local URL (default `http://localhost:5173`).

## Retrieval scoping & feedback loop

- Every chunk carries `courseId`/`moduleId` tags and every question is
  asked within a course scope, so retrieval never crosses course
  boundaries. (Bulk-seeded PDFs from before this carry no scope tags and
  only match unscoped queries — re-run `node ingest.js` to tag them.)
- Ingestion is incremental: re-uploads of identical content short-circuit
  on a content hash, and `node ingest.js` upserts per file instead of
  wiping the collection.
- Approving an answer feeds it back into the vector store as a
  TA-verified ("golden") chunk that takes precedence in future drafts.
  Golden ingestion happens for unrated approvals and ratings ≥ 3;
  answers rated 1–2 are kept out so poor drafts can't self-perpetuate.
- TAs can attach an optional 1–5 star rating on approve (1 very poor …
  5 very good). Left unattended it stays null — "unrated" is distinct
  from "rated poorly".
- Answers carry traceable citations: every chunk is tagged with its
  source file, page, and line range at ingest time, and generation
  records the actually-retrieved documents on each question — so student
  history shows a PDF-name tag plus a page/line tag per answer. (Cited
  from retrieval, never from the model's self-reported SOURCES line.)

## Known limitations

- No automated tests yet.
