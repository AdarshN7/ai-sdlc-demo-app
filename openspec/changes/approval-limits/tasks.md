# Tasks

## 1. Step 1: Single-Approver Role Limits

- [x] 1.1 Define approval threshold constants (`MANAGER_APPROVAL_LIMIT = 50_000`, `DIRECTOR_APPROVAL_LIMIT = 500_000`) and rejection reason enum/types in `src/domain/approval-limits.ts`, and verify TypeScript compilation with `npx tsc --noEmit`.
- [x] 1.2 Implement test suite in `tests/unit/approval-limits-step1.test.ts` covering boundary values (49,999, 50,000, 50,001, 499,999, 500,000), Manager rejection with `LIMIT_EXCEEDED`, Director passing up to 500,000, and deep equality immutability of invoice upon rejection; verify tests fail prior to domain implementation.
- [x] 1.3 Implement pure domain approval function and integrate with `ApprovalService` in `src/domain/approval-service.ts` to enforce single-approver limits and return standardized `LIMIT_EXCEEDED` reason; verify with `npm test`.
- [x] 1.4 Wire route handlers in `src/app/api/approvals/[id]/approve/route.ts` to surface reason codes and structured messages on limit rejections; verify with `tests/integration/api-routes.test.ts`.

## 2. Step 2: High-Value Dual-Approver Rule

- [x] 2.1 Extend `Invoice` model in `src/domain/invoice.ts` to include `approvals: Array<{ userId: string; role: Role; approvedAt: string }>` while preserving backward compatibility; verify type checks with `npx tsc --noEmit`.
- [x] 2.2 Implement test suite in `tests/unit/approval-limits-step2.test.ts` covering invoices over 500,000: boundary 500,001, Manager/Director first approval transitioning to `PartiallyApproved`, Director-only second approval, Admin rejection, duplicate user (`SAME_APPROVER`), and non-Director second approver (`SECOND_APPROVER_NOT_DIRECTOR`); verify tests fail prior to implementation.
- [x] 2.3 Implement dual-approval logic in `src/domain/approval-service.ts` comparing approver IDs via `user.id === priorApproval.userId` and requiring a distinct Director for the second approval; verify all domain tests pass with `npm test`.
- [x] 2.4 Update API route handlers and error mapping in `src/infrastructure/http/api-handler.ts` and `src/app/api/approvals/[id]/approve/route.ts` to handle multi-approval workflow and return reason codes `SAME_APPROVER` and `SECOND_APPROVER_NOT_DIRECTOR`; verify integration tests with `npm test`.
- [x] 2.5 Run Stryker mutation testing with `npm run mutate` to assess mutant kill rate and survivor profile for boundaries and negative rules, recording output in `docs/mutation/before.txt`.

## Workflow follow-up

- [x] Implement E2E Playwright test for rejected over-limit approval through the UI (`e2e/tests/app.spec.ts`).
- [x] Harden unit tests against Stryker survivors and record final score in `docs/mutation/after.txt`.
- [x] Open pull request and complete AI review triage (`docs/pull-request-description.md`, PR #8).

## Approval Policy Remediation

- [x] 3.1 Update the OpenSpec proposal, design, delta spec, and task breakdown to require a Manager or Director as first approver and a distinct Director as second approver; explicitly reject Admin for both high-value steps.
- [x] 3.2 Add failing unit tests for Admin as second approver and as first approver, Manager as second approver, and duplicate user IDs across same and different roles; assert reason codes and deep equality snapshots.
- [x] 3.3 Update only the domain approval evaluator to enforce the approved high-value roles; preserve Admin's unrelated sole-approval and invoice-administration permissions.
- [x] 3.4 Rerun mutation testing, account for the display-fallback mutant, and replace `docs/mutation/after.txt` with the full fresh run output.
- [ ] 3.5 Add standalone role-specific agent definitions and update `AGENTS.md`, `ASSIGNMENT.md`, and the PR description with current policy and audit evidence.
- [ ] 3.6 Review the complete remediation diff with a reviewer separate from the implementer and update the PR findings/verdicts.
- [ ] 3.7 Run final tests, lint, build, E2E, mutation, and strict OpenSpec validation; record current interaction-log evidence.
