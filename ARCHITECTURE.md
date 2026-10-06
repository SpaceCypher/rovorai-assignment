# ARCHITECTURE.md — RovorAI Projects & Tickets

Status: **PROPOSED — open decisions resolved by role (see Decision log); awaiting approval to implement** · Author role: Staff Engineer / Architect · Date: 2026-10-06
Requirements checklist: `REQUIREMENTS.md`. Source of truth: `docs/RovorAI.com_Full_Stack_Developer_Assignment.pdf`.

Guiding principle (from `RovorAI_Engineering_Roles.md`): **production quality without overengineering.** Every component below exists because a requirement or a concrete failure mode needs it.

---

## 0. Decisions at a glance

| #   | Decision         | Choice                                                                                           | Why (one line)                                                                                                                                        |
| --- | ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | App shape        | **One Next.js app**: UI + REST API in Route Handlers, backend code isolated in `src/server/**`   | PDF allows it; one Vercel deploy, no CORS, no second host to keep alive. Boundary enforced with `server-only`.                                        |
| D2  | Database         | **PostgreSQL** — Docker locally, **Neon** in production                                          | Relational data with a real FK; Neon is serverless Postgres with a pooled endpoint suited to Vercel functions.                                        |
| D3  | ORM / migrations | **Drizzle ORM + drizzle-kit** with **postgres.js** driver                                        | SQL-shaped, typed, no binary engine (fast cold starts), plain SQL migration files that can be reviewed.                                               |
| D4  | Frontend data    | **TanStack Query** over our REST API; filters in the **URL**                                     | Explicit cache keys + invalidation solve "updated after navigating back" deterministically; the API is actually the contract, not decoration.         |
| D5  | Validation       | **Zod 4** schemas shared by forms and route handlers                                             | One definition of what valid input is.                                                                                                                |
| D6  | GitHub cache     | **Postgres table** with 5-min TTL, ETag revalidation, stale-on-error                             | Serverless instances don't share memory; a DB row is shared, durable, and testable. No extra infra.                                                   |
| D7  | Search           | `ILIKE` on `title                                                                                |                                                                                                                                                       | ' ' |     | description` + **pg_trgm GIN index** | Substring match is what users expect from ticket search ("auth" finds "authentication"); FTS doesn't do that by default. |
| D8  | Concurrency      | Integer `version` column, optimistic locking on PATCH                                            | Prevents silent lost updates from two tabs; ~10 lines. Integer, not timestamp: Postgres µs vs JS ms precision would cause false conflicts.            |
| D9  | UI kit           | **Tailwind CSS 4 + shadcn/ui** (Radix primitives), **react-hook-form**, **sonner** toasts        | Accessible dialogs/selects for free; code lives in repo, no runtime theme lib.                                                                        |
| D10 | Tests            | **Vitest** (unit + API integration against real Postgres), **Playwright** (3 critical e2e flows) | Integration tests hit the real DB because the interesting bugs (counts, search, FK, versioning) live in SQL.                                          |
| D11 | Package manager  | **pnpm**                                                                                         | Fast, strict, lockfile.                                                                                                                               |
| D12 | IaC              | **No Terraform** for this submission                                                             | Pushback: 1 Vercel project + 1 Neon DB; Terraform would cost ~1 h for zero reviewer value. Setup is scripted via Vercel CLI and documented in README. |

Versions confirmed on npm today (2026-10-06): next 16.3.8, react 19.3.0, drizzle-orm 0.45.3, drizzle-kit 0.31.11, postgres 3.4.9, @tanstack/react-query 5.104.1, zod 4.6.5, tailwindcss 4.3.3, vitest 5.0.3, @playwright/test 1.63.0, react-hook-form 7.89.0. Node 22 LTS locally (v22.22.3). Pin exact versions at scaffold time.

---

## 1. Functional requirements

Full list with IDs and acceptance criteria lives in `REQUIREMENTS.md` §1. Summary: dashboard of project cards (counts, recent tickets, open, `+` ticket), create project (with optional GitHub repo), project screen (summary, list, server-side search + status/priority filters, insights), create/edit tickets from two entry points, changes reflected everywhere without manual refresh, GitHub insights cached 5 minutes, seeded data.

## 2. Non-functional requirements

See `REQUIREMENTS.md` §2. Key ones that shape the architecture: strict TS; enforced client/server boundary; no N+1; bounded GitHub latency; config validated at boot; no internal details in error responses; CI gate.

---

## 3. User flows

```
F1 Browse      /  ──(Open project)──▶ /projects/:id ──(row)──▶ /tickets/:id
F2 New project /  ──(Create project)──▶ dialog ──submit──▶ 201 ──▶ invalidate ['projects'] ──▶ card appears
F3 Quick ticket /  ──(+ on card)──▶ dialog(projectId fixed) ──▶ 201 ──▶ card counts + recent update in place
F4 Ticket in project /projects/:id ──(New ticket)──▶ same dialog ──▶ list + counts update
F5 Search/filter /projects/:id?q=login&status=todo,in_progress&priority=high
                 type ─debounce 300ms─▶ router.replace(URL) ─▶ query key changes ─▶ GET …/tickets?…
F6 Edit          /tickets/:id ──edit──▶ Save (PATCH w/ version) ──▶ toast ──back──▶ project page (filters restored from URL, fresh data)
                 409 VERSION_CONFLICT ──▶ "Changed elsewhere" banner + Reload button (keeps user's draft visible until reload)
F7 Insights      /projects/:id mounts ──▶ GET /api/projects/:id/repository (independent query + skeleton)
                 ok → metrics · stale → metrics + "GitHub unavailable, showing data from 12 min ago" · not found → message · error → Retry
F8 Edit project   /projects/:id ──(Edit)──▶ project form dialog (pre-filled) ──PATCH w/ version──▶ header + dashboard card update
F9 Delete        ticket page ──(Delete)──▶ confirm ──DELETE──▶ /projects/:id (fresh)
                 project page ──(Delete)──▶ confirm ("also deletes N tickets") ──DELETE──▶ / (card gone)
```

---

## 4. Domain model

```
Project 1 ──── * Ticket

Project { id, name, description, githubRepo?: "owner/repo", createdAt, updatedAt }
Ticket  { id, projectId, title, description, status, priority, version, createdAt, updatedAt }
TicketStatus   = todo | in_progress | done      (labels: Todo, In Progress, Done)
TicketPriority = low | medium | high

Read models (not tables):
ProjectSummary  = Project + ticketCounts{todo,in_progress,done,total} + recentTickets[≤3]
ProjectDetail   = Project + ticketCounts
RepoInsights    = { fullName, htmlUrl, description, stars, forks, openIssuesAndPrs, watchers,
                    language, license, defaultBranch, archived, pushedAt, updatedAt }
```

Invariants:

- A ticket always belongs to exactly one existing project and never moves.
- Deleting a project deletes its tickets.
- `createdAt` is immutable.
- `updatedAt` and `version` change on every successful update, for projects and tickets alike.
- `githubRepo` is canonical `owner/repo` or null.
- Deletes are hard; there's no soft delete.

---

## 5. Database schema and relationships

PostgreSQL 16 locally (Docker); Neon in production (Postgres 16/17 — exact version chosen at provisioning).

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE ticket_status   AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');   -- declaration order = sort order

CREATE TABLE projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(100) NOT NULL CHECK (length(btrim(name)) > 0),
  description  text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  github_repo  text NULL CHECK (github_repo ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX projects_name_lower_uq ON projects (lower(name));

CREATE TABLE tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
  description  text NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  status       ticket_status   NOT NULL DEFAULT 'todo',
  priority     ticket_priority NOT NULL DEFAULT 'medium',
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_project_updated_idx ON tickets (project_id, updated_at DESC);
CREATE INDEX tickets_search_trgm_idx ON tickets
  USING gin ((title || ' ' || description) gin_trgm_ops);

CREATE TABLE github_repo_cache (
  repo_key     text PRIMARY KEY,            -- lower('owner/repo')
  status       text NOT NULL CHECK (status IN ('ok', 'not_found')),
  payload      jsonb NULL,                  -- normalized RepoInsights, null when not_found
  etag         text NULL,
  fetched_at   timestamptz NOT NULL
);
```

Notes (Database Engineer):

- **DB-level CHECKs duplicate Zod limits** on purpose: defense in depth if anything writes around the API (seed, psql).
- **FK `ON DELETE CASCADE`**: project delete (EXT-2) relies on it. One `DELETE FROM projects` removes the tickets atomically, so the app needs no multi-statement transaction.
- **Hard delete, not soft delete**: nothing requires audit or undo. A `deleted_at` column would have to be filtered in every query and every unique index, a permanent tax that buys us nothing here.
- **Cache rows outlive projects**: `github_repo_cache` is keyed by repo, not by project, so deleting a project or changing its repo leaves the row behind. Old rows simply age out of use. No cleanup is needed at this scale, and the README notes it.
- **No `project_id` index on its own** — `tickets_project_updated_idx` has it as leading column.
- **Trigram index honesty**: at ~20 rows the planner will seq-scan regardless. The index is there so the query shape is correct at 100k rows; README says so rather than claiming a speedup without a measurement.
- **Enums vs text+CHECK**: enums give Drizzle types and natural priority ordering; cost is that removing a value needs a migration. Acceptable — the value sets are fixed by the PDF.
- **`updated_at`** is set explicitly by the service (`now()`) in the UPDATE, not by a trigger — one less hidden mechanism; Drizzle schema is the single place to look.
- **Cache keyed by repo, not project**: two projects on the same repo share one cache row and one GitHub call.

Key queries:

- Dashboard (2 queries, no N+1):
  1. `SELECT p.*, count(t.*) FILTER (WHERE t.status='todo') …, count(t.*) total FROM projects p LEFT JOIN tickets t … GROUP BY p.id ORDER BY p.created_at DESC`
  2. Recent tickets: `SELECT … FROM (SELECT t.*, row_number() OVER (PARTITION BY project_id ORDER BY updated_at DESC) rn FROM tickets t) x WHERE rn <= 3`
- Ticket search: `WHERE project_id = $1 AND ($q IS NULL OR (title || ' ' || description) ILIKE '%' || escaped($q) || '%') AND status = ANY($s) AND priority = ANY($p) ORDER BY updated_at DESC, id DESC LIMIT 200`
- Update with optimistic lock: `UPDATE tickets SET …, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 RETURNING *` → 0 rows ⇒ distinguish 404 vs 409 with one follow-up `SELECT`.

---

## 6. Backend architecture

```
Browser ──fetch JSON──▶ Route Handler (src/app/api/**/route.ts)      thin: parse → call service → map response
                              │  withApi() wrapper: requestId, JSON/content-type checks, error→HTTP mapping, access log
                              ▼
                        Service (src/server/<feature>/service.ts)      business rules, transactions, not HTTP-aware
                              │
                 ┌────────────┴─────────────┐
                 ▼                          ▼
          Drizzle (postgres.js)       GitHub client (fetch + timeout + ETag)
                 │                          │
             PostgreSQL                api.github.com
```

- **Layers: handler → service → db.** No separate repository layer: services own their Drizzle queries. A repository layer would be a pass-through at this size.
- **Errors**: services throw typed `AppError(code, httpStatus, message, details?)` subclasses (`NotFoundError`, `ConflictError`, `ValidationError`, `UpstreamError`). `withApi()` maps them; anything else → 500 `INTERNAL_ERROR` + logged stack.
- **Runtime**: Node.js runtime for all route handlers (`export const runtime = 'nodejs'`; postgres.js needs TCP). `export const dynamic = 'force-dynamic'` on API routes so nothing is statically cached.
- **DB client**: one module-level `postgres()` instance per function instance, `max: 5` (assumption: tune after first deploy), `prepare: false` (required by PgBouncer transaction-mode pooling, which Neon's pooled endpoint uses), `idle_timeout: 20`, `connect_timeout: 10`.
- **Env**: `src/server/env.ts` parses `process.env` with Zod once; import fails fast with a readable message.
- **`server-only`** imported at the top of every `src/server/**` module, so an accidental import from a client component breaks the build. One exception: `src/server/db/schema.ts`. It has to load outside Next.js (drizzle-kit, the seed script), and it contains only table definitions: no secrets, no connections.

## 7. API design and contracts

Conventions: JSON only; success `{ "data": … , "meta"?: … }`; error `{ "error": { "code", "message", "details"?, "requestId" } }`; timestamps ISO-8601 UTC; ids UUID; all responses `Cache-Control: no-store` (client cache is TanStack Query's job). Invalid UUID in a path → 404 of that resource (never a Postgres cast error → 500). Request bodies validated with `.strict()` Zod objects (unknown keys → 400).

| Method & path                             | Body / query                                                                             | Success                                               | Errors                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                         | —                                                                                        | 200 `{data:{db:"ok"}}`                                | 503                                                                                                                    |
| `GET /api/projects`                       | —                                                                                        | 200 `ProjectSummary[]`                                | —                                                                                                                      |
| `POST /api/projects`                      | `{name, description?, githubRepo?}`                                                      | 201 `Project`                                         | 400 `VALIDATION_ERROR`, 409 `PROJECT_NAME_TAKEN`, 415, 422 `REPO_NOT_FOUND`                                            |
| `GET /api/projects/:projectId`            | —                                                                                        | 200 `ProjectDetail`                                   | 404 `PROJECT_NOT_FOUND`                                                                                                |
| `PATCH /api/projects/:projectId` (EXT-1)  | `{version, name?, description?, githubRepo?: string \| null}` (≥1 field besides version) | 200 `Project`                                         | 400, 404, 409 `PROJECT_NAME_TAKEN` / `VERSION_CONFLICT`, 415, 422 `REPO_NOT_FOUND`                                     |
| `DELETE /api/projects/:projectId` (EXT-2) | —                                                                                        | 204 (tickets cascade)                                 | 404                                                                                                                    |
| `DELETE /api/tickets/:ticketId` (EXT-3)   | —                                                                                        | 204                                                   | 404                                                                                                                    |
| `GET /api/projects/:projectId/tickets`    | `?q=&status=a,b&priority=a,b`                                                            | 200 `Ticket[]`, `meta:{count, limit}`                 | 400, 404                                                                                                               |
| `POST /api/projects/:projectId/tickets`   | `{title, description?, status?, priority?}`                                              | 201 `Ticket`                                          | 400, 404, 415                                                                                                          |
| `GET /api/tickets/:ticketId`              | —                                                                                        | 200 `Ticket & {project:{id,name}}`                    | 404 `TICKET_NOT_FOUND`                                                                                                 |
| `PATCH /api/tickets/:ticketId`            | `{version, title?, description?, status?, priority?}` (≥1 field besides version)         | 200 `Ticket`                                          | 400, 404, 409 `VERSION_CONFLICT` (`details.current` = server ticket), 415                                              |
| `GET /api/projects/:projectId/repository` | —                                                                                        | 200 `RepoInsights`, `meta:{cached, stale, fetchedAt}` | 404 `PROJECT_NOT_FOUND` / `REPO_NOT_CONNECTED` / `REPO_NOT_FOUND`, 502 `GITHUB_UNAVAILABLE`, 503 `GITHUB_RATE_LIMITED` |

Status codes: 400 malformed JSON or schema failure (with `details.fieldErrors`) · 404 missing resource · 409 uniqueness/version conflict · 415 non-JSON body · 422 well-formed but semantically rejected (repo doesn't exist) · 502/503 upstream · 500 unexpected.

DTO types are inferred from Zod (`z.infer`) in `src/shared` and imported by both sides — no hand-maintained duplicate types.

---

## 8. Frontend architecture

- **App Router.** Each `page.tsx` is a thin Server Component that awaits `params` (Next 16: `params` is a Promise) and renders a client "view" component. Data is fetched client-side through the API.
- Routes:
  - `/` → `DashboardView`
  - `/projects/[projectId]` → `ProjectView` (`useSearchParams` → wrapped in `<Suspense>` as Next requires)
  - `/tickets/[ticketId]` → `TicketView` (flat URL: ticket carries its project, so no project/ticket mismatch case)
  - `not-found.tsx`, `error.tsx`, `loading.tsx` at root.
- Feature folders own their components and hooks (`features/projects`, `features/tickets`, `features/repository`). Shared primitives in `components/ui` (shadcn).
- One `CreateTicketDialog` used by dashboard `+` and project page (TKT-3). One `TicketForm` used by create and edit.
- `lib/api-client.ts`: typed `apiFetch<T>()` that parses the envelope and throws `ApiError {status, code, message, fieldErrors}`; forms map `fieldErrors` onto react-hook-form fields.
- Dates rendered with `Intl.RelativeTimeFormat` + full timestamp in `title`. Client-only rendering of data avoids SSR/CSR timezone hydration mismatches.
- Description fields rendered as plain text (`whitespace-pre-wrap`), never as HTML/Markdown.

**Why not Server Components + Server Actions for data?** It would cut a loading state on first paint, but (a) the PDF evaluates the frontend↔API contract and wants the frontend to consume our API, (b) Next's client router cache has a history of serving stale RSC payloads on back-navigation — exactly the TKT-5 requirement — and (c) TanStack's invalidation model is easier to explain and test. Cost: initial skeleton flash; acceptable for an internal tool with no SEO needs.

## 9. State management

| State                                     | Owner                                           |
| ----------------------------------------- | ----------------------------------------------- |
| Server data (projects, tickets, insights) | TanStack Query cache                            |
| Search/filter state                       | URL search params (shareable, back-button safe) |
| Form state                                | react-hook-form (+ Zod resolver)                |
| Dialog open/closed                        | local `useState`                                |
| Global client state store                 | **none needed** — no Redux/Zustand              |

Query keys (`lib/query-keys.ts`):

```
['projects']                                   dashboard summaries
['projects', projectId]                        project detail + counts
['projects', projectId, 'tickets', filters]    filtered list
['projects', projectId, 'repository']          insights
['tickets', ticketId]                          single ticket
```

Invalidation after successful mutations (server state is the truth; no optimistic updates — PDF says "latest saved state"):

- create project → `['projects']` (exact)
- create ticket in P → `['projects']`, `['projects', P]` (prefix: detail + every filtered list)
- update ticket T in P → `setQueryData(['tickets', T], response)`, then invalidate as above
- update project P → `setQueryData` on `['projects', P]`, invalidate `['projects']` (exact). If the repo changed, also invalidate `['projects', P, 'repository']`.
- delete ticket T in P → `removeQueries(['tickets', T])`, invalidate `['projects']` and `['projects', P]` (prefix), then navigate to `/projects/P`
- delete project P → navigate to `/` **first**, then `removeQueries(['projects', P])` (prefix) and invalidate `['projects']`. Removing the queries instead of invalidating them stops mounted queries from refetching into a 404. A ticket page left open for P in another tab gets a 404 and shows "Ticket not found".
- On any delete, a 404 response is treated as success, because the resource is already gone.

Defaults: `staleTime: 30s`, `refetchOnWindowFocus: true`, `retry: 1` for queries (no retry for 4xx), `retry: 0` for mutations, `placeholderData: keepPreviousData` on the ticket list so results don't flash empty while typing. Insights `staleTime: 60s` (server owns the 5-min TTL).

## 10. GitHub integration

- **Input parsing** (`src/shared/github-ref.ts`, isomorphic, unit-tested): accepts `owner/repo` or `http(s)://(www.)github.com/owner/repo[.git][/…]`; rejects other hosts, credentials in URL, `.`/`..` repo names, invalid owner charset (`[A-Za-z0-9-]`, ≤39, no leading hyphen). Output canonical `owner/repo`.
- **Never fetch a user-supplied URL.** The client builds `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` from validated parts → no SSRF surface.
- **One call per refresh**: `GET /repos/{owner}/{repo}` with headers `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: rovorai-assignment`, optional `Authorization: Bearer ${GITHUB_TOKEN}`, `If-None-Match: <etag>` when cached. Timeout via `AbortSignal.timeout(5000)`.
- **Response normalized** into `RepoInsights` before caching (we store only what we render, not GitHub's full payload).
- **Field honesty**: `open_issues_count` includes open PRs → label "Open issues & PRs". `watchers_count` equals stars in GitHub's API, so "watchers" uses `subscribers_count`. (Both are documented GitHub API quirks — verify against a live response during implementation.)
- **Renamed/transferred repos**: GitHub redirects; `fetch` follows; we display the returned `full_name`.
- **Status mapping**: 200 → ok · 304 → reuse cached payload · 404 → `not_found` (also the answer for private repos) · 403/429 with `x-ratelimit-remaining: 0` or `retry-after` → rate limited · other 4xx/5xx/timeout/network → unavailable.
- **Rate limits**: unauthenticated is 60 req/h per IP, and Vercel egress IPs are shared, so production sets a `GITHUB_TOKEN` (fine-grained PAT, public-repo read-only, no extra permissions) for 5,000 req/h. Local dev works without one.
- **Create-time check** (PROJ-5): `POST /api/projects` with a repo calls the same service; confirmed 404 → 422; rate-limited/unavailable → accept the project (GitHub's availability must not block our core write path). A successful check warms the cache.

## 11. Caching strategy

| Layer                          | What                                                   | TTL / policy                                                                     |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `github_repo_cache` (Postgres) | Normalized GitHub repo data, keyed `lower(owner/repo)` | **Fresh for 300 s** (constant in code, not env — it's a requirement, not a knob) |
| TanStack Query (browser)       | API responses                                          | `staleTime` 30 s (insights 60 s), invalidated on mutation                        |
| HTTP                           | Our API                                                | `Cache-Control: no-store`; no CDN caching of mutable data                        |

Read path for insights:

```
row = select cache where repo_key
if row && now - fetched_at < 300s            → return row            (cached:true, stale:false)
res = github.get(repo, etag=row?.etag)
  304 → update fetched_at; return row                                (cached:false: revalidated)
  200 → upsert ok + payload + etag; return                           (cached:false)
  404 → upsert not_found (negative cache, same TTL); throw REPO_NOT_FOUND
  rate-limited / unavailable:
       row?.status=='ok' → return row                                (stale:true)
       else throw GITHUB_RATE_LIMITED / GITHUB_UNAVAILABLE
```

- Clock is injected into the service so freshness is unit-testable without sleeping.
- Concurrent misses: both fetch, both `INSERT … ON CONFLICT DO UPDATE` — idempotent, last write wins. No single-flight lock: at this traffic a duplicate GitHub call is cheaper than the lock's complexity. Revisit if traffic grows.
- 304 responses do not count against GitHub's primary rate limit per GitHub docs (assumption — confirm in docs during Phase 3), which makes ETag revalidation nearly free.
- **Rejected**: in-memory `Map` (per-instance, lost on cold start, inconsistent between instances); Next.js `fetch` Data Cache / `"use cache"` (semantics changed across Next 14→16, caches are hard to inspect and test, and error responses + stale-on-error are awkward); Redis/Upstash (extra service and secret for no gain over a table we already have).

## 12. Validation and error handling

- **Client**: Zod resolver on forms for instant feedback (same schemas as server). Submit disabled while pending; double-submit prevented.
- **Server**: all input validated again (client validation is UX, not security). Path params validated as UUID. Query params: `q` trimmed, ≤100 chars, empty → ignored; `status`/`priority` comma lists validated against enums and de-duplicated.
- Strings trimmed; title/name must be non-empty after trim. Empty description stored as `''`.
- PATCH requires `version` and at least one editable field.
- LIKE metacharacters (`%`, `_`, `\`) escaped in `q`, with `ESCAPE '\'`.
- Postgres errors mapped: `23505` unique violation → 409 `PROJECT_NAME_TAKEN`; `23503` FK violation → 404 `PROJECT_NOT_FOUND` (covers create-ticket race with project deletion); `23514` check violation → 400.
- Malformed JSON → 400 `INVALID_JSON`; missing/wrong `Content-Type` on POST/PATCH → 415.
- 500s: generic message + `requestId`; full error logged as JSON with the same `requestId`.

## 13. Loading, empty, and error states

| Screen / area       | Loading                                                           | Empty                                                                                            | Error                                                                       |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Dashboard           | 3 skeleton cards                                                  | "No projects yet" + Create project CTA                                                           | Error panel + Retry                                                         |
| Project card        | —                                                                 | "No tickets yet" + `+`                                                                           | —                                                                           |
| Project page header | Skeleton                                                          | —                                                                                                | 404 → "Project not found" + back to dashboard; else Retry                   |
| Ticket list         | Skeleton rows first load; dimmed list + inline spinner on refetch | (a) project has no tickets → CTA; (b) filters match nothing → "No tickets match" + Clear filters | Inline error + Retry (header and insights stay usable)                      |
| Insights            | Skeleton metrics                                                  | Not connected → section hidden                                                                   | Not found / private; rate-limited / unavailable with stale data note; Retry |
| Ticket page         | Form skeleton                                                     | —                                                                                                | 404 → "Ticket not found"; 409 conflict banner + Reload                      |
| Dialogs/forms       | Button spinner, inputs disabled                                   | —                                                                                                | Inline field errors from server `fieldErrors`; toast for non-field errors   |
| Root                | `loading.tsx`                                                     | —                                                                                                | `error.tsx` boundary with reset                                             |

## 14. Testing strategy

Pyramid sized for a 10-hour build; tests target where bugs actually hide.

- **Unit (Vitest, node env)**: `github-ref` parser (≈20 cases incl. hostile input), Zod schemas, LIKE escaping, GitHub status mapping, cache freshness/stale-on-error with fake clock + fake fetch, error→HTTP mapping.
- **API integration (Vitest + real Postgres)**: call exported route handlers directly with `new Request(...)`. Separate `rovor_test` DB (same Docker container); `globalSetup` runs migrations; each test truncates tables. GitHub client is injected/mocked (msw or a fake) — tests never hit the network. Covers: every endpoint's happy path + its listed errors, counts correctness, search+filter combinations, LIKE escape, unique name (case-insensitive), version conflict, cache hit within TTL (assert 0 outbound calls), stale fallback, invalid UUID → 404.
- **E2E (Playwright, Chromium, against `next build && next start` + seeded test DB)**: (1) create project → appears; `+` ticket → card counts change; (2) open project → search + filter → open ticket → edit status → browser back → filters intact, list + counts updated → dashboard updated; (3) empty-state + validation error path; (4) delete ticket → project counts and dashboard card drop; edit project name → card shows the new name.
- **CI (GitHub Actions)**: Postgres service container → `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; Playwright job runs too if it stays under ~5 min, else local-only and stated in README.
- **Manual production smoke** (recorded in final review): all flows on the Vercel URL, network tab confirms no browser→GitHub calls, two insights requests within 5 min show `meta.cached: true`.

## 15. Deployment architecture

```
GitHub repo ──push main──▶ Vercel (Next.js: static assets + Node functions for /api/*)
                                   │ pooled TLS connection (DATABASE_URL)
                                   ▼
                           Neon Postgres (same region as Vercel functions)
                                   ▲
            migrations ────────────┘ (DATABASE_URL_UNPOOLED)
```

- **Single deployment** — no separate backend host (SUB-4 is N/A).
- **Region**: Vercel function region pinned to match the Neon region (e.g. both in `iad1` / `us-east-1`) to avoid cross-region DB latency per query.
- **Migrations**: `vercel-build` script runs `drizzle-kit migrate` **only when `VERCEL_ENV=production`**, then `next build`. Migrations are additive/backward-compatible so the old deployment keeps working during rollout. Preview deployments are not wired to the production DB (previews either disabled or pointed at a Neon branch).
- **Seed**: run once against prod manually with `pnpm db:seed --if-empty` (idempotent; refuses to wipe a non-empty DB).
- **Cold starts**: Neon free tier scales to zero, so the first request after idle can take noticeably longer (assumption: up to a few seconds — measure after deploy and note in README).

## 16. Environment variables and configuration

| Variable                | Where           | Required                 | Purpose                                                                                                                                                 |
| ----------------------- | --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | server          | yes                      | Runtime connection (Neon **pooled** URL in prod; `postgres://…@localhost:5433/rovor` locally — Docker maps host 5433 to avoid a local Postgres on 5432) |
| `DATABASE_URL_UNPOOLED` | migrations only | prod only                | Direct connection for DDL (falls back to `DATABASE_URL` locally)                                                                                        |
| `DATABASE_URL_TEST`     | tests           | for integration tests    | `…/rovor_test`                                                                                                                                          |
| `GITHUB_TOKEN`          | server          | no (recommended in prod) | Raises GitHub rate limit; fine-grained PAT, public read-only                                                                                            |
| `LOG_LEVEL`             | server          | no (`info`)              | Log verbosity                                                                                                                                           |

No `NEXT_PUBLIC_*` variables are needed (the frontend calls same-origin `/api`). `.env.example` committed; `.env*` git-ignored. Env parsed by Zod in `src/server/env.ts`.

## 17. Security considerations

- **No auth by scope** → anyone with the URL can read/write. Stated in README; the only real mitigation would be auth or rate limiting, both out of scope. Vercel's platform request-size limit bounds body abuse (assumption: ~4.5 MB on functions; our Zod limits are far below).
- **Injection**: Drizzle parameterizes all values; the one raw-SQL fragment (search) uses bound parameters with escaped LIKE metacharacters.
- **XSS**: React escapes output; no `dangerouslySetInnerHTML`; user/GitHub text rendered as text. GitHub-sourced URLs (`html_url`) rendered only if they start with `https://github.com/`; external links use `rel="noopener noreferrer"`.
- **SSRF**: we never fetch a user-supplied URL; only `api.github.com` with validated, URL-encoded path segments.
- **Secrets**: `GITHUB_TOKEN`/`DATABASE_URL` only in `src/server/env.ts` (guarded by `server-only`); never logged; token scoped to public read.
- **CSRF**: no cookies or ambient credentials exist, so there is nothing to forge. JSON-only content type requirement also blocks simple form-POSTs.
- **Error leakage**: no stack traces/SQL in responses.
- **Headers** (`next.config.ts`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`. A full CSP is deferred (Next inline scripts make a strict CSP a nonce project; not worth it here).
- **Dependencies**: lockfile committed; `pnpm audit` in final review.

## 18. Important edge cases

1. Repo input variants: `https://github.com/Owner/Repo.git/`, `github.com/owner/repo/tree/main`, `owner/repo?tab=readme` → canonical; `gitlab.com/x/y`, `owner`, `owner/repo/extra` with non-GitHub host, `../../etc` → rejected.
2. Repo exists but is private → GitHub 404 → "not found or private".
3. Repo renamed/transferred → redirect followed, new `full_name` shown.
4. Archived repo → shown with "Archived" badge.
5. GitHub rate-limited with fresh/stale/no cache → fresh served, stale served with note, or 503 with Retry.
6. GitHub slow → 5 s timeout, page unaffected (insights loads independently).
7. Two projects with same repo → one cache row.
8. Duplicate project name differing only by case → 409 with field error on name.
9. Whitespace-only title/name → 400.
10. Search for `%`, `_`, `\` → literal match, not wildcard.
11. Unicode/emoji in titles and search → `ILIKE` handles; lengths measured in characters by Postgres.
12. Invalid UUID in URL (`/projects/abc`) → 404 page, not 500.
13. Ticket edited in two tabs → second save gets 409 conflict banner.
14. PATCH with no changed fields besides version → 400 (or no-op; decision: 400 `NO_CHANGES` — simpler to reason about).
15. Double-click on Save/Create → single request (button disabled while pending).
16. Filters in URL with garbage values (`?status=foo`) → UI drops invalid values; API returns 400 if called directly.
17. Back navigation after edit → refreshed data with filters restored from URL.
18. Long titles/descriptions → line-clamped on cards, wrapped on detail page, no layout overflow at 360 px.
19. Project with 0 tickets → all counts `0`, card and page empty states.
20. DB unreachable / Neon cold start → API 500/503 with Retry UI; health endpoint reports it.
21. Create ticket for a project id that doesn't exist (stale UI) → 404 surfaced as toast.
22. Delete project while its page is open in another tab → that tab's next fetch gets a 404 and shows "Project not found".
23. Delete the same ticket twice (double-click, or two tabs) → the second call gets a 404, which the UI treats as success.
24. Rename a project to its own name with different casing (`api` → `API`) → allowed, because the unique check excludes the project's own row.
25. Disconnect a repo (`githubRepo: null`) → the insights section disappears. The cache row stays, harmlessly.
26. Change the repo to one that doesn't exist → 422 if GitHub confirms the 404; accepted if GitHub is unavailable.
27. Edit a project while another tab is editing it → 409 `VERSION_CONFLICT`, the same as for tickets.

## 19. Technical trade-offs

| Choice                                       | Gain                                                     | Cost / risk accepted                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monolith Next.js app (D1)                    | One deploy, shared types, no CORS                        | Backend scales with the frontend deployment; acceptable at this size. Boundary kept clean so `src/server` could be lifted into a separate service. |
| Client-side fetching via TanStack Query (D4) | Deterministic freshness, real use of our API             | Skeleton on first paint; no SSR                                                                                                                    |
| No optimistic updates                        | Always shows saved state (PDF wording); no rollback code | ~100–300 ms delay before lists reflect a change                                                                                                    |
| Postgres as cache (D6)                       | Shared, durable, testable, zero new infra                | A DB round-trip per insights request (~ms); fine                                                                                                   |
| ILIKE + trigram (D7)                         | Substring matching users expect                          | No relevance ranking; no stemming                                                                                                                  |
| Optimistic locking (D8)                      | No silent lost updates                                   | Users occasionally see a conflict banner                                                                                                           |
| Hard list cap of 200, no pagination UI       | Simple, sufficient for review data                       | Projects with >200 matching tickets truncate; documented                                                                                           |
| No Terraform (D12)                           | ~1 h saved for features/tests                            | Infra is documented steps + CLI, not code                                                                                                          |
| Best-effort repo check on create and edit    | Catches typos early                                      | Saving is slower by one GitHub call (≤5 s worst case) when a repo is given                                                                         |
| Hard delete with a confirm dialog (EXT-2/3)  | Simple queries, no `deleted_at` tax                      | No undo; project delete takes its tickets with it, and the dialog says so with the count                                                           |

## 20. Assignment-specific submission requirements

Tracked in `REQUIREMENTS.md` §4 (SUB-1…6, RM-1…8). Notes:

- The workspace is **not a git repository yet**; it needs `git init` + a public GitHub remote before submission (`git init` in Phase 0 per L5; remote creation is an escalation).
- RM-8 (AI suggestion changed/rejected) must be a real event from this build. Candidates will be logged in `docs/ai-decisions.md` as they happen (e.g. this plan already rejects an in-memory GitHub cache and a separate Express backend). Sanidhya picks and confirms the final example.

---

## Project directory structure

```
.
├── docs/                              # assignment PDF (read-only), ai-decisions.md
├── RovorAI_Engineering_Roles.md       # (read-only)
├── REQUIREMENTS.md  ARCHITECTURE.md  README.md
├── .env.example  .gitignore  docker-compose.yml        # postgres:16 + init script creating rovor_test
├── drizzle.config.ts
├── drizzle/                           # generated SQL migrations (committed)
├── next.config.ts  tsconfig.json  eslint.config.mjs  vitest.config.mts  playwright.config.ts
├── .github/workflows/ci.yml
├── e2e/                               # Playwright specs
├── scripts/seed.ts
└── src/
    ├── app/                           # routing only — thin
    │   ├── layout.tsx  providers.tsx  page.tsx  loading.tsx  error.tsx  not-found.tsx
    │   ├── projects/[projectId]/page.tsx
    │   ├── tickets/[ticketId]/page.tsx
    │   └── api/
    │       ├── health/route.ts
    │       ├── projects/route.ts
    │       ├── projects/[projectId]/route.ts
    │       ├── projects/[projectId]/tickets/route.ts
    │       ├── projects/[projectId]/repository/route.ts
    │       └── tickets/[ticketId]/route.ts
    ├── server/                        # backend — every file imports 'server-only'
    │   ├── env.ts  logger.ts
    │   ├── db/        client.ts  schema.ts
    │   ├── http/      with-api.ts  errors.ts  responses.ts
    │   ├── projects/  service.ts
    │   ├── tickets/   service.ts  search.ts (LIKE escaping, filter builder)
    │   └── github/    client.ts  insights-service.ts  cache.ts
    ├── shared/                        # isomorphic, no server or DOM deps
    │   ├── domain.ts                  # enums, labels, constants (CACHE_TTL_SECONDS = 300)
    │   ├── schemas/   project.ts  ticket.ts  filters.ts  api.ts (envelopes, DTOs)
    │   └── github-ref.ts
    ├── features/                      # UI by feature
    │   ├── projects/   components/ (ProjectCard, ProjectFormDialog [create+edit], DeleteProjectDialog, ProjectHeader, StatusCounts)  hooks.ts
    │   ├── tickets/    components/ (TicketList, TicketFilters, TicketForm, CreateTicketDialog, DeleteTicketDialog, TicketView)  hooks.ts
    │   └── repository/ components/ (RepositoryInsights)  hooks.ts
    ├── components/ui/                 # shadcn primitives
    └── lib/           api-client.ts  query-keys.ts  use-url-filters.ts  format.ts
tests/
    ├── unit/
    └── integration/   (setup.ts: migrate + truncate helpers)
```

---

## Implementation phases and dependency order

Each phase ends with a runnable check and its output shown before moving on. Roles per `RovorAI_Engineering_Roles.md` (5 working roles).

| #   | Phase                                                                                                                                                           | Lead role → reviewer              | Depends on | Exit check                                                                          | Est.   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------- | ----------------------------------------------------------------------------------- | ------ |
| 0   | Scaffold: Next 16 + TS strict, ESLint/Prettier, Tailwind + shadcn, Vitest, Docker Postgres, env validation, CI skeleton, `git init` + `.gitignore` (no commits) | Full-Stack → Production Gate      | —          | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green                      | 0.75 h |
| 1   | DB schema, migrations, seed                                                                                                                                     | Full-Stack → Backend+DB Reviewer  | 0          | `pnpm db:migrate && pnpm db:seed` then `psql` counts (3 / 18)                       | 0.75 h |
| 2   | Backend core: errors, `withApi`, shared Zod schemas, projects + tickets services & routes (incl. EXT-1…3 PATCH/DELETE), health                                  | Full-Stack → Backend+DB Reviewer  | 1          | Integration suite green + `curl` script over every endpoint                         | 2.5 h  |
| 3   | GitHub client, insights service, Postgres cache, create/edit-time repo check                                                                                    | Full-Stack → Backend+DB Reviewer  | 2          | Unit (fake clock/fetch) + integration green; two `curl`s show `cached:true`         | 1.25 h |
| 4   | Frontend foundation: providers, api-client, query keys, layout, UI primitives, URL-filter hook                                                                  | Full-Stack → Frontend+UX Reviewer | 2          | Dev server renders shell; typecheck green                                           | 0.5 h  |
| 5   | Dashboard + create project + create ticket dialog                                                                                                               | Full-Stack → Frontend+UX Reviewer | 4          | Manual flow F2/F3 + e2e spec 1                                                      | 1.25 h |
| 6   | Project page: header, counts, search/filters, list, insights panel, edit + delete project (EXT-1/2)                                                             | Full-Stack → Frontend+UX Reviewer | 3, 5       | e2e spec 2 (up to search/filter); manual edit/delete project                        | 1.75 h |
| 7   | Ticket page: edit, version conflict, back-nav freshness, delete ticket (EXT-3)                                                                                  | Full-Stack → Frontend+UX Reviewer | 6          | e2e spec 2 complete; e2e spec 4: delete ticket → counts drop on project + dashboard | 1 h    |
| 8   | States, a11y, responsive pass                                                                                                                                   | Frontend+UX Reviewer              | 5–7        | Checklist UX-1…5 at 360 px & desktop; e2e spec 3                                    | 0.75 h |
| 9   | Deploy: Neon + Vercel, env, region, migrate, seed, prod smoke                                                                                                   | Full-Stack → Production Gate      | 8          | Smoke checklist on live URL                                                         | 0.75 h |
| 10  | README, assumptions/limitations, AI-usage section                                                                                                               | Architect → Product Reviewer      | 9          | RM-1…8 ticked                                                                       | 0.75 h |
| 11  | Final production gate: security pass, `pnpm audit`, requirements sweep                                                                                          | Staff Engineer / Production Gate  | 10         | Every REQUIREMENTS row `[x]` or explicitly listed as limitation                     | 0.5 h  |

Total ≈ 12.25 h. That's at the top of the PDF's 8–12 h budget because of the extended scope (L4).

If time runs short, cut in this order, lowest value first:

1. Playwright in CI.
2. Project edit (EXT-1).
3. Project delete (EXT-2).
4. The repo existence check.
5. Optimistic locking.
6. The trigram index.

Ticket delete (EXT-3) is cheap and stays. PDF requirements are never cut.

---

## How decisions are made

Project questions are answered by the role that owns the area in `RovorAI_Engineering_Roles.md`, not escalated to Sanidhya:

| Question area                                      | Owning role                      |
| -------------------------------------------------- | -------------------------------- |
| Scope: is something required or extra?             | Product / Requirements Reviewer  |
| Boundaries, trade-offs, structure                  | Staff Engineer / Architect       |
| API, validation, queries, schema, caching, GitHub  | Backend + Database Reviewer      |
| State, UX states, accessibility, responsive design | Frontend + UX Reviewer           |
| Deployment, config, security, tests, readiness     | Staff Engineer / Production Gate |

Each decision is recorded in the log below as: question → owning role → decision → reason.

**Escalate to Sanidhya only for:**

- outward-facing or irreversible actions (creating remote repos, pushing, provisioning paid or shared services);
- anything that needs Sanidhya's credentials or accounts;
- anything that would break Sanidhya's global rules (no commits or pushes unless asked);
- personal content: the RM-7/RM-8 AI-usage statements must be Sanidhya's real experience.

## Decision log

| #   | Question                                                       | Role                                                        | Decision                                                                                                                 | Reason                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Keep optimistic locking (D8)?                                  | Backend + DB Reviewer, confirmed by Production Gate         | **Keep**                                                                                                                 | Without it, two tabs editing one ticket silently lose an update. It costs one column plus a `WHERE version = $n`. It's the first thing to cut if time runs short (see phase table).                                                    |
| L2  | Keep the best-effort GitHub existence check on project create? | Backend + DB Reviewer                                       | **Keep, best-effort only**                                                                                               | A confirmed 404 returns 422 and catches typos at the point of entry. If GitHub is down or rate-limited the project is still created, so our write path never depends on GitHub.                                                        |
| L3  | Neon or Supabase for production Postgres?                      | Production Gate (Infra / Platform)                          | **Neon**                                                                                                                 | Native Vercel integration, a pooled endpoint for serverless functions, and branching for previews. Supabase's auth, storage and realtime would be unused weight.                                                                       |
| L4  | Build project edit/delete or ticket delete?                    | Product / Requirements Reviewer; **overridden by Sanidhya** | **Yes, built as extended scope (EXT-1…4)**                                                                               | Sanidhya asked for it. The roles' original call ("not required, so skip") was overruled. Product Reviewer condition: build it only after the PDF requirements, and cut it first if time runs short.                                    |
| L5  | Git setup                                                      | Architect + Production Gate                                 | **Run `git init` and add `.gitignore` in Phase 0.** No commits, no remote, no pushes.                                    | `git init` is local and reversible. Commits and pushes stay behind Sanidhya's explicit go-ahead (global rule). Creating the public GitHub repo is outward-facing and needs Sanidhya's account, so it's an escalation in Phase 9.       |
| L6  | Delete semantics                                               | Backend + DB Reviewer                                       | **Hard delete. Project delete cascades through the FK. DELETE → 204; missing id → 404, which the UI treats as success.** | No audit or undo is required. Soft delete would add a `deleted_at` filter to every query and every unique index. The cascade makes project delete one atomic statement.                                                                |
| L7  | Should project edit use optimistic locking too?                | Backend + DB Reviewer                                       | **Yes, add `projects.version`**                                                                                          | It's the same mechanism as tickets, already built and tested once. Two different update semantics would be harder to explain than one.                                                                                                 |
| L8  | Where do edit and delete live in the UI?                       | Frontend + UX Reviewer                                      | **On the detail pages only. Project edit/delete sits on the project page header; ticket delete on the ticket page.**     | Keeps dashboard cards uncluttered and stops destructive actions sitting next to `+`. Every delete goes through a confirm dialog. Project delete states the ticket count and needs one explicit click on a red "Delete project" button. |
| L9  | Should a repo change re-run the existence check?               | Backend + DB Reviewer                                       | **Yes, but only when `githubRepo` actually changed**                                                                     | Same rule as create. Unchanged saves never call GitHub.                                                                                                                                                                                |

## Pending escalations (Sanidhya)

| When        | What you need to do                                                   |
| ----------- | --------------------------------------------------------------------- |
| Phase 9     | Create the public GitHub repo, or approve that I create it with `gh`. |
| Phase 9     | Approve pushing to the repo.                                          |
| Phase 9     | Connect Neon and Vercel to your accounts (or run `vercel login`).     |
| Phase 9     | Provide a `GITHUB_TOKEN` for production.                              |
| Phase 10    | Confirm the RM-7/RM-8 AI-usage content.                               |
| Each commit | Approve each commit, per your global rule.                            |

## Phase reviews

### Phase 0 — Staff Engineer / Production Gate (2026-10-06)

**Evidence:** a fresh clone of commit `fd284ef` passes `install --frozen-lockfile → format:check → lint → typecheck → test → build`.

**Live checks on `next start`:**

- An invalid `DATABASE_URL` is rejected while the server prepares, before any request is served, and the secret is not echoed.
- The security headers are present and `X-Powered-By` is absent.
- The built CSS resolves `html{font-family:var(--font-geist-sans)}`.

| #    | Severity | Finding                                                                                                     | Action                                                                         |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0-1 | Medium   | `engines.node: ">=22"` lets Vercel or CI pick a newer major than the one tested                             | Pinned to `22.x`                                                               |
| P0-2 | Low      | The `shadcn` CLI was a runtime dependency; only its CSS is used, at build time                              | Moved to devDependencies                                                       |
| P0-3 | Low      | pnpm silently ignored the `unrs-resolver` build script (an optional native fallback; lint works without it) | Recorded as `pnpm.ignoredBuiltDependencies`                                    |
| P0-4 | Low      | The docs said local DB port 5432 and `vitest.config.ts`                                                     | Corrected to 5433 and `.mts`                                                   |
| P0-5 | Info     | Bad config leaves the process up but every request returns 500, rather than the process exiting             | Accepted: on Vercel this surfaces as failed invocations with the logged reason |
| P0-6 | Info     | GitHub Actions are pinned to tags, not SHAs                                                                 | Accepted for this scope                                                        |
| P0-7 | Info     | CI has not run on GitHub yet (no push), so NFR-10 stays unchecked                                           | Re-verify after the first push                                                 |
| P0-8 | Info     | No HSTS header; assumed Vercel sets it on its domains                                                       | Verify in the Phase 9 smoke test                                               |

**Verdict:** pass.

### Phase 1 — Backend + Database Reviewer (2026-10-06)

**Evidence:**

- A fresh volume, then `db:migrate`, applies `0000_enable_pg_trgm` and `0001_init` to both `rovor` and `rovor_test`.
- `db:seed` inserts 3 projects and 18 tickets. Every status × priority pair appears exactly twice, and no ticket has `updated_at < created_at`.
- With `enable_seqscan=off`, `EXPLAIN` shows a Bitmap Index Scan on `tickets_search_trgm_idx` for the exact search expression.

**Constraint probes** (each run in a rolled-back transaction):

- Rejected: blank name or title, a case-insensitive duplicate name, a URL in place of `owner/repo`, a description over 1000 chars, a title over 200 chars, a ticket for a missing project, an unknown enum value, an unknown cache status.
- Allowed: `a/b`, `a/.github`.
- Deleting a project cascades to its tickets (18 → 11).

| #    | Severity                     | Finding                                                                                                                                               | Action                                                                                               |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| P1-1 | Medium                       | The repo CHECK accepted `a/..`, `a/.` and `-a/b`, none of which GitHub allows                                                                         | Tightened. Rewrote `0001_init` in place: nothing was committed or deployed yet.                      |
| P1-2 | High (caught before running) | The first fix wrote `\.` inside a JS template literal, which emitted `'/.{1,2}$'` and would have rejected every 1–2 character repo name such as `a/b` | Switched to `[.]`, which needs no escaping. Checked the generated SQL and probed `a/b` (allowed)     |
| P1-3 | Info                         | `schema.ts` is the one `src/server` file without `server-only`                                                                                        | Documented as a deliberate exception (§6)                                                            |
| P1-4 | Info                         | The seed resets only local hosts; `--if-empty` is the only mode allowed against remote databases                                                      | Verified: a remote host is refused with a clear message, and `--if-empty` on a seeded database skips |

**Verdict:** pass. DB-1 stays unchecked until Neon is connected in Phase 9.
