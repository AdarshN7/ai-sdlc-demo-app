# Invoice Approval Demo App
forked by Adarsh Nishad

A small invoice approval app used for live AI-in-SDLC demos. Migrated from .NET 8 to a full-stack Next.js App Router application in TypeScript. It is deliberately simple: Next.js Route Handlers, React client components, and an in-memory store, so it runs with one command and no external database.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in:

| User | Password | Role |
| --- | --- | --- |
| `demo.approver` | `ChangeMe123!` | Approver |
| `demo.admin` | `ChangeMe123!` | Admin |

These are demo accounts for a local, in-memory app. They are not real credentials.

## What it does

1. Create an invoice (it starts as a draft).
2. Submit it for approval.
3. An approver approves it, or rejects it with a reason.

Invoices move through Draft, Pending Approval, then Approved or Rejected.

## Tests

Run unit and integration tests (Vitest):
```bash
npm test
```

Run end-to-end tests (Playwright):
```bash
npm run test:e2e
```

## Project layout

```
src/
  app/                    Next.js App Router (page, layout, API route handlers)
  components/             React UI components
  domain/                 Pure business rules, models, and interfaces
  infrastructure/         In-memory persistence, authentication, and HTTP error handling
tests/
  unit/                   Vitest unit tests (ApprovalService, DiscountCalculator)
  integration/            Vitest API route contract tests
e2e/                      Playwright end-to-end tests and page objects
docs/use-cases            Short feature briefs
AGENTS.md                 Conventions for AI coding agents
```

## Use cases

- [UC-1 Bulk invoice approval](docs/use-cases/UC-1-bulk-approval.md)
- [UC-2 Partial approval](docs/use-cases/UC-2-partial-approval.md)
