import { Invoice } from './invoice';
import { IInvoiceRepository } from './invoice-repository.interface';
import {
  ApprovalRejectedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from './errors';
import { ApproverIdentity, evaluateApproval } from './approval-limits';

/**
 * Moves invoices through draft, pending, partial approval, approval, and rejection states.
 * High-value invoices require distinct approvals before final approval.
 */
export class ApprovalService {
  constructor(private readonly repository: IInvoiceRepository) {}

  async submit(invoiceId: string): Promise<Invoice> {
    const invoice = await this.find(invoiceId);

    if (invoice.status !== 'Draft') {
      throw new ConflictError(
        `Invoice ${invoiceId} is ${invoice.status}; only drafts can be submitted.`
      );
    }

    invoice.status = 'PendingApproval';
    await this.repository.update(invoice);
    return invoice;
  }

  async approve(
    invoiceId: string,
    approver: ApproverIdentity
  ): Promise<Invoice> {
    const invoice = await this.find(invoiceId);

    const identity: ApproverIdentity = {
      ...approver,
      username: approver.username || approver.id,
      role: approver.role ?? 'Approver',
    };

    const result = evaluateApproval(invoice, identity);
    if (!result.ok) {
      if (result.reason === 'INVOICE_NOT_PENDING') {
        throw new ConflictError(result.message);
      }
      throw new ApprovalRejectedError(result.reason, result.message);
    }

    await this.repository.update(result.invoice);
    return result.invoice;
  }


  async reject(invoiceId: string, approver: string, reason: string): Promise<Invoice> {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('A reason is required to reject an invoice.');
    }

    const invoice = await this.find(invoiceId);
    this.ensurePending(invoice);

    invoice.status = 'Rejected';
    invoice.decidedBy = approver;
    invoice.decidedAt = new Date().toISOString();
    invoice.decisionNote = reason;
    await this.repository.update(invoice);
    return invoice;
  }

  private async find(invoiceId: string): Promise<Invoice> {
    const invoice = await this.repository.getById(invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice ${invoiceId} was not found.`);
    }
    return invoice;
  }

  private ensurePending(invoice: Invoice): void {
    if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
      throw new ConflictError(
        `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be decided.`
      );
    }
  }
}
