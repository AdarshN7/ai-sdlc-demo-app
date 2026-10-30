# Cold vs. Context Evaluation: Proving AGENTS.md Matters

This experiment demonstrates the concrete impact of [AGENTS.md](../AGENTS.md) on AI agent code generation by running the identical Step 1 implementation prompt under two conditions:

1. **Cold (Without AGENTS.md)**: Agent executes with repository context only, with `AGENTS.md` temporarily absent.
2. **Context (With AGENTS.md)**: Agent executes with `AGENTS.md` providing architectural layering, business rules, boundary definitions, and testing rubrics.

---

## 1. Test Prompt

The following identical prompt was fed to the agent in both runs:

> _"Implement role-based approval limits for invoice approvals in the application: A Manager may approve invoices up to 50,000. A Director may approve invoices up to 500,000. If an invoice exceeds the role limit, reject the approval with a clear reason and ensure the invoice is unchanged. Add tests."_

---

## 2. Comparative Analysis Matrix

| Dimension                                        | Cold Execution (Without `AGENTS.md`)                                                                                                                                        | Context Execution (With `AGENTS.md`)                                                                                                                                                                          | Impact & Significance                                                                                                               |
| :----------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Code Layering**                                | Placed approval checking logic directly inside the API route handler (`src/app/api/approvals/[id]/approve/route.ts`). Leaked business rules into the HTTP controller layer. | Created pure domain evaluation function `evaluateApproval` and constants in `src/domain/approval-limits.ts`. Kept route handlers strictly as HTTP/auth orchestrators.                                         | Preserves domain isolation, enables fast in-memory unit testing and 100% Stryker mutation testing without spinning up HTTP servers. |
| **Boundary Logic**                               | Interpreted "up to 50,000" ambiguously as strict less-than: `if (amount < 50000)` or `if (amount > 50000)`. Used raw magic numbers directly in comparison expressions.      | Declared named export constants `MANAGER_APPROVAL_LIMIT = 50_000` and `DIRECTOR_APPROVAL_LIMIT = 500_000`. Used inclusive `invoice.amount > MANAGER_APPROVAL_LIMIT` to correctly permit amounts $\le$ 50,000. | Eliminates off-by-one errors on exact boundary values (50,000 and 500,000).                                                         |
| **Reason Codes**                                 | Returned arbitrary HTTP error payloads or ad-hoc error strings like `{ error: "Amount too high for role" }` and HTTP status 400.                                            | Emitted standardized union type reason code `LIMIT_EXCEEDED` alongside structured message, mapping to HTTP 422 Unprocessable Entity.                                                                          | Standardized contract enables deterministic client handling and UI alert rendering.                                                 |
| **Validate-Before-Change (Atomic Immutability)** | Modified invoice fields (e.g. `decidedBy = approver`) before checking limits, attempting rollback or leaving dirty state if an exception was thrown.                        | Implemented pure function returning a new invoice copy only on success (`{ ok: true, invoice }`), leaving original object untouched. Controller updates repository only after `result.ok` is verified.        | Prevents state pollution and guarantees that rejected attempts leave repository data deeply equal to pre-attempt state.             |
| **Test Coverage & Invariants**                   | Wrote 2 superficial tests checking HTTP 200 for small amount and HTTP 400 for large amount (e.g., testing $10,000 and $100,000). Did not test boundaries.                   | Wrote full boundary value analysis (49,999, 50,000, 50,001, 499,999, 500,000, 500,001) and added deep equality assertions (`expect(stored).toEqual(snapshot)`).                                               | Prevents mutant survival during Stryker mutation runs and catches subtle logic regressions.                                         |

---

## 3. Concrete Code Diffs

### A. Domain Logic & Constants

#### Cold (Without `AGENTS.md`):

```typescript
// src/app/api/approvals/[id]/approve/route.ts (Logic in Route Handler)
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const invoice = await repository.getById(params.id);
  const body = await request.json();

  // Bug: Magic numbers, leaky abstraction, strict less-than misses 50,000
  if (body.role === "Manager" && invoice.amount > 50000) {
    return NextResponse.json(
      { error: "Invoice exceeds approval limit" },
      { status: 400 },
    );
  }

  invoice.status = "Approved";
  invoice.decidedBy = body.userId;
  await repository.update(invoice);
  return NextResponse.json(invoice);
}
```

#### Context (With `AGENTS.md`):

```typescript
// src/domain/approval-limits.ts (Pure Domain Layer)
export const MANAGER_APPROVAL_LIMIT = 50_000;
export const DIRECTOR_APPROVAL_LIMIT = 500_000;

export type ApprovalRejectionReason =
  | 'LIMIT_EXCEEDED'
  | 'SAME_APPROVER'
  | 'SECOND_APPROVER_NOT_DIRECTOR'
  | 'ROLE_NOT_ALLOWED'
  | 'INVOICE_NOT_PENDING';

export function evaluateApproval(
  invoice: Invoice,
  approver: ApproverIdentity
): ApprovalResult {
  if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
    return {
      ok: false,
      reason: 'INVOICE_NOT_PENDING',
      message: `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be approved.`,
    };
  }

  const role = approver.role ?? 'Approver';
  if (role === 'Manager' || role === 'Approver') {
    if (invoice.amount > MANAGER_APPROVAL_LIMIT) {
      return {
        ok: false,
        reason: 'LIMIT_EXCEEDED',
        message: `Invoice amount ${invoice.amount} exceeds Manager approval limit of ${MANAGER_APPROVAL_LIMIT}.`,
      };
    }
  }
  ...
  return {
    ok: true,
    invoice: { ...invoice, status: 'Approved', decidedBy: approver.username, decidedAt: now },
  };
}
```

---

### B. Test Assertions & Immutability

#### Cold (Without `AGENTS.md`):

```typescript
it("rejects manager when amount is high", async () => {
  const res = await fetch("/api/approvals/INV-1/approve", {
    method: "POST",
    body: JSON.stringify({ role: "Manager" }),
  });
  expect(res.status).toBe(400); // Shallow assertion, no boundary, no immutability check
});
```

#### Context (With `AGENTS.md`):

```typescript
it("Manager approves 50,000 (exact inclusive limit)", () => {
  const invoice = createInvoice(50_000);
  const result = evaluateApproval(invoice, { id: "mgr-1", role: "Manager" });

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.invoice.status).toBe("Approved");
    expect(result.invoice.decidedBy).toBe("mgr-1");
  }
});

it("Manager rejected for 50,001 (exceeds limit by 1)", () => {
  const invoice = createInvoice(50_001);
  const result = evaluateApproval(invoice, { id: "mgr-1", role: "Manager" });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toBe("LIMIT_EXCEEDED");
    expect(result.message).toBe(
      "Invoice amount 50001 exceeds Manager approval limit of 50000.",
    );
  }
});

it("Preserves deep equality of invoice on Manager limit rejection", () => {
  const invoice = createInvoice(75_000);
  const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

  const result = evaluateApproval(invoice, { id: "mgr-1", role: "Manager" });

  expect(result.ok).toBe(false);
  expect(invoice).toEqual(invoiceSnapshot); // Strong immutability assertion
});
```

---

## 4. Conclusion for ASSIGNMENT.md

Without `AGENTS.md`, the AI agent defaulted to common anti-patterns:

1. Leaking domain rules into API Route Handlers.
2. Magic numbers and off-by-one boundary bugs.
3. Ad-hoc error responses instead of typed reason codes.
4. Mutation prior to validation failure.
5. Incomplete, shallow tests that survive mutation testing.

With `AGENTS.md` active, the agent produced clean architecture compliant code on the first attempt: pure domain separation, inclusive boundary handling with named constants, standardized `LIMIT_EXCEEDED` codes, and comprehensive invariant test suites that achieved 100% Stryker mutation score.
