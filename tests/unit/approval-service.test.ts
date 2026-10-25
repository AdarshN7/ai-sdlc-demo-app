import { describe, it, expect } from 'vitest';
import { ApprovalService } from '@/domain/approval-service';
import { Invoice, InvoiceStatus } from '@/domain/invoice';
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors';
import { FakeInvoiceRepository } from '../fakes/fake-invoice-repository';

describe('ApprovalService', () => {
  const invoiceWith = (id: string, status: InvoiceStatus): Invoice => ({
    id,
    customerName: 'Test School',
    amount: 100,
    status,
    createdAt: new Date().toISOString(),
  });

  const serviceFor = (...invoices: Invoice[]) =>
    new ApprovalService(new FakeInvoiceRepository(...invoices));

  it('Submit_MovesDraftToPendingApproval', async () => {
    const invoice = invoiceWith('INV-1', 'Draft');
    const result = await serviceFor(invoice).submit('INV-1');

    expect(result.status).toBe('PendingApproval');
  });

  it('Submit_RejectsInvoiceThatIsNotADraft', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'Approved'));

    await expect(service.submit('INV-1')).rejects.toThrow(ConflictError);
  });

  it('Approve_SetsStatusApproverAndTimestamp', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', 'demo.approver');

    expect(result.status).toBe('Approved');
    expect(result.decidedBy).toBe('demo.approver');
    expect(result.decidedAt).toBeDefined();
  });

  it('Approve_RejectsInvoiceThatIsStillADraft', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'Draft'));

    await expect(service.approve('INV-1', 'demo.approver')).rejects.toThrow(ConflictError);
  });

  it('Approve_ThrowsWhenInvoiceDoesNotExist', async () => {
    const service = serviceFor();

    await expect(service.approve('INV-404', 'demo.approver')).rejects.toThrow(
      'Invoice INV-404 was not found.'
    );
  });

  it('Reject_ThrowsWhenInvoiceDoesNotExist', async () => {
    const service = serviceFor();

    await expect(
      service.reject('INV-404', 'demo.approver', 'Reason')
    ).rejects.toThrow('Invoice INV-404 was not found.');
  });

  it('Reject_RejectsInvoiceThatIsStillADraft', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'Draft'));

    await expect(
      service.reject('INV-1', 'demo.approver', 'Invalid draft')
    ).rejects.toThrow('Invoice INV-1 is Draft; only pending invoices can be decided.');
  });

  it('Reject_RejectsInvoiceThatIsAlreadyApproved', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'Approved'));

    await expect(
      service.reject('INV-1', 'demo.approver', 'Cannot re-decide')
    ).rejects.toThrow('Invoice INV-1 is Approved; only pending invoices can be decided.');
  });

  it('Reject_AllowsRejectingPartiallyApprovedInvoice', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PartiallyApproved'));
    const result = await service.reject('INV-1', 'demo.approver', 'Cancel high-value order');

    expect(result.status).toBe('Rejected');
    expect(result.decisionNote).toBe('Cancel high-value order');
    expect(result.decidedBy).toBe('demo.approver');
  });

  it('Reject_RecordsReasonAndApprover', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.reject('INV-1', 'demo.approver', 'Duplicate invoice');

    expect(result.status).toBe('Rejected');
    expect(result.decisionNote).toBe('Duplicate invoice');
    expect(result.decidedBy).toBe('demo.approver');
    expect(result.decidedAt).toBeDefined();
  });

  it('Reject_RequiresAReason', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));

    await expect(service.reject('INV-1', 'demo.approver', '  ')).rejects.toThrow(ValidationError);
  });

  it('Approve_SupportsApproverIdentityObjectWithExplicitId', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { id: 'user-id-only', role: 'Manager' });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].userId).toBe('user-id-only');
  });

  it('Approve_SupportsApproverIdentityObjectWithExplicitUsernameOnly', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { username: 'uname-only', role: 'Manager' });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].userId).toBe('uname-only');
  });

  it('Approve_SupportsApproverWithBothIdAndUsernamePreservingIdAsUserId', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', {
      id: 'dir-id-1',
      username: 'dir-uname-1',
      role: 'Director',
    });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].userId).toBe('dir-id-1');
    expect(result.decidedBy).toBe('dir-uname-1');
  });

  it('Approve_DefaultsRoleToApproverWhenNoneProvided', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { id: 'user-no-role' });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].role).toBe('Approver');
  });

  it('Approve_DefaultsUsernameToUnknownWhenNeitherUsernameNorIdProvided', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { role: 'Manager' });

    expect(result.status).toBe('Approved');
    expect(result.decidedBy).toBe('unknown');
    expect(result.approvals?.[0].userId).toBe('unknown');
  });
});
