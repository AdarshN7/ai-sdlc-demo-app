# Proposal

## Why

Invoices currently lack role-based tiered authorization controls, allowing any authorized approver to approve invoices of any monetary value in a single step. To enforce sound corporate governance, prevent unauthorized large expenditures, and mitigate fraud, the system must enforce strict approval limits according to organizational roles (Manager, Director), require dual sign-off on high-value transactions (> $500,000), and guarantee that rejected approval attempts leave invoices completely unmodified while returning actionable reason codes.

## What Changes

- Introduce role-based approval limits:
  - **Manager**: may approve invoices up to 50,000 inclusive.
  - **Director**: may approve invoices up to 500,000 inclusive.
- Introduce dual-approval enforcement for high-value invoices:
  - Invoices greater than 500,000 require two distinct approvers.
  - The second approver must hold the Director or Admin role.
  - The same user is strictly prohibited from approving the same invoice twice.
- Implement atomic rejection and audit reasons:
  - Any failed approval attempt leaves invoice state strictly unmodified.
  - Returns clear standardized reason codes: `LIMIT_EXCEEDED`, `SAME_APPROVER`, `SECOND_APPROVER_NOT_DIRECTOR`, `ROLE_NOT_ALLOWED`, `INVOICE_NOT_PENDING`.

## Capabilities

### New Capabilities

- `approval-limits`: Role-based approval limits, dual-approver validation for high-value invoices, distinct user enforcement, and immutable rejection handling with standardized error reason codes.

### Modified Capabilities

None (first formal OpenSpec specification in the repository).

## Impact

- **Domain Model**: `Invoice` entity updated to support tracking multiple approvals (`approvals: Array<{ userId: string; role: Role }>`), updated statuses (`Draft`, `PendingApproval`, `PartiallyApproved`, `Approved`, `Rejected`), and pure domain validation functions.
- **Service Layer**: `ApprovalService` enforces validation prior to any state mutation, returning structured results (`{ ok: true, invoice }` or `{ ok: false, reason, message }`).
- **API & UI**: Approval endpoints and UI views reflect tiered approval rules, dual-approval pending states, and surfaced rejection reason messages.
