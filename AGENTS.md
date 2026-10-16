# Project conventions for AI agents

Invoice approval demo app: Full-stack Next.js App Router application in TypeScript.

## Layout

- `src/domain`: business rules, models, and repository interfaces. No web or Next.js code. `ApprovalService` owns the invoice lifecycle (Draft, PendingApproval, Approved, Rejected).
- `src/infrastructure`: in-memory repository, sign-in/session store (`auth/`), and HTTP error handling.
- `src/app/api`: Route Handlers, one per resource/action.
- `src/app`: App Router pages, layout, and global styling.
- `src/components`: React client components.
- `tests/unit`: Vitest unit tests, one test suite per domain class under test.
- `tests/integration`: Vitest integration tests covering API endpoints and contracts.
- `e2e`: Playwright end-to-end tests (`tests/`) and page objects (`pages/`).
- `docs/use-cases`: short briefs for features we may build.

## Conventions

- Route handlers live in `src/app/api/`. Request bodies are typed interfaces.
- Route handlers use `handleApiError(...)` so domain errors map to 404, 409, 400, 401, and 403.
- Every endpoint is behind sign-in (except login). Restrict actions with `requireAuth(request, ['Role'])`: destructive actions are Admin only, approvals are Approver or Admin.
- Business rules go in `src/domain`, never in route handlers or client components.
- Repositories are interfaces in `domain/` with an in-memory implementation in `infrastructure/`.
- Every new rule or endpoint needs tests. Use `FakeInvoiceRepository` in tests.
- Use clear names; no one-letter variables or `flag` parameters.
- End-to-end tests use page objects and role-based locators (`getByRole`, `getByLabel`), never CSS or XPath selectors.

## Commands

- Run the app: `npm run dev` then open http://localhost:3000
- Run unit & integration tests: `npm test`
- Run end-to-end tests: `npm run test:e2e`

## Demo accounts (not real credentials)

- `demo.approver` / `ChangeMe123!` (role Approver)
- `demo.admin` / `ChangeMe123!` (role Admin)

## Never

- Commit real credentials, tokens or customer data.
- Add business logic to route handlers or React components.
