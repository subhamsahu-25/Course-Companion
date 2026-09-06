# Course Companion — Frontend

React 19 + Vite + Tailwind client for Course Companion. See the
[root README](../README.md) for the overall architecture and how this fits
in with the `backend` and `rag` services.

## Setup

```bash
cp .env.example .env   # set VITE_API_BASE_URL to point at your backend
npm install
npm run dev
```

## Roles

The UI adapts based on the logged-in user's role (returned by the
backend on login):

- **admin / instructor** — create and manage courses, modules, documents,
  and quiz questions.
- **ta** — review the queue of AI-drafted answers to student questions,
  approve (optionally editing) or reject each one.
- **student** — browse course modules/documents, ask questions, and view
  answers once a TA has approved them.

## Structure

- `src/pages/` — one folder per role (`admin/`, `ta/`, `student/`), plus
  the shared `Login.jsx`.
- `src/layouts/RoleLayout.jsx` + `src/components/Sidebar.jsx` — the shell
  and role-aware navigation shown once logged in.
- `src/api/client.js` — the only place that talks to the backend; all
  requests go through `request()`, which sends cookies (`credentials:
  "include"`) so the httpOnly JWT cookies set by the backend are used
  automatically.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
