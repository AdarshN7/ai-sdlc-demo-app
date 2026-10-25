# AI in SDLC Assignment: Role-Based Approval Limits

**Author**: Adarsh Nishad  
**Repository**: [ai-sdlc-demo-app](https://github.com/AdarshN7/ai-sdlc-demo-app)  
**Target Feature**: Role-Based Approval Limits with Dual-Approver Workflow for High-Value Invoices  
**Stack**: Next.js 14 (App Router, TypeScript), Vitest, Playwright, StrykerJS, OpenSpec  
**Demo Video**: [Watch Demo Video Walkthrough](https://youtu.be/ai-sdlc-demo-app-walkthrough) *(replace with hosted video recording)*

---

## Executive Summary

This project demonstrates the end-to-end delivery of an enterprise feature—**Role-Based Invoice Approval Limits**—using an AI-assisted Software Development Life Cycle (AI-SDLC). The entire workflow was driven by agentic pair-programming, guided by explicit context contracts in [AGENTS.md](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/AGENTS.md), formal specification via OpenSpec, comprehensive unit and E2E characterization testing, Stryker mutation hardening (improving mutation score from **82.04% to 100.00%**), and human-evaluated code reviews.

---

## 1. Approach & Architectural Decisions

### 1.1 Next.js 14 App Router + Route Handlers
The reference application was originally built in .NET C#. For this modern reimplementation, **Next.js 14 App Router with TypeScript** was chosen for a unified full-stack architecture:
- **Clean Layered Architecture**:
  - `src/domain`: Pure TypeScript business entities, limits constants, validation functions, and repository interfaces. Completely decoupled from React, HTTP, and database I/O.
  - `src/infrastructure`: In-memory persistence on `globalThis`, session management, authentication guards, and centralized HTTP error mapping.
  - `src/app/api`: Next.js Route Handlers (`GET /api/invoices`, `POST /api/approvals/[id]/approve`, `POST /api/test/reset`). They act purely as orchestrators: authenticate request, load entity, call domain function, persist only upon success, and map domain results/errors to standard HTTP responses.
  - `src/app`: React UI client components consuming Route Handlers, displaying returned standardized error codes and handling interactive role switching.

### 1.2 Dropping Redux Toolkit
The workshop brief initially suggested Redux. However, client-side state management for critical business rules poses security and architectural issues:
- **Security & Integrity**: Approval rules are financial constraints; they **must execute authoritatively on the server**. A client-side Redux store can be tampered with or bypassed from developer tools.
- **Architectural Simplicity**: Next.js 14 Route Handlers + server-side domain evaluation eliminate client-server state synchronization issues, avoiding boilerplate slices, reducers, and `redux-persist` sync artifacts.

### 1.3 In-Memory Persistence & Test Reset Trade-Offs
- **In-Memory Store on `globalThis`**: Data resides in `globalThis.__invoiceRepository`. In Next.js development mode, hot module reloading (HMR) triggers module re-evaluations; binding the repository singleton to `globalThis` ensures state persistence across HMR refreshes without spinning up an external database.
- **Trade-Off**: Server restarts reset the repository to default seed fixtures (`INV-1001` through `INV-1005`). This is ideal for a local workshop demo and rapid automated testing.
- **Test Reset Endpoint (`POST /api/test/reset`)**:
  - Exists to provide test isolation for Playwright E2E suites.
  - **Production Guard**: Returns HTTP 404 in production unless explicitly authorized via `ALLOW_TEST_RESET: 'true'`, preventing accidental state wipes in production deployments.

---

## 2. AGENTS.md & Cold-vs-Context Analysis

### 2.1 The Role of AGENTS.md
[AGENTS.md](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/AGENTS.md) acts as the operational constitution for AI agents interacting with this codebase. It documents:
1. Exact directory conventions and separation of concerns.
2. The 5 business rules with strict boundary definitions (inclusive limits at 50,000 and 500,000).
3. Standardized rejection reason codes (`LIMIT_EXCEEDED`, `SAME_APPROVER`, `SECOND_APPROVER_NOT_DIRECTOR`, `ROLE_NOT_ALLOWED`, `INVOICE_NOT_PENDING`).
4. Strict invariants: atomic immutability (validate-before-change), deep equality checks on failure.
5. Review rubric and commit message conventions (`"Commit summary. Why: explanation"`).

### 2.2 Cold vs. Context Proof
To verify whether `AGENTS.md` materially improves AI generation, an identical prompt was submitted to the agent under two conditions:
- **Cold Run**: Without `AGENTS.md` (file temporarily removed).
- **Context Run**: With `AGENTS.md` active.

The full evidence is documented in [docs/cold-vs-context.md](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/docs/cold-vs-context.md). Key findings:

| Dimension | Cold Execution (Without `AGENTS.md`) | Context Execution (With `AGENTS.md`) |
| :--- | :--- | :--- |
| **Layering** | Leaked validation logic directly into Route Handlers with magic numbers. | Separated logic into pure domain evaluation (`src/domain/approval-limits.ts`). |
| **Boundary Accuracy** | Used `< 50000` or strict inequality, causing off-by-one errors on exact limit boundaries. | Used `invoice.amount > MANAGER_APPROVAL_LIMIT` with named constants, honoring inclusive $\le$ 50,000. |
| **Rejection Codes** | Returned arbitrary `{ error: "Amount too high" }` with generic 400. | Returned standardized `{ reason: 'LIMIT_EXCEEDED', message: '...' }` with 422 Unprocessable Entity. |
| **Atomic Immutability** | Mutated invoice object fields before validation succeeded. | Evaluated preconditions in a pure function; unmodified invoice returned when rejected. |
| **Test Quality** | Wrote 2 shallow tests with assertions that easily passed surviving mutants. | Wrote full boundary matrix (49,999 to 500,001) with deep equality snapshots. |

---

## 3. Agent Ecosystem: Roles, Skills, & Hooks

### 3.1 Agent Delegation Matrix

| Agent Role | Scope & Permissions | Key Deliverable |
| :--- | :--- | :--- |
| **Orchestrator** | High-level roadmap planning, delegation, progress tracking. Read-only on source. | Phased implementation roadmap and task sequencing. |
| **Spec Agent** | Runs OpenSpec CLI, creates Given/When/Then scenarios and boundary tables. | Specification artifacts in `openspec/changes/approval-limits/`. |
| **Implementer** | Implements domain entities, limits logic, route handlers, and UI components. | Pure functions, constants, route handlers, UI components. |
| **Test-Writer** | Writes Vitest unit tests, boundary tests, negative rule tests, and Playwright E2E tests. | Test suites in `tests/unit/`, `tests/integration/`, `e2e/`. |
| **Reviewer** | Reviews git diffs against the workshop review rubric; outputs structured findings. | PR description triage table with defensible verdicts. |
| **Mutation Analyst** | Analyzes Stryker survivor reports, pinpoints mutant escapes, proposes hardening tests. | Survivor triage report and mutation test enhancements. |

### 3.2 Skills & Automation Hooks
- **Skills**:
  - `interaction-audit`: Automatically documents interactions, agent tool executions, and decisions.
  - `openspec-*`: Orchestrates OpenSpec proposal generation, specification updates, and validation.
- **Hooks & Continuous Logging**:
  - Configured in `.agents/hooks.json` and executed via `.agents/scripts/interaction-logger.py`.
  - Captures every agent session event, tool call, parameter, and summary into [`.ai-sdlc/interaction-log.jsonl`](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/.ai-sdlc/interaction-log.jsonl), providing an immutable audit trail of all AI interactions.

---

## 4. Specification Tooling (OpenSpec) & Hand Refinements

### 4.1 OpenSpec Workflow
We initialized OpenSpec (`@fission-ai/openspec`) at the repository root and generated a formal proposal and delta specification under `openspec/changes/approval-limits/`:
- `proposal.md`: Problem statement, business goals, and two-step rollout strategy.
- `specs/approval-limits.spec.md`: Detailed Given/When/Then acceptance criteria covering all 5 business rules.
- `tasks.md`: Phased task breakdown mapping rules to files and verification tests.

### 4.2 Hand Edits & Human Judgement
The raw agent output required the following hand refinements:
1. **Explicit Boundary Thresholds**: Added a concrete boundary value table (49,999; 50,000; 50,001; 499,999; 500,000; 500,001) to prevent ambiguity between `<` and `<=`.
2. **Rejection Reason Standard**: Standardized the exact reason code string literals (`LIMIT_EXCEEDED`, `SAME_APPROVER`, `SECOND_APPROVER_NOT_DIRECTOR`, `ROLE_NOT_ALLOWED`, `INVOICE_NOT_PENDING`) to align across domain, API, and UI.
3. **Dual-Approver Workflow Clarification**: Explicitly specified that for invoices $> 500,000$, the first approval transitions the invoice to `PartiallyApproved`, and only the second approval (by a distinct Director) sets the status to `Approved`.

---

## 5. Where the AI Failed & How Tests Caught It

During the iterative implementation, the AI agent exhibited three notable failure modes that were caught and corrected by rigorous test design:

### Failure 1: Checking Role or Username Instead of Unique `userId`
- **What the AI did**: When implementing the negative rule against duplicate approvers (`SAME_APPROVER`), the initial agent code checked:
  ```typescript
  const isSameApprover = priorApprovals.some(a => a.role === approver.role);
  ```
  This incorrectly rejected distinct Directors (e.g., Director 1 approved first, and Director 2 attempted second approval) because both had `role === 'Director'`.
- **How tests caught it**: Vitest unit test `2nd approval by distinct Director marks it Approved` failed immediately, proving that approvers must be compared by unique `userId` (`a.userId === approverId`).

### Failure 2: Mutating State Before Precondition Validation
- **What the AI did**: In an early iteration of `ApprovalService`, the agent assigned:
  ```typescript
  invoice.decidedBy = approver;
  invoice.status = 'Approved';
  if (invoice.amount > 50000 && role === 'Manager') {
    throw new ApprovalRejectedError('LIMIT_EXCEEDED', ...);
  }
  ```
- **How tests caught it**: The immutability test `Preserves deep equality of invoice on Manager limit rejection` took a deep snapshot before calling the method:
  ```typescript
  expect(invoice).toEqual(invoiceSnapshot);
  ```
  The test caught the modified `decidedBy` field on the rejected invoice, forcing a validate-first pure function pattern.

### Failure 3: Boundary Operator Mutations Survived
- **What the AI did**: The agent wrote tests for $40,000$ and $60,000$, omitting exact limit boundaries.
- **How tests caught it**: Stryker mutated `>` to `>=` and `<=` to `<`, which survived. Adding explicit unit tests for exact boundary points (50,000 and 50,001) killed these surviving mutants.

---

## 6. Mutation Testing (Stryker) Score Comparison

Mutation testing was executed using `@stryker-mutator/core` with `@stryker-mutator/vitest-runner`.

### 6.1 Before Hardening (Score: 82.04%)
Captured on unhardened agent-generated tests right after Phase 5 (Step 2) in [docs/mutation/before.txt](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/docs/mutation/before.txt):

```text
------------------------|------------------|----------|-----------|------------|----------|----------|
                        | % Mutation score |          |           |            |          |          |
File                    |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
All files               |  82.04 |   91.36 |      201 |         0 |         19 |       25 |        0 |
 approval-limits.ts     |  78.62 |   89.76 |      114 |         0 |         13 |       18 |        0 |
 approval-service.ts    |  81.43 |   90.48 |       57 |         0 |          6 |        7 |        0 |
 discount-calculator.ts | 100.00 |  100.00 |       29 |         0 |          0 |        0 |        0 |
 errors.ts              | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
```
*Key Survivors in Before Run*:
- `approval-limits.ts`: Surviving mutants in `isSameApprover` fallback checks and Admin role comparisons.
- `approval-service.ts`: Surviving mutants in `ensurePending` validation bypass and identity extraction.

### 6.2 After Hardening (Score: 100.00%)
Captured after comprehensive test hardening in [docs/mutation/after.txt](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/docs/mutation/after.txt):

```text
------------------------|------------------|----------|-----------|------------|----------|----------|
                        | % Mutation score |          |           |            |          |          |
File                    |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
All files               | 100.00 |  100.00 |      232 |         0 |          0 |        0 |        0 |
 approval-limits.ts     | 100.00 |  100.00 |      135 |         0 |          0 |        0 |        0 |
 approval-service.ts    | 100.00 |  100.00 |       67 |         0 |          0 |        0 |        0 |
 discount-calculator.ts | 100.00 |  100.00 |       29 |         0 |          0 |        0 |        0 |
 errors.ts              | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
```
- **Total Mutants Killed**: Increased from 201 to **232**.
- **Survivors**: Reduced from 19 to **0**.
- **Uncovered Mutants**: Reduced from 25 to **0**.

---

## 7. Pull Request & Code Review Triage

A comprehensive code review was performed on the cumulative diff using the workshop review prompt. Findings were triaged using human judgement without rubber-stamping:

### Code Review Findings Triage Table

| # | Finding Description | Severity | Verdict | Reason or Resolution Commit |
| :-: | :--- | :---: | :---: | :--- |
| **1** | Default approver fallback `approver.id \|\| approver.username \|\| 'unknown'` in `evaluateApproval` could accept unverified identities if invoked directly. | Low | **Dismissed** | Defensible design: `requireAuth` middleware guarantees authenticated credentials with valid `userId` upstream before reaching route handler. The domain fallback is a safe defensive default. |
| **2** | High-value dual-approval rule allows either Manager or Director to be the first approver. | Low | **Dismissed** | Working as designed: The requirement specification explicitly permits Manager, Director, or Admin to submit the initial approval on invoices $> 500,000$, holding the invoice in `PartiallyApproved` until a distinct Director submits the second approval. |
| **3** | Rejection audit trail / decision note is not recorded for rejected approval attempts (only on explicit user rejections). | Low | **Deferred** | Valid feature improvement, but out of current workshop scope. In-memory approval attempts fail atomically returning HTTP 422 with structured `reason`. Persisting audit records for failed approval attempts is deferred to the database audit logging phase. |
| **4** | Test reset route `/api/test/reset` could be triggered inadvertently if running in production mode. | Medium | **Fixed** | Updated `src/app/api/test/reset/route.ts` to require `ALLOW_TEST_RESET: 'true'` in production mode, and configured Playwright `webServer` environment in commit `24de945`. |
| **5** | Invoices UI table displays formatted status `"Pending Approval"` while raw domain status is `"PendingApproval"`, causing selector confusion. | Low | **Fixed** | Updated page objects in `e2e/pages/InvoicesPage.ts` and normalized E2E assertions in `e2e/tests/app.spec.ts` in commit `24de945`. |
| **6** | Potential for multiple approvals to be appended if an invoice is already in `Approved` state. | High | **Dismissed** | Protected by invariant guard: `evaluateApproval` checks `if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') return { ok: false, reason: 'INVOICE_NOT_PENDING' }`. Verified by explicit unit tests. |
| **7** | Hardcoded USD currency formatting across React components and formatters. | Low | **Deferred** | Out of scope: The assignment assumption explicitly defines: *"Amounts are stored as integers with one currency."* Multi-currency support is deferred to future localization sprint. |
| **8** | Potential concurrency conflict if two Directors approve a high-value invoice at the exact same millisecond in-memory. | Medium | **Deferred** | For this single-process in-memory demo, JavaScript event-loop concurrency guarantees sequential execution. Database row locking (`SELECT FOR UPDATE`) or optimistic concurrency versioning is deferred to PostgreSQL migration. |

---

## 8. Playwright End-to-End Verification

The complete user workflow is verified end-to-end via Playwright in [e2e/tests/app.spec.ts](file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/e2e/tests/app.spec.ts):

1. **State Isolation**: Calls `POST /api/test/reset` before execution to restore clean seed data.
2. **Authentication & Role Selection**: Logs in as Manager (`demo.manager`).
3. **Attempting Over-Limit Approval**: Attempts to approve `INV-1002` ($75,000).
4. **Error Alert Visibility**: Verifies `#approval-error` appears displaying `LIMIT_EXCEEDED: Invoice amount 75000 exceeds Manager approval limit of 50000.`.
5. **State Immutability**: Asserts that `INV-1002` remains `PendingApproval` in the approvals queue and invoices table.
6. **Persistence Across Reload**: Reloads browser window (`page.reload()`) and confirms `INV-1002` remains `PendingApproval` on the server.
7. **User Switcher Verification**: Validates switching between Manager and Director accounts.

All 7 Playwright E2E tests pass cleanly (`npm run test:e2e`).

---
