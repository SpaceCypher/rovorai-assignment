# RovorAI Take-Home Assignment
## Engineering Roles for Production-Quality Implementation

### Recommended Virtual Engineering Team

Use these roles during the implementation and review process. The goal is to have Claude Code approach the assignment from multiple engineering perspectives rather than acting as one generic developer.

| Role | Primary Responsibility |
|---|---|
| **Staff Engineer / Software Architect** | Own overall architecture, system boundaries, technical trade-offs, scalability, and maintainability. |
| **Senior Full-Stack Engineer** | Lead implementation across Next.js, TypeScript, Node.js, APIs, database integration, and frontend flows. |
| **Senior Frontend Engineer** | Review Next.js architecture, client/server boundaries, state management, data fetching, UX states, accessibility, and responsive behavior. |
| **Senior Backend Engineer** | Review API design, validation, business logic, error handling, external API integration, and backend reliability. |
| **Database Engineer** | Design and critique the schema, relationships, indexes, query patterns, migrations, and data integrity. |
| **Infrastructure / Platform Engineer** | Review deployment, environment configuration, caching, production configuration, reliability, and operational concerns. |
| **Security Engineer** | Review input validation, secrets, external URL handling, GitHub integration risks, and common application security issues. |
| **QA / Test Engineer** | Test requirements, edge cases, regression scenarios, API behavior, frontend flows, and failure states. |
| **Product / Requirements Reviewer** | Verify that every assignment requirement is actually satisfied and identify missing or unnecessary functionality. |
| **Staff Engineer / Final PR Reviewer** | Perform the final production-readiness review and identify anything that should block submission. |

## Recommended Order

1. **Product / Requirements Reviewer** — convert the assignment into an implementation checklist.
2. **Staff Engineer / Architect** — design the architecture and technical boundaries.
3. **Database Engineer** — design the data model and query strategy.
4. **Senior Backend Engineer** — design and implement the API and backend logic.
5. **Senior Frontend Engineer** — implement and review the application UI and state flows.
6. **Infrastructure / Platform Engineer** — prepare production deployment and configuration.
7. **Security Engineer** — perform a focused security review.
8. **QA / Test Engineer** — test all requirements and edge cases.
9. **Staff Engineer / Final PR Reviewer** — conduct the final approval review.

## Core Roles to Actually Use With Claude Code

Do not create separate Claude personas for every role. For an 8–12 hour assignment, consolidate them into these five working roles:

### 1. Staff Engineer / Architect
**Focus:** architecture, boundaries, trade-offs, scope control.

### 2. Senior Full-Stack Engineer
**Focus:** implementation across frontend, backend, database, and integrations.

### 3. Backend + Database Reviewer
**Focus:** API contracts, validation, queries, indexes, data integrity, caching, and GitHub integration.

### 4. Frontend + UX Reviewer
**Focus:** state management, loading/error/empty states, consistency, accessibility, responsive behavior, and user flows.

### 5. Staff Engineer / Production Gate
**Focus:** final code review, security, reliability, testing, deployment, documentation, and assignment compliance.

## Review Principle

The objective is **production quality without overengineering**.

Avoid introducing complexity that the assignment does not justify. The final implementation should be simple enough to understand, reliable enough to deploy, and structured enough to maintain.

The assignment explicitly allows AI tools and expects the developer to understand, explain, and modify the submitted implementation. Therefore, the developer should remain the final technical decision-maker.
