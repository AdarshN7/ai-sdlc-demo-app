# Design

## Context

The application currently has a baseline `ApprovalService` that moves invoices through `Draft -> PendingApproval -> Approved` or `Rejected` decided as a whole by a single approver, without checking monetary thresholds or role limits. See `proposal.md` for background and business motivation.

The project adheres to domain-driven hexagonal layering (as defined in `AGENTS.md`): business rules reside strictly in `src/domain/` as pure, deterministic TypeScript logic with no web framework dependencies.

## Goals / Non-Goals

**Goals:**
- Provide a pure domain approval decision function that validates role limits, dual-approver requirements, distinct user IDs, and returns a discriminated union result (`{ ok: true, invoice }` vs `{ ok: false, reason, message }`).
- Guarantee zero side-effects and absolute state immutability on any failed validation.
- Standardize rejection reason codes across domain, API endpoints, and UI error displays.
- Enable high-confidence unit testing, E2E Playwright testing, and complete mutant killing in Stryker.

**Non-Goals:**
- Complex multi-currency conversion or dynamic tax calculations (amounts are single currency units).
- External notification dispatch (e.g. emails or webhook alerts) on multi-stage approval.
- Arbitrary n-tier approval hierarchies beyond Manager and Director limits.

## Decisions

### 1. Pure Domain Validation Function with Discriminated Union Result
- **Decision**: Implement domain logic as a pure validation and transformation function in `src/domain/approvals.ts` or `src/domain/approval-service.ts` that takes `(invoice: Invoice, approver: { id: string; role: Role })` and returns:
  ```typescript
  type ApprovalResult =
    | { ok: true; invoice: Invoice }
    | { ok: false; reason: ApprovalRejectionReason; message: string };
  ```
- **Rationale**: Keeps business rules completely isolated from HTTP route handlers and UI components. Guarantees that on failure, the original invoice instance is returned untouched (satisfying reference or deep equality checks).
- **Alternatives considered**: Throwing domain exceptions on rejection. Rejected because returning a structured result simplifies reducer and service-level rejection handling without error try/catch overhead, while domain errors can still be mapped for HTTP responses.

### 2. Inclusive Boundary Comparisons
- **Decision**: Use `<=` comparisons for tier thresholds:
  - Manager allowed limit: `amount <= 50_000`
  - Director sole-approver allowed limit: `amount <= 500_000`
  - Dual approval triggered when: `amount > 500_000`
- **Rationale**: Matches standard corporate finance policy: an invoice of exactly $50,000 is within manager signing authority; an invoice of exactly $500,000 is within director signing authority.

### 3. Distinct Approver Comparison by User ID
- **Decision**: Always compare unique user identifiers (`user.id === priorApproval.userId`), never user names, display names, or roles.
- **Rationale**: Prevents common agent defects where comparing roles (e.g., both are Directors) or display names produces false positive rejections or allows the same person to approve twice under different names.

### 4. High-Value Multi-Approval State Representation
- **Decision**: Update `Invoice` model to include an `approvals` array:
  ```typescript
  export interface InvoiceApproval {
    userId: string;
    role: Role;
    approvedAt: string;
  }
  ```
  For an invoice exceeding 500,000:
  - First valid approval appends to `approvals` array and transitions `status = 'PartiallyApproved'`.
  - Second valid approval by a Director or Admin appends to `approvals` and transitions `status = 'Approved'`.
- **Rationale**: Retains full audit trail of both sign-offs without requiring extra intermediate lifecycle states that break existing invoice queries.

## Boundary Values Table

The following boundary conditions establish exact system behavior across threshold amounts:

| Amount | Role Attempting | Approver Sequence | Expected Result | Reason Code | Resulting Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **49,999** | Manager | 1st approver | **Approved** | None | `Approved` |
| **49,999** | Director | 1st approver | **Approved** | None | `Approved` |
| **50,000** | Manager | 1st approver | **Approved** (inclusive limit) | None | `Approved` |
| **50,000** | Director | 1st approver | **Approved** | None | `Approved` |
| **50,001** | Manager | 1st approver | **Rejected** | `LIMIT_EXCEEDED` | `PendingApproval` (unchanged) |
| **50,001** | Director | 1st approver | **Approved** | None | `Approved` |
| **499,999** | Manager | 1st approver | **Rejected** | `LIMIT_EXCEEDED` | `PendingApproval` (unchanged) |
| **499,999** | Director | 1st approver | **Approved** | None | `Approved` |
| **500,000** | Manager | 1st approver | **Rejected** | `LIMIT_EXCEEDED` | `PendingApproval` (unchanged) |
| **500,000** | Director | 1st approver | **Approved** (inclusive limit) | None | `Approved` |
| **500,001** | Manager | 1st approver | **Recorded (Pending)** | None | `PartiallyApproved` (1/2 approvals) |
| **500,001** | Director | 1st approver | **Recorded (Pending)** | None | `PartiallyApproved` (1/2 approvals) |
| **500,001** | Admin | 1st approver | **Recorded (Pending)** | None | `PartiallyApproved` (1/2 approvals) |
| **500,001** | Same User | 2nd approver | **Rejected** | `SAME_APPROVER` | `PartiallyApproved` (unchanged) |
| **500,001** | Manager | 2nd approver (diff user) | **Rejected** | `SECOND_APPROVER_NOT_DIRECTOR` | `PartiallyApproved` (unchanged) |
| **500,001** | Director | 2nd approver (diff user) | **Approved** | None | `Approved` (2/2 approvals) |
| **500,001** | Admin | 2nd approver (diff user) | **Approved** | None | `Approved` (2/2 approvals) |

## Standard Rejection Reason Codes

The system defines the following canonical reason codes returned upon rejected approval attempts:

- `LIMIT_EXCEEDED`: The invoice amount exceeds the maximum allowed approval limit for the approver's role.
- `SAME_APPROVER`: The same user ID has already approved this invoice and cannot provide a second approval.
- `SECOND_APPROVER_NOT_DIRECTOR`: The second approval on an invoice exceeding 500,000 was attempted by a user who is neither a Director nor Admin.
- `ROLE_NOT_ALLOWED`: The user's role does not possess permissions to approve invoices.
- `INVOICE_NOT_PENDING`: The invoice is not in a pending approval state (e.g., already `Draft`, `Approved`, or `Rejected`).

## Resolution of Open Questions

1. **Inclusive Limits**: "Up to 50,000" and "up to 500,000" are strictly inclusive. Amounts of 50,000.00 and 500,000.00 are valid for Manager and single Director respectively.
2. **First Approver for High-Value Invoices**: For invoices > 500,000, the first approver may be a Manager, Director, or Admin. The invoice moves to `PartiallyApproved` until a second, distinct Director or Admin signs off.
3. **Invoice Status After First Approval**: The status becomes `PartiallyApproved`, with the first approval persisted in the `approvals` array.
4. **Amount Representation**: Amounts are positive numeric values representing single-currency values.

## Risks / Trade-offs

- **[Risk] State Mutation Before Validation**: An implementation might modify `invoice.approvals` or timestamps before validating the second approver's role or identity.
  - **Mitigation**: Validate all preconditions (status, role limit, duplicate user, second approver role) *before* constructing the updated invoice object. Write unit tests explicitly asserting deep equality of input invoice when validation fails.
- **[Risk] Mutation Testing Survivors**: Off-by-one boundary mutants (`<` vs `<=`) or deleted `userId` checks surviving test suites.
  - **Mitigation**: Dedicated unit tests for boundary values (`49,999`, `50,000`, `50,001`, `499,999`, `500,000`, `500,001`) and explicit negative-rule tests for `SAME_APPROVER` and `SECOND_APPROVER_NOT_DIRECTOR`.
