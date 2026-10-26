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

  const repositoryFor = (...invoices: Invoice[]) =>
    new FakeInvoiceRepository(...invoices);

  const serviceFor = (...invoices: Invoice[]) =>
    new ApprovalService(repositoryFor(...invoices));

  it('Submit_MovesDraftToPendingApproval', async () => {
    const invoice = invoiceWith('INV-1', 'Draft');
    const result = await serviceFor(invoice).submit('INV-1');

    expect(result.status).toBe('PendingApproval');
  });

  it('Submit_RejectsInvoiceThatIsNotADraft', async () => {
    const invoice = invoiceWith('INV-1', 'Approved');
    const repo = repositoryFor(invoice);
    const snapshot = JSON.parse(JSON.stringify(await repo.getById('INV-1')));
    const service = new ApprovalService(repo);

    await expect(service.submit('INV-1')).rejects.toThrow(ConflictError);
    expect(await repo.getById('INV-1')).toEqual(snapshot);
  });

  it('Approve_SetsStatusApproverAndTimestamp', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', {
      id: 'usr-approver',
      username: 'demo.approver',
    });

    expect(result.status).toBe('Approved');
    expect(result.decidedBy).toBe('demo.approver');
    expect(result.decidedAt).toBeDefined();
  });

  it('Approve_RejectsInvoiceThatIsStillADraft', async () => {
    const invoice = invoiceWith('INV-1', 'Draft');
    const repo = repositoryFor(invoice);
    const snapshot = JSON.parse(JSON.stringify(await repo.getById('INV-1')));
    const service = new ApprovalService(repo);

    await expect(
      service.approve('INV-1', { id: 'usr-approver', username: 'demo.approver' })
    ).rejects.toThrow(ConflictError);
    expect(await repo.getById('INV-1')).toEqual(snapshot);
  });

  it('Approve_ThrowsWhenInvoiceDoesNotExist', async () => {
    const repo = repositoryFor();
    const service = new ApprovalService(repo);

    await expect(
      service.approve('INV-404', { id: 'usr-approver', username: 'demo.approver' })
    ).rejects.toThrow(
      'Invoice INV-404 was not found.'
    );
    expect(await repo.getAll()).toEqual([]);
  });

  it('Reject_ThrowsWhenInvoiceDoesNotExist', async () => {
    const repo = repositoryFor();
    const service = new ApprovalService(repo);

    await expect(
      service.reject('INV-404', 'demo.approver', 'Reason')
    ).rejects.toThrow('Invoice INV-404 was not found.');
    expect(await repo.getAll()).toEqual([]);
  });

  it('Reject_RejectsInvoiceThatIsStillADraft', async () => {
    const invoice = invoiceWith('INV-1', 'Draft');
    const repo = repositoryFor(invoice);
    const snapshot = JSON.parse(JSON.stringify(await repo.getById('INV-1')));
    const service = new ApprovalService(repo);

    await expect(
      service.reject('INV-1', 'demo.approver', 'Invalid draft')
    ).rejects.toThrow('Invoice INV-1 is Draft; only pending invoices can be decided.');
    expect(await repo.getById('INV-1')).toEqual(snapshot);
  });

  it('Reject_RejectsInvoiceThatIsAlreadyApproved', async () => {
    const invoice = invoiceWith('INV-1', 'Approved');
    const repo = repositoryFor(invoice);
    const snapshot = JSON.parse(JSON.stringify(await repo.getById('INV-1')));
    const service = new ApprovalService(repo);

    await expect(
      service.reject('INV-1', 'demo.approver', 'Cannot re-decide')
    ).rejects.toThrow('Invoice INV-1 is Approved; only pending invoices can be decided.');
    expect(await repo.getById('INV-1')).toEqual(snapshot);
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
    const invoice = invoiceWith('INV-1', 'PendingApproval');
    const repo = repositoryFor(invoice);
    const snapshot = JSON.parse(JSON.stringify(await repo.getById('INV-1')));
    const service = new ApprovalService(repo);

    await expect(service.reject('INV-1', 'demo.approver', '  ')).rejects.toThrow(ValidationError);
    expect(await repo.getById('INV-1')).toEqual(snapshot);
  });

  it('Approve_SupportsApproverIdentityObjectWithExplicitId', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { id: 'user-id-only', role: 'Manager' });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].userId).toBe('user-id-only');
  });

  it('Approve_UsesStableIdWhenUsernameIsAlsoPresent', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', {
      id: 'stable-user-id',
      username: 'uname-only',
      role: 'Manager',
    });

    expect(result.status).toBe('Approved');
    expect(result.approvals?.[0].userId).toBe('stable-user-id');
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

  it('Approve_UsesStableIdAsDisplayNameWhenUsernameIsMissing', async () => {
    const service = serviceFor(invoiceWith('INV-1', 'PendingApproval'));
    const result = await service.approve('INV-1', { id: 'stable-user-id', role: 'Manager' });

    expect(result.status).toBe('Approved');
    expect(result.decidedBy).toBe('stable-user-id');
    expect(result.approvals?.[0].userId).toBe('stable-user-id');
  });
});
