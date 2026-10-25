# Spec Delta

## Purpose

Enforces role-based approval limits, dual-approver sign-off for high-value transactions, distinct approver constraints, and atomic rejections with standardized reason codes for invoices.

## ADDED Requirements

### Requirement: Role-Based Single Approver Limits
The system SHALL enforce maximum approval limits based on the approver's role for single-approver invoice approval. Managers SHALL only be permitted to approve invoices with amounts up to 50,000 inclusive. Directors SHALL only be permitted to approve invoices with amounts up to 500,000 inclusive as a sole approver. Exceeding attempts SHALL be rejected with reason code `LIMIT_EXCEEDED` and leave the invoice unchanged.

#### Scenario: Manager approves invoice at or below limit
- **WHEN** an invoice has an amount of 49,999 or 50,000 and a user with the Manager role submits an approval
- **THEN** the approval is accepted and the invoice status transitions to `Approved` with the decision recorded

#### Scenario: Manager attempts to approve invoice exceeding limit
- **WHEN** an invoice has an amount of 50,001 or greater and a user with the Manager role submits an approval
- **THEN** the approval is rejected with reason code `LIMIT_EXCEEDED`, an informative error message is returned, and all fields of the invoice remain completely unchanged

#### Scenario: Director approves invoice at or below single-approver limit
- **WHEN** an invoice has an amount between 50,001 and 500,000 (inclusive) and a user with the Director role submits an approval
- **THEN** the approval is accepted and the invoice status transitions to `Approved` with the decision recorded

#### Scenario: Director attempts to sole-approve invoice exceeding single-approver limit
- **WHEN** an invoice has an amount of 500,001 or greater and a user with the Director role attempts a sole final approval without a prior distinct approval
- **THEN** the approval as a sole approver is rejected or held pending dual approval, and cannot transition to `Approved` with only one approver

### Requirement: Dual Approval for High-Value Invoices
Invoices with an amount strictly greater than 500,000 SHALL require two distinct approvals before reaching `Approved` status. The first approval MAY be performed by either a Manager or a Director. The second approval MUST be performed by a user with the Director role.

#### Scenario: First approval on high-value invoice by Manager or Director
- **WHEN** an invoice has an amount of 500,001 or greater in `PendingApproval` status with no prior approvals, and a Manager or Director submits an approval
- **THEN** the approval is recorded on the invoice, and the invoice remains in pending state awaiting second approval

#### Scenario: Second approval on high-value invoice by Director
- **WHEN** an invoice has an amount of 500,001 or greater with one existing approval from a different user, and a user with the Director role submits an approval
- **THEN** the second approval is recorded and the invoice status transitions to `Approved`

### Requirement: Prevention of Duplicate Approver on Same Invoice
The system SHALL strictly prohibit the same user from acting as both the first and second approver on the same invoice, identified by unique user ID.

#### Scenario: Same user attempts second approval on high-value invoice
- **WHEN** an invoice with an amount of 500,001 or greater already has an approval recorded by user ID `user-1`, and the same user ID `user-1` attempts the second approval
- **THEN** the second approval is rejected with reason code `SAME_APPROVER`, an informative error message is returned, and the invoice state remains completely unchanged

### Requirement: Enforcement of Director Role for Second Approver
The system SHALL require that the second approver on an invoice exceeding 500,000 has the Director role.

#### Scenario: Non-director user attempts second approval on high-value invoice
- **WHEN** an invoice with an amount of 500,001 or greater already has an initial approval recorded by a distinct user, and a user with the Manager role attempts the second approval
- **THEN** the approval is rejected with reason code `SECOND_APPROVER_NOT_DIRECTOR`, an informative error message is returned, and the invoice state remains completely unchanged

### Requirement: Invoice Immutability on Rejection
The system SHALL guarantee that any rejected approval attempt leaves the target invoice completely unmodified.

#### Scenario: Rejected attempt preserves deep equality of invoice
- **WHEN** any approval validation rule fails (including `LIMIT_EXCEEDED`, `SAME_APPROVER`, `SECOND_APPROVER_NOT_DIRECTOR`, `ROLE_NOT_ALLOWED`, or `INVOICE_NOT_PENDING`)
- **THEN** the system returns a rejection result containing the reason code and error message, and every field of the invoice remains identical to its pre-attempt state

### Requirement: Invoice Status and Eligibility Validation
The system SHALL only allow approval operations on invoices that are in a pending approval state.

#### Scenario: Attempting to approve an invoice that is not pending
- **WHEN** a user attempts to approve an invoice with status `Draft`, `Approved`, or `Rejected`
- **THEN** the approval is rejected with reason code `INVOICE_NOT_PENDING` and the invoice remains unchanged

### Requirement: Boundary Value Thresholds
The system SHALL enforce exact boundary behavior according to the defined thresholds: 49,999 (Manager/Director pass), 50,000 (Manager/Director pass), 50,001 (Manager rejected with `LIMIT_EXCEEDED`, Director pass), 499,999 (Manager rejected, Director pass), 500,000 (Manager rejected, Director pass), and 500,001 (requires two distinct approvers, second being a Director).

#### Scenario: Boundary test matrix execution
- **WHEN** invoices at boundary amounts 49,999, 50,000, 50,001, 499,999, 500,000, and 500,001 are evaluated against approver roles
- **THEN** the outcome precisely matches the boundary threshold authorization rules

### Requirement: Standardized Rejection Reason Codes
The system SHALL emit standardized rejection reason codes across all validation failures: `LIMIT_EXCEEDED` for role ceiling violations, `SAME_APPROVER` for duplicate user approvals, `SECOND_APPROVER_NOT_DIRECTOR` for role violations on high-value dual approvals, `ROLE_NOT_ALLOWED` for unauthorized roles, and `INVOICE_NOT_PENDING` for invalid lifecycle states.

#### Scenario: Rejection reason code reporting
- **WHEN** an approval fails validation under any failure condition
- **THEN** the exact corresponding standardized reason code is returned
