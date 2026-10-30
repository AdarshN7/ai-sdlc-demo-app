import { Invoice, InvoiceApproval, Role } from './invoice';

export const MANAGER_APPROVAL_LIMIT = 50_000;
export const DIRECTOR_APPROVAL_LIMIT = 500_000;

const HIGH_VALUE_FIRST_APPROVER_ROLES: readonly string[] = ['Manager', 'Director'];
const HIGH_VALUE_SECOND_APPROVER_ROLE = 'Director';

export type ApprovalRejectionReason =
  | 'LIMIT_EXCEEDED'
  | 'SAME_APPROVER'
  | 'SECOND_APPROVER_NOT_DIRECTOR'
  | 'ROLE_NOT_ALLOWED'
  | 'INVOICE_NOT_PENDING';

export interface ApproverIdentity {
  id: string;
  username?: string;
  role?: string;
}

export type ApprovalResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: ApprovalRejectionReason; message: string };

/**
 * Pure evaluation function enforcing role-based approval limits and high-value two-approver rules.
 * Validates preconditions without modifying the input invoice.
 */
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
  const approverId = approver.id;
  const approverName = approver.username || approver.id || 'unknown';
  const now = new Date().toISOString();

  const newApproval: InvoiceApproval = {
    userId: approverId,
    role: role as Role,
    timestamp: now,
    approvedAt: now,
  };

  const priorApprovals = invoice.approvals ?? [];

  // High-value dual-approval rule (> 500,000)
  if (invoice.amount > DIRECTOR_APPROVAL_LIMIT) {
    if (priorApprovals.length === 0) {
      // A Manager's high-value approval is partial, not sole approval.
      if (!HIGH_VALUE_FIRST_APPROVER_ROLES.includes(role)) {
        return {
          ok: false,
          reason: 'ROLE_NOT_ALLOWED',
          message: `Role ${role} is not permitted to approve invoices.`,
        };
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'PartiallyApproved',
        approvals: [newApproval],
      };

      return {
        ok: true,
        invoice: updatedInvoice,
      };
    } else {
      // Second approval
      // Negative rule 1: Same user approving twice rejected with SAME_APPROVER
      // Compare unique userId (user.id === priorApproval.userId)
      const isSameApprover = priorApprovals.some((a) => a.userId === approverId);
      if (isSameApprover) {
        return {
          ok: false,
          reason: 'SAME_APPROVER',
          message: 'The same user cannot approve an invoice twice.',
        };
      }

      // Negative rule 2: Second approver must be a Director.
      if (role !== HIGH_VALUE_SECOND_APPROVER_ROLE) {
        return {
          ok: false,
          reason: 'SECOND_APPROVER_NOT_DIRECTOR',
          message: 'Second approval requires a Director.',
        };
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'Approved',
        decidedBy: approverName,
        decidedAt: now,
        approvals: [...priorApprovals, newApproval],
      };

      return {
        ok: true,
        invoice: updatedInvoice,
      };
    }
  }

  // Single-approver rules (amount <= 500,000)
  if (role === 'Manager' || role === 'Approver') {
    if (invoice.amount > MANAGER_APPROVAL_LIMIT) {
      return {
        ok: false,
        reason: 'LIMIT_EXCEEDED',
        message: `Invoice amount ${invoice.amount} exceeds Manager approval limit of ${MANAGER_APPROVAL_LIMIT}.`,
      };
    }
  } else if (role === 'Director' || role === 'Admin') {
    // Within Director limit (<= 500,000)
  } else {
    return {
      ok: false,
      reason: 'ROLE_NOT_ALLOWED',
      message: `Role ${role} is not permitted to approve invoices.`,
    };
  }

  // Pure transformation - return new invoice object, never mutating the original
  const updatedInvoice: Invoice = {
    ...invoice,
    status: 'Approved',
    decidedBy: approverName,
    decidedAt: now,
    approvals: [...priorApprovals, newApproval],
  };

  return {
    ok: true,
    invoice: updatedInvoice,
  };
}
