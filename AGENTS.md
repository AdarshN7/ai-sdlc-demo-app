# Project conventions for AI agents

Invoice approval demo app: Full-stack Next.js 14 App Router application in TypeScript with Route Handlers and in-memory persistence.

## Layout & Folder Map

- `src/domain`: Pure business rules, domain entities, limits constants, pure evaluation functions, and repository interfaces. No web, React, or Next.js code. Target for unit and mutation testing.
- `src/infrastructure`: In-memory repository implementation on `globalThis`, auth/session store, and HTTP error handling.
- `src/app/api`: Route Handlers, one per resource/action. Loads state, calls domain logic, saves only on success, and maps errors.
- `src/app`: App Router pages, layout, and global styling. Shows returned rejection reasons.
- `src/components`: React client components. Never contains business logic.
- `tests/unit`: Vitest unit tests, one test suite per domain class under test (`approval-limits-step1.test.ts`, `approval-limits-step2.test.ts`, `approval-service.test.ts`, `discount-calculator.test.ts`).
- `tests/integration`: Vitest integration tests covering API Route Handlers, auth, and HTTP error mapping contracts.
- `e2e`: Playwright end-to-end tests (`tests/`) and page objects (`pages/`).
- `docs/`: Feature use-cases and mutation testing score reports (`docs/mutation/`).
- `.ai-sdlc/`: Continuous AI interaction logs (`interaction-log.jsonl`) captured by lifecycle hooks.
- `.agents/`: Workflows, agent skills, and hook dispatch configurations.

## The 5 Business Rules & Approval Limits

All approval decisions are validated by pure domain logic before any repository modification or state change:

1. **Manager Approval Limit**:
   - `MANAGER_APPROVAL_LIMIT = 50_000` (inclusive).
   - A Manager may approve invoices with amount $\le$ 50,000.
   - Any attempt by a Manager to approve an amount $> 50,000$ (e.g. 50,001) MUST be rejected with standardized reason code `LIMIT_EXCEEDED`.

2. **Director Approval Limit**:
   - `DIRECTOR_APPROVAL_LIMIT = 500_000` (inclusive).
   - A Director may approve invoices with amount $\le$ 500,000 as a sole approver.
   - An invoice with amount $\le$ 500,000 transitions directly from `PendingApproval` to `Approved`.

3. **High-Value Dual-Approver Rule (> 500,000)**:
   - Any invoice with amount strictly $> 500,000$ (e.g. 500,001) requires **two distinct approvals**.
   - **First Approval**: MUST be submitted by a Manager or Director. A Manager's approval above the Manager limit is recorded as `PartiallyApproved`, not as a final approval. Admin is not permitted as a first approver.
   - **Second Approval**: MUST be approved by a distinct user with the `Director` role. Admin is not permitted as a second approver. Upon second approval, the invoice transitions to `Approved`.

4. **Negative Rule 1: Duplicate Approver (`SAME_APPROVER`)**:
   - The same user may NEVER count as both approvers on one invoice.
   - Approver distinctness MUST be validated by comparing unique user IDs (`user.id === priorApproval.userId`), NEVER by comparing display names, usernames, or roles.
   - If the first approver attempts the second approval, the attempt MUST be rejected with reason code `SAME_APPROVER`.

5. **Negative Rule 2 & Immutability (`SECOND_APPROVER_NOT_DIRECTOR`, Atomic Rejection)**:
   - If a user who is not a Director (including Admin or Manager) attempts the second approval on a high-value invoice, the attempt MUST be rejected with reason code `SECOND_APPROVER_NOT_DIRECTOR`.
   - **Atomic Immutability**: Any rejected approval attempt MUST return a clear standardized reason code and readable error message, and **nothing about the invoice state or repository changes**. The invoice remains deeply equal to its pre-attempt state.

### Standardized Rejection Reason Codes
- `LIMIT_EXCEEDED`: Attempted approval amount exceeds role maximum.
- `SAME_APPROVER`: The same user attempted to approve an invoice twice.
- `SECOND_APPROVER_NOT_DIRECTOR`: High-value second approval attempted by non-Director.
- `ROLE_NOT_ALLOWED`: User's role is not permitted to approve invoices.
- `INVOICE_NOT_PENDING`: Target invoice is not in `PendingApproval` or `PartiallyApproved` state.

## Conventions & Layering

- **Pure Domain**: Business rules live strictly in `src/domain`, never in route handlers or React components. Pure evaluation functions validate preconditions and return `{ ok: true, invoice }` or `{ ok: false, reason, message }`.
- **Validation First**: Validate preconditions before executing any mutation or repository save (`saveInvoice` / `repository.update` called only upon success).
- **Amounts**: Stored as numbers representing integer/decimal currency values.
- **Route Handlers**: Live in `src/app/api/`. Request bodies are typed interfaces. Use `handleApiError(...)` mapping domain errors to appropriate HTTP status codes (404, 409, 400, 401, 403, 422).
- **Authentication**: Endpoints behind sign-in (except login). Restrict with `requireAuth(request, ['Role'])`.
- **Repositories**: Interfaces in `domain/` with in-memory singleton implementation in `infrastructure/` stored on `globalThis.__invoiceRepository`.

## Commands

- Run the app: `npm run dev` then open http://localhost:3000
- Run unit & integration tests: `npm test`
- Run watch mode tests: `npm run test:watch`
- Run end-to-end tests: `npm run test:e2e`
- Run mutation testing: `npm run mutate` (Stryker with vitest runner)
- Run linter: `npm run lint`

## Test Expectations

- **Boundary Matrix**: Every boundary threshold must have explicit unit tests:
  - 49,999 (Manager approves, Director approves)
  - 50,000 (Manager approves at exact limit, Director approves)
  - 50,001 (Manager rejected with `LIMIT_EXCEEDED`, Director approves)
  - 499,999 (Manager rejected with `LIMIT_EXCEEDED`, Director approves)
  - 500,000 (Manager rejected with `LIMIT_EXCEEDED`, Director approves at exact limit)
  - 500,001 (Director cannot sole-approve; transitions to `PartiallyApproved`)
- **Negative Rules**: Named unit tests for `SAME_APPROVER` (comparing user IDs) and `SECOND_APPROVER_NOT_DIRECTOR`.
- **Deep Equality Assertion**: Every rejection test must assert that the invoice snapshot before the call is deeply equal to the invoice state after the call.
- **Route Handler Integration**: Route handlers tested for returning 422 with structured rejection reason codes on limit failures.

## Reusable Agent Definitions

Role-scoped agent definitions are maintained under `.agents/agents/`:

- `spec-writer.agent.md`: OpenSpec artifacts and validation.
- `test-author.agent.md`: Approval tests, rejection codes, and deep-equality assertions.
- `implementer.agent.md`: Pure domain changes within the assigned scope.
- `reviewer.agent.md`: Read-only review against the workshop criteria and diff.
- `e2e-runner.agent.md`: Playwright execution and result reporting.

Each definition lists its purpose, allowed tool aliases, input/output contract, scope restrictions, and interaction-log format. Follow the definition's file ownership; tool outputs are captured by lifecycle hooks and uncaptured decisions/summaries are recorded with `.agents/scripts/log-manual-entry.sh`.

## Review Expectations & Rubric

When reviewing changes or pull requests using the workshop review prompt:
- Evaluate against:
  1. Boundary operator accuracy (`<=` vs `<`, `>=` vs `>`).
  2. Distinct `userId` comparisons rather than roles or usernames.
  3. Validate-first sequencing (no mutation prior to validation).
  4. Layering adherence (no business logic leaked to route handlers or UI).
  5. Test resilience against mutation (boundary and negative tests fail if rule broken).
- Every finding in the review triage table MUST be assigned one of three verdicts:
  - **Fixed**: Code or test changed; reference the specific commit.
  - **Dismissed**: Disagree or not applicable; explain the explicit reason.
  - **Deferred**: Valid suggestion but out of current scope; document rationale and target phase.
- No rubber-stamping: every finding requires defensible reasoning.

## Commit Rules

- One atomic step per commit.
- Message format: `"Commit summary. Why: explanation of intent and business rationale"`.

## Demo accounts (not real credentials)

- `demo.approver` / `ChangeMe123!` (role Approver)
- `demo.admin` / `ChangeMe123!` (role Admin)
- `demo.manager` / `ChangeMe123!` (role Manager)
- `demo.director` / `ChangeMe123!` (role Director)
- `demo.director1` / `ChangeMe123!` (role Director)
- `demo.director2` / `ChangeMe123!` (role Director)

## Never

- Commit real credentials, tokens, secrets, or customer data.
- Add business logic to route handlers or React components.
- Edit or weaken a test simply to make it pass.
- Modify entity state before all validation preconditions succeed.
- Write tests that only perform shallow output snapshots without invariant assertions.
