# Pull Request: Role-Based Approval Limits & Playwright E2E Verification

**Target Branch**: `main`  
**Source Branch**: `feat/approval-limits-step4-e2e`  
**Pull Request**: [PR #8](https://github.com/AdarshN7/ai-sdlc-demo-app/pull/8)
**All closed PRs**: [Repository PR index](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls?q=is%3Apr+state%3Aclosed)
**Deliverable Document**: [ASSIGNMENT.md](../ASSIGNMENT.md)

## Commit Message Convention

The original implementation commits `c4648c9` and `a5bae3e` predate the `Why:` trailer convention. They are part of existing history and were not rewritten. The remediation commits use a `Why:` explanation and Copilot co-author trailer.

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
6. **Approval Policy Remediation**:
   - High-value approvals now require a Manager or Director first (Manager stays `PartiallyApproved`) and a distinct Director second. Admin is rejected at both high-value steps.
   - Added reason-code and deep-equality tests for Admin first/second rejection and same user IDs across different roles; the existing Manager-second test remains.
   - Added five scoped agent definitions and refreshed the mutation output.

---

## External Review Findings

The original external review transcripts were not checked into this repository; these summaries record the Admin/Manager findings named for this remediation.

| Source | Finding | Severity | Verdict | Evidence / rationale |
| :--- | :--- | :---: | :---: | :--- |
| Antigravity | Admin could participate in high-value approvals despite D1/D2. | High | **Fixed** | OpenSpec policy in `56b2c8c`, expected-red tests in `2c0ddda`, domain enforcement in `bf0e7c6`; Admin now receives `ROLE_NOT_ALLOWED` as first approver and `SECOND_APPROVER_NOT_DIRECTOR` as second, with deep-equal snapshots. |
| Copilot | Manager's first approval above the $50,000 sole-approval limit needed explicit non-final semantics. | Medium | **Fixed** | D2 specifies a Manager or Director may provide the first high-value approval, but it remains `PartiallyApproved`; the Step 2 Manager-first test asserts that transition. Spec and project guidance clarified in `56b2c8c` and `f99e9f0`. |
| npm audit | Installed dependency tree reports 13 vulnerabilities (5 moderate, 5 high, 3 critical). | High | **Deferred** | Demo-only in-memory application; dependency remediation is deferred, and the dependencies must be reviewed before production deployment. |

## Reviewer Sub-agent Findings

The complete remediation diff was reviewed read-only against `.github/instructions/pull-request-review.instructions.md` by a reviewer separate from the implementer.

| Source | Finding | Severity | Verdict | Evidence / rationale |
| :--- | :--- | :---: | :---: | :--- |
| Reviewer sub-agent | The boundary requirement described a Director's $50,001 sole approval as partial, conflicting with the $500,000 dual-approval threshold and existing tests. | Medium | **Fixed** | Corrected the spec to state that a Director sole-approves $50,001 and that Manager `LIMIT_EXCEEDED` applies to sole approval through $500,000; changes included in the Phase 6 review-docs commit. |

## Workshop Review Findings Triage Table

The full diff was reviewed using the workshop review prompt (`.github/instructions/pull-request-review.instructions.md`). Every finding has been triaged with defensible reasoning:

| # | Finding Description | Severity | Verdict | Reason or Resolution Commit |
| :-: | :--- | :---: | :---: | :--- |
| **1** | Default approver fallback `approver.id \|\| approver.username \|\| 'unknown'` in `evaluateApproval` could accept unverified identities if invoked directly. | Low | **Dismissed** | `ApproverIdentity.id` is required and duplicate checks use `approver.id`; the fallback only supplies the display field `decidedBy`, not approval identity or authorization. |
| **2** | High-value dual-approval allows a Manager to submit the first approval above the single-approval limit. | Low | **Dismissed** | D2 explicitly allows a Manager or Director to submit the first approval above 500,000, but the Manager transition is `PartiallyApproved`, never final approval. Admin is excluded; see the remediation findings below. |
| **3** | Rejection audit trail / decision note is not recorded for rejected approval attempts (only on explicit user rejections). | Low | **Deferred** | Valid feature improvement, but out of current workshop scope. In-memory approval attempts fail atomically returning HTTP 422 with structured `reason`. Persisting audit records for failed approval attempts is deferred to the database audit logging phase. |
| **4** | Test reset route `/api/test/reset` could be triggered inadvertently if running in production mode. | Medium | **Fixed** | Updated `src/app/api/test/reset/route.ts` to require `ALLOW_TEST_RESET: 'true'` in production mode, and configured Playwright `webServer` environment in commit `24de945`. |
| **5** | Invoices UI table displays formatted status `"Pending Approval"` while raw domain status is `"PendingApproval"`, causing selector confusion. | Low | **Fixed** | Updated page objects in `e2e/pages/InvoicesPage.ts` and normalized E2E assertions in `e2e/tests/app.spec.ts` in commit `24de945`. |
| **6** | Potential for multiple approvals to be appended if an invoice is already in `Approved` state. | High | **Dismissed** | Protected by invariant guard: `evaluateApproval` checks `if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') return { ok: false, reason: 'INVOICE_NOT_PENDING' }`. Verified by explicit unit tests. |
| **7** | Hardcoded USD currency formatting across React components and formatters. | Low | **Deferred** | Multi-currency presentation is outside this approval-limit change; currency selection and conversion need a separate product requirement. |
| **8** | Potential concurrency conflict if two Directors approve a high-value invoice at the exact same millisecond in-memory. | Medium | **Deferred** | The in-memory repository has no transaction or version check. Concurrency protection is deferred to durable persistence. |

---

## Test Verification Summary

- **Unit & Integration Tests**: 81/81 passed (`npm test`)
- **Playwright E2E Tests**: 7/7 passed (`npm run test:e2e`)
- **Stryker Mutation Testing**: 99.50% score (201 killed, 0 survived, 1 no-coverage display-fallback mutant; 202 mutants) (`npm run mutate`)
- **Next.js Production Build**: Passed (`npm run build`)
