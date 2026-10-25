import { Invoice } from './invoice';

export const MANAGER_APPROVAL_LIMIT = 50_000;
export const DIRECTOR_APPROVAL_LIMIT = 500_000;

export type ApprovalRejectionReason =
  | 'LIMIT_EXCEEDED'
  | 'SAME_APPROVER'
  | 'SECOND_APPROVER_NOT_DIRECTOR'
  | 'ROLE_NOT_ALLOWED'
  | 'INVOICE_NOT_PENDING';

export interface ApproverIdentity {
  id?: string;
  username?: string;
  role: string;
}

export type ApprovalResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: ApprovalRejectionReason; message: string };

/**
 * Pure evaluation function enforcing role-based approval limits.
 * Validates preconditions without modifying the input invoice.
 */
export function evaluateApproval(
  invoice: Invoice,
  approver: ApproverIdentity
): ApprovalResult {
  if (invoice.status !== 'PendingApproval') {
    return {
      ok: false,
      reason: 'INVOICE_NOT_PENDING',
      message: `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be approved.`,
    };
  }

  const role = approver.role;
  const approverName = approver.username || approver.id || 'unknown';

  if (role === 'Manager' || role === 'Approver') {
    if (invoice.amount > MANAGER_APPROVAL_LIMIT) {
      return {
        ok: false,
        reason: 'LIMIT_EXCEEDED',
        message: `Invoice amount ${invoice.amount} exceeds Manager approval limit of ${MANAGER_APPROVAL_LIMIT}.`,
      };
    }
  } else if (role === 'Director' || role === 'Admin') {
    if (invoice.amount > DIRECTOR_APPROVAL_LIMIT) {
      return {
        ok: false,
        reason: 'LIMIT_EXCEEDED',
        message: `Invoice amount ${invoice.amount} exceeds Director single-approver limit of ${DIRECTOR_APPROVAL_LIMIT}.`,
      };
    }
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
    decidedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    invoice: updatedInvoice,
  };
}
