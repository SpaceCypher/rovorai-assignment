# REQUIREMENTS.md — RovorAI Full Stack Assignment

Implementation checklist derived from `docs/RovorAI.com_Full_Stack_Developer_Assignment.pdf` (the source of truth).
Each item has an ID, the PDF section it comes from, acceptance criteria, and how it gets verified.

**Deadline:** Thursday evening, 8 October 2026 · **Budget:** 8–12 h · **Stack (mandated):** TypeScript everywhere, Next.js frontend, Node.js backend.

Legend: `[ ]` not started · `[x]` done and verified · **Verify** = U (unit test), I (API integration test), E (Playwright e2e), M (manual check, recorded in final review).

---

## 1. Functional requirements

### 1.1 Home dashboard (PDF §1)

| ID         | Requirement                                               | Acceptance criteria                                                                                               | Verify |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| [ ] DASH-1 | Dashboard lists all projects as large cards               | `/` renders one card per project from `GET /api/projects`; newest first                                           | I, E   |
| [ ] DASH-2 | Card shows name + short description                       | Description is line-clamped; empty description shows a muted "No description"                                     | M      |
| [ ] DASH-3 | Card shows ticket counts by status                        | Todo / In Progress / Done counts + total, computed server-side; zeros shown as `0`, not hidden                    | I, E   |
| [ ] DASH-4 | Card shows a small selection of recent tickets            | Up to 3 most recently updated tickets (title, status, priority), each links to the ticket                         | I, M   |
| [ ] DASH-5 | Card has "Open project"                                   | Navigates to `/projects/[projectId]`                                                                              | E      |
| [ ] DASH-6 | Card has a `+` action to create a ticket for that project | Opens the create-ticket dialog with the project pre-bound; accessible name "Create ticket in {project}"           | E      |
| [ ] DASH-7 | Dashboard has "Create project"                            | Opens create-project dialog                                                                                       | E      |
| [ ] DASH-8 | Dashboard reflects latest saved state                     | After creating/editing a project or ticket (anywhere), counts and recent tickets update without a browser refresh | E      |

### 1.2 Create project (PDF §2)

| ID         | Requirement                                          | Acceptance criteria                                                                                                                            | Verify |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [ ] PROJ-1 | Create project from dashboard                        | Form: name (required), description, GitHub repo (optional)                                                                                     | E      |
| [ ] PROJ-2 | Accept repo as URL or identifier                     | Accepts `owner/repo`, `https://github.com/owner/repo`, with optional `www.`, `http://`, trailing `/`, `.git`; stored canonical as `owner/repo` | U      |
| [ ] PROJ-3 | Persisted in DB and visible after creation           | `POST /api/projects` → 201; card appears on dashboard immediately                                                                              | I, E   |
| [ ] PROJ-4 | Invalid input rejected with a useful message         | Empty name, over-length fields, non-GitHub host, malformed repo → 400 with field errors shown inline                                           | U, I   |
| [ ] PROJ-5 | Repo that GitHub confirms does not exist is rejected | 422 `REPO_NOT_FOUND`; if GitHub is unreachable/rate-limited, creation still succeeds (best-effort check)                                       | I      |

### 1.3 Project screen (PDF §3)

| ID         | Requirement                              | Acceptance criteria                                                                                            | Verify |
| ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| [ ] PSCR-1 | Dedicated project page                   | `/projects/[projectId]`; unknown/invalid id → "Project not found" state                                        | E, I   |
| [ ] PSCR-2 | Project summary + ticket counts          | Name, description, repo link, counts by status (whole project, unaffected by filters)                          | M      |
| [ ] PSCR-3 | View all tickets of the project          | Ticket list sorted by `updatedAt desc`                                                                         | I      |
| [ ] PSCR-4 | Search tickets                           | Search box → backend query (see SRCH-*)                                                                        | E      |
| [ ] PSCR-5 | Filter by status and priority            | Multi-select chips for each; combinable with search                                                            | E      |
| [ ] PSCR-6 | Open an existing ticket                  | Row click/link → `/tickets/[ticketId]`                                                                         | E      |
| [ ] PSCR-7 | Create a new ticket                      | "New ticket" button → same dialog as DASH-6                                                                    | E      |
| [ ] PSCR-8 | Repository insights when repo configured | Section rendered only when the project has a repo; loads independently so GitHub failure never breaks the page | M, I   |

### 1.4 Tickets (PDF §4)

| ID        | Requirement                                              | Acceptance criteria                                                                                              | Verify |
| --------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| [ ] TKT-1 | Ticket fields                                            | title, description, status (`todo`/`in_progress`/`done`), priority (`low`/`medium`/`high`), createdAt, updatedAt | I      |
| [ ] TKT-2 | Create ticket                                            | `POST /api/projects/:projectId/tickets` → 201; defaults: status `todo`, priority `medium`                        | I, E   |
| [ ] TKT-3 | Create from dashboard `+` or from project page           | Both entry points use one shared dialog component                                                                | E      |
| [ ] TKT-4 | Edit existing ticket                                     | `/tickets/[ticketId]` form; `PATCH /api/tickets/:ticketId`; `updatedAt` changes, `createdAt` does not            | I, E   |
| [ ] TKT-5 | Changes visible after navigating back, no manual refresh | Save → back (link or browser back) → project list, counts and dashboard card show new values                     | E      |
| [ ] TKT-6 | Concurrent edit protection                               | Stale `version` → 409 `VERSION_CONFLICT`; UI tells the user and offers reload                                    | I      |

### 1.5 Search and filters (PDF §5)

| ID         | Requirement                                 | Acceptance criteria                                                                                   | Verify |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| [ ] SRCH-1 | Search is server-side                       | Query param `q` hits the DB (`ILIKE` on title + description); no client-side filtering of loaded data | I      |
| [ ] SRCH-2 | Filter by status and priority               | `status` and `priority` params, each accepts multiple comma-separated values                          | I      |
| [ ] SRCH-3 | Search + filters combine (AND)              | `q=login&status=todo,in_progress&priority=high` returns the intersection                              | I      |
| [ ] SRCH-4 | Filter state survives navigation and reload | Stored in the URL (`?q=&status=&priority=`); back from a ticket restores it                           | E      |
| [ ] SRCH-5 | Safe and sensible input                     | `q` trimmed, max 100 chars; `%`, `_`, `\` are matched literally; unknown enum values → 400            | U, I   |
| [ ] SRCH-6 | Responsive search                           | Debounced (300 ms); previous results stay visible while refetching                                    | M      |

### 1.6 Backend (PDF §6)

| ID         | Capability                                | Endpoint                                                                                | Verify |
| ---------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| [ ] API-1  | Retrieve projects                         | `GET /api/projects`                                                                     | I      |
| [ ] API-2  | Create project                            | `POST /api/projects`                                                                    | I      |
| [ ] API-3  | Retrieve one project + its ticket info    | `GET /api/projects/:projectId` (counts)                                                 | I      |
| [ ] API-4  | Retrieve, search, filter tickets          | `GET /api/projects/:projectId/tickets?q&status&priority`                                | I      |
| [ ] API-5  | Retrieve one ticket                       | `GET /api/tickets/:ticketId`                                                            | I      |
| [ ] API-6  | Create ticket                             | `POST /api/projects/:projectId/tickets`                                                 | I      |
| [ ] API-7  | Update ticket                             | `PATCH /api/tickets/:ticketId`                                                          | I      |
| [ ] API-8  | Repository insights                       | `GET /api/projects/:projectId/repository`                                               | I      |
| [ ] API-10 | Update project (EXT-1)                    | `PATCH /api/projects/:projectId`                                                        | I      |
| [ ] API-11 | Delete project (EXT-2)                    | `DELETE /api/projects/:projectId`                                                       | I      |
| [ ] API-12 | Delete ticket (EXT-3)                     | `DELETE /api/tickets/:ticketId`                                                         | I      |
| [ ] API-9  | Validate input, return appropriate errors | Uniform error envelope; 400/404/409/415/422/502/503/500 as specified in ARCHITECTURE §7 | I      |

### 1.7 Database (PDF §7)

| ID       | Requirement                               | Acceptance criteria                                                                              | Verify |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| [ ] DB-1 | Persistent database                       | PostgreSQL (Docker locally, Neon in production)                                                  | M      |
| [x] DB-2 | Projects, Tickets, and their relationship | `tickets.project_id` FK → `projects.id`, `ON DELETE CASCADE`, NOT NULL                           | I      |
| [x] DB-3 | Versioned migrations                      | Drizzle SQL migrations committed under `drizzle/`                                                | M      |
| [x] DB-4 | Seed data                                 | 3 projects (2 with real public repos, 1 without) and 18 tickets covering every status × priority | M      |
| [x] DB-5 | Seed is safe to re-run                    | `pnpm db:seed` resets dev data; `--if-empty` mode used for production                            | M      |

### 1.8 GitHub insights + caching (PDF §8, §9)

| ID       | Requirement                                 | Acceptance criteria                                                                                                                                    | Verify          |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| [ ] GH-1 | Insights section for connected projects     | Stars, forks, open issues (labelled "issues + PRs", see ARCH §10), last push, plus watchers, primary language, license, archived badge                 | M               |
| [ ] GH-2 | Fetched via our backend only                | Browser never calls `api.github.com`; frontend calls `/api/projects/:id/repository`                                                                    | M (network tab) |
| [ ] GH-3 | 5-minute cache                              | Second request within 300 s returns `meta.cached: true` with no outbound GitHub call                                                                   | U, I            |
| [ ] GH-4 | Cache is shared across serverless instances | Cache lives in Postgres, not process memory                                                                                                            | I               |
| [ ] GH-5 | Graceful degradation                        | Repo missing/private → "Repository not found or private"; rate-limited/down → serve stale cache with "last updated X ago" note, else a retryable error | U, I            |

### 1.9 Application experience (PDF §10)

| ID       | Requirement               | Acceptance criteria                                                                                                     | Verify |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| [ ] UX-1 | Loading feedback          | Skeletons for dashboard, project, ticket, insights; buttons show pending state and are disabled while submitting        | M      |
| [ ] UX-2 | Empty states              | No projects · project with no tickets · no tickets match filters (with "Clear filters") · card with no tickets          | M, E   |
| [ ] UX-3 | Error feedback            | Inline field errors on forms; toast on mutation failure; page-level error with Retry on fetch failure; not-found states | M, E   |
| [ ] UX-4 | Simple, clean, responsive | Usable at 360 px wide through desktop; no horizontal scroll                                                             | M      |
| [ ] UX-5 | Accessible basics         | Labelled inputs, keyboard-operable dialogs and chips, visible focus, status conveyed by text not only color             | M      |

### 1.10 Extended scope — not in the PDF, added at Sanidhya's request (decision L4)

These are delivered after every PDF requirement above. Per the cut order in ARCHITECTURE.md, they're cut before any PDF requirement.

| ID        | Requirement    | Acceptance criteria                                                                                                                                                                                                                                                                                                                  | Verify |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| [ ] EXT-1 | Edit project   | "Edit" on the project page opens the project form pre-filled. `PATCH /api/projects/:projectId` with `version`. You can rename, change the description, and change or remove the repo (`githubRepo: null` disconnects). The same validation as create applies, including the 409 for a duplicate name and the best-effort repo check. | I, E   |
| [ ] EXT-2 | Delete project | "Delete" on the project page opens a confirm dialog. The dialog states how many tickets will be deleted with the project. `DELETE /api/projects/:projectId` → 204, and the tickets are removed by cascade. Afterwards you land on the dashboard and the card is gone.                                                                | I, E   |
| [ ] EXT-3 | Delete ticket  | "Delete" on the ticket page opens a confirm dialog. `DELETE /api/tickets/:ticketId` → 204. Afterwards you land on the project page, with the list, counts and dashboard card updated.                                                                                                                                                | I, E   |
| [ ] EXT-4 | Safe deletes   | Deletes are hard and permanent, and the dialog says it can't be undone. A delete on a missing id → 404. The UI treats a 404 on delete as "already deleted": it refreshes and navigates away rather than showing an error.                                                                                                            | I      |

---

## 2. Non-functional requirements

| ID         | Requirement                                                    | Target / check                                                                                             |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [ ] NFR-1  | TypeScript everywhere, `strict: true`, no `any` / `@ts-ignore` | `pnpm typecheck` clean                                                                                     |
| [ ] NFR-2  | Clear frontend/backend separation inside Next.js               | Server code under `src/server/**` with `import 'server-only'`; UI never imports it (enforced by build)     |
| [ ] NFR-3  | Single source of validation truth                              | Zod schemas in `src/shared/schemas` used by forms and route handlers                                       |
| [ ] NFR-4  | No N+1 queries                                                 | Dashboard = 2 queries regardless of project count                                                          |
| [ ] NFR-5  | Bounded external calls                                         | GitHub fetch timeout 5 s; never blocks project/ticket pages                                                |
| [ ] NFR-6  | Secrets out of code                                            | Only `.env.example` committed; `GITHUB_TOKEN` and `DATABASE_URL` server-only (never `NEXT_PUBLIC_`)        |
| [x] NFR-7  | Fail fast on bad config                                        | Env parsed with Zod at startup; clear error message                                                        |
| [ ] NFR-8  | Errors never leak internals                                    | 500 responses carry a generic message + request id; details logged server-side                             |
| [ ] NFR-9  | Observability (lightweight)                                    | Structured JSON logs per request (method, route, status, duration, requestId); `GET /api/health` checks DB |
| [ ] NFR-10 | CI gate                                                        | GitHub Actions: lint, typecheck, unit + integration (Postgres service), build                              |
| [ ] NFR-11 | Reproducible local setup                                       | `docker compose up -d && pnpm i && pnpm db:migrate && pnpm db:seed && pnpm dev`                            |

---

## 3. Out of scope (PDF §11 — explicitly not built)

Authentication/registration · roles/permissions · comments · notifications · real-time/WebSockets · complex animations.

**Also deliberately not built.** None of these is required; they're listed so reviewers know it was a decision:

- moving tickets between projects;
- soft delete / undo;
- pagination UI;
- API rate limiting.

Each one goes under "Known limitations" in the README. Project edit/delete and ticket delete _are_ built (§1.10).

---

## 4. Submission requirements (PDF "Submission")

| ID        | Item                                                     | Done when                                                                                |
| --------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [ ] SUB-1 | Git repository link with complete source                 | Public GitHub repo, `main` builds from a clean clone                                     |
| [ ] SUB-2 | README with complete local run instructions              | A fresh clone following only the README reaches a working app                            |
| [ ] SUB-3 | Live Vercel deployment link                              | Production URL works end-to-end (create project, create/edit ticket, search, insights)   |
| [ ] SUB-4 | Separate backend hosting connected (if any)              | N/A by design — backend ships inside the same Vercel deployment; DB on Neon is connected |
| [ ] SUB-5 | Assumptions, known limitations, incomplete functionality | README section, kept honest and current                                                  |
| [ ] SUB-6 | Submitted before Thursday 8 Oct 2026 evening             | —                                                                                        |

### README must explain (PDF "README requirements")

- [ ] RM-1 How to set up and run frontend, backend, and database
- [ ] RM-2 Overall architecture (diagram + one paragraph)
- [ ] RM-3 Frontend state and application data handling (TanStack Query, query keys, invalidation, URL state)
- [ ] RM-4 Database and data modelling approach
- [ ] RM-5 GitHub integration and caching approach
- [ ] RM-6 Important technical decisions / trade-offs
- [ ] RM-7 Which AI tools were used and for what
- [ ] RM-8 One AI suggestion that was changed/rejected/improved, and why — **must be a real example from this build; Sanidhya to confirm the content, nothing invented**

---

## 5. Assumptions (to restate in README)

1. Single-tenant, unauthenticated app: every visitor can read and write all data (scope excludes auth).
2. Project `description` is optional (max 1000 chars); the field always exists. The PDF lists it as part of a project but does not say it is mandatory.
3. Project names are unique case-insensitively, to avoid indistinguishable dashboard cards.
4. "Recent or relevant tickets" = the 3 most recently updated tickets of any status.
5. Project-screen counts describe the whole project; the list below them is the filtered view.
6. "Open issues" comes from GitHub's `open_issues_count`, which includes open PRs; labelled accordingly rather than spending a second API call.
7. Only `github.com` repositories are supported (no GitHub Enterprise hosts).
8. Ticket lists return at most 200 rows per request; fine for review-scale data, documented as a limitation.
