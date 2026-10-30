# Pull Request: Role-Based Approval Limits & Playwright E2E Verification

**Target Branch**: `main`  
**Source Branch**: `feat/approval-limits-step4-e2e`  
**Pull Request**: [PR #8](https://github.com/AdarshN7/ai-sdlc-demo-app/pull/8)
**All closed PRs**: [Repository PR index](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls?q=is%3Apr+state%3Aclosed)
**Deliverable Document**: [ASSIGNMENT.md](../ASSIGNMENT.md)

---

## Summary of Changes

This Pull Request completes **Phase 7: Playwright E2E Test** and integrates the full deliverables for **Phases 8 & 9 (PR, Review, Write-up & Demo)**:

1. **User Switcher & Role Selection**:
   - Added user switcher dropdown (`#user-switcher`) to the sign-in form for quick demo account / role selection.
   - Added user switcher dropdown in the dashboard header session bar with `handleSwitchUser`, enabling direct role switching without signing out.
   - Added responsive design styling for `.user-switcher-container` and `.user-switcher-select` in `src/app/globals.css`.

2. **Rejection Reason Display (`#approval-error`)**:
   - Formatted approval API rejections to return both the standardized reason code and human-readable message (`LIMIT_EXCEEDED: Invoice amount 75000 exceeds Manager approval limit of 50000.`).
   - Displayed error within `<p id="approval-error" data-testid="approval-error" role="alert">`.

3. **Isolated Test Reset Endpoint Guard**:
   - Updated `src/app/api/test/reset/route.ts` to require `ALLOW_TEST_RESET: 'true'` in production environments.
   - Configured `e2e/playwright.config.ts` to supply this environment variable during test server execution.

4. **Playwright E2E Test**:
   - Added `e2e/tests/app.spec.ts`:
     - Resets test state via `/api/test/reset`.
     - Logs in as Manager (`demo.manager`).
     - Attempts to approve `INV-1002` ($75,000).
     - Verifies `#approval-error` appears with `LIMIT_EXCEEDED` and `exceeds Manager approval limit`.
     - Asserts invoice status remains `Pending Approval` in queue and invoices table.
     - Reloads page and asserts status remains `Pending Approval` (deep immutability on server).
     - Verifies user switcher switching to Director.

5. **Deliverables Documentation**:
   - Added the root [ASSIGNMENT.md](../ASSIGNMENT.md) with architecture, test, mutation, interaction-log, and review evidence.
   - Demo video URLs and an outline are documented in the assignment. The previously referenced `FRS-Roadmap-implementation-plan/demo-video-script.md` is not present in this repository.

---

## Workshop Review Findings Triage Table

The full diff was reviewed using the workshop review prompt (`.github/instructions/pull-request-review.instructions.md`). Every finding has been triaged with defensible reasoning:

| # | Finding Description | Severity | Verdict | Reason or Resolution Commit |
| :-: | :--- | :---: | :---: | :--- |
| **1** | Default approver fallback `approver.id \|\| approver.username \|\| 'unknown'` in `evaluateApproval` could accept unverified identities if invoked directly. | Low | **Dismissed** | Defensible design: `requireAuth` middleware guarantees authenticated credentials with valid `userId` upstream before reaching route handler. The domain fallback is a safe defensive default. |
| **2** | High-value dual-approval rule allows either Manager or Director to be the first approver. | Low | **Dismissed** | Working as designed: The requirement specification explicitly permits Manager, Director, or Admin to submit the initial approval on invoices $> 500,000$, holding the invoice in `PartiallyApproved` until a distinct Director submits the second approval. |
| **3** | Rejection audit trail / decision note is not recorded for rejected approval attempts (only on explicit user rejections). | Low | **Deferred** | Valid feature improvement, but out of current workshop scope. In-memory approval attempts fail atomically returning HTTP 422 with structured `reason`. Persisting audit records for failed approval attempts is deferred to the database audit logging phase. |
| **4** | Test reset route `/api/test/reset` could be triggered inadvertently if running in production mode. | Medium | **Fixed** | Updated `src/app/api/test/reset/route.ts` to require `ALLOW_TEST_RESET: 'true'` in production mode, and configured Playwright `webServer` environment in commit `24de945`. |
| **5** | Invoices UI table displays formatted status `"Pending Approval"` while raw domain status is `"PendingApproval"`, causing selector confusion. | Low | **Fixed** | Updated page objects in `e2e/pages/InvoicesPage.ts` and normalized E2E assertions in `e2e/tests/app.spec.ts` in commit `24de945`. |
| **6** | Potential for multiple approvals to be appended if an invoice is already in `Approved` state. | High | **Dismissed** | Protected by invariant guard: `evaluateApproval` checks `if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') return { ok: false, reason: 'INVOICE_NOT_PENDING' }`. Verified by explicit unit tests. |
| **7** | Hardcoded USD currency formatting across React components and formatters. | Low | **Deferred** | Multi-currency presentation is outside this approval-limit change; currency selection and conversion need a separate product requirement. |
| **8** | Potential concurrency conflict if two Directors approve a high-value invoice at the exact same millisecond in-memory. | Medium | **Deferred** | The in-memory repository has no transaction or version check. Concurrency protection is deferred to durable persistence. |

---

## Test Verification Summary

- **Unit & Integration Tests**: 80/80 passed (`npm test`)
- **Playwright E2E Tests**: 7/7 passed (`npm run test:e2e`)
- **Stryker Mutation Testing**: 100.00% score (232 killed, 0 survived, 0 no-coverage) (`npm run mutate`)
- **Next.js Production Build**: Passed (`npm run build`)
