import { describe, it, expect } from 'vitest';
import { Invoice } from '@/domain/invoice';
import {
  MANAGER_APPROVAL_LIMIT,
  DIRECTOR_APPROVAL_LIMIT,
  evaluateApproval,
} from '@/domain/approval-limits';
import { ApprovalService } from '@/domain/approval-service';
import { FakeInvoiceRepository } from '../fakes/fake-invoice-repository';

describe('Phase 4: Step 1 - Single-Approver Role Limits', () => {
  const createInvoice = (amount: number, id = 'INV-TEST'): Invoice => ({
    id,
    customerName: 'Test School',
    amount,
    status: 'PendingApproval',
    createdAt: '2026-01-01T00:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  });

  describe('Boundary Value Thresholds (evaluateApproval pure function)', () => {
    it('Manager approves 49,999 (below limit)', () => {
      const invoice = createInvoice(49_999);
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('mgr-1');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('mgr-1');
        expect(result.invoice.approvals?.[0].role).toBe('Manager');
      }
    });

    it('Director approves 49,999 (below limit)', () => {
      const invoice = createInvoice(49_999);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('dir-1');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
        expect(result.invoice.approvals?.[0].role).toBe('Director');
      }
    });

    it('Manager approves 50,000 (exact inclusive limit)', () => {
      const invoice = createInvoice(50_000);
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('mgr-1');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('mgr-1');
      }
    });

    it('Director approves 50,000 (exact Manager limit)', () => {
      const invoice = createInvoice(50_000);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
      }
    });

    it('Manager rejected for 50,001 (exceeds limit by 1)', () => {
      const invoice = createInvoice(50_001);
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('LIMIT_EXCEEDED');
        expect(result.message).toBe('Invoice amount 50001 exceeds Manager approval limit of 50000.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Director approves 50,001 (within Director limit)', () => {
      const invoice = createInvoice(50_001);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
      }
    });

    it('Manager rejected for 499,999', () => {
      const invoice = createInvoice(499_999);
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('LIMIT_EXCEEDED');
        expect(result.message).toBe('Invoice amount 499999 exceeds Manager approval limit of 50000.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Director approves 499,999', () => {
      const invoice = createInvoice(499_999);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
      }
    });

    it('Manager rejected for 500,000', () => {
      const invoice = createInvoice(500_000);
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('LIMIT_EXCEEDED');
        expect(result.message).toBe('Invoice amount 500000 exceeds Manager approval limit of 50000.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Director approves 500,000 (exact inclusive limit)', () => {
      const invoice = createInvoice(500_000);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('dir-1');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
      }
    });

    it('Director cannot sole-approve 500,001 to Approved status (held for dual approval)', () => {
      const invoice = createInvoice(500_001);
      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('PartiallyApproved');
        expect(result.invoice.status).not.toBe('Approved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('dir-1');
      }
    });

    it('Exports expected constants: MANAGER_APPROVAL_LIMIT is 50,000 and DIRECTOR_APPROVAL_LIMIT is 500,000', () => {
      expect(MANAGER_APPROVAL_LIMIT).toBe(50_000);
      expect(DIRECTOR_APPROVAL_LIMIT).toBe(500_000);
    });

    it('Rejects non-pending invoice with INVOICE_NOT_PENDING and descriptive message', () => {
      const invoice: Invoice = { ...createInvoice(100), status: 'Draft' };
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INVOICE_NOT_PENDING');
        expect(result.message).toBe('Invoice INV-TEST is Draft; only pending invoices can be approved.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Rejects single approval when user has unauthorized role', () => {
      const invoice = createInvoice(25_000);
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const result = evaluateApproval(invoice, { id: 'viewer-1', role: 'Viewer' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('ROLE_NOT_ALLOWED');
        expect(result.message).toBe('Role Viewer is not permitted to approve invoices.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Allows Admin to approve invoice <= 500,000', () => {
      const invoice = createInvoice(100_000);
      const result = evaluateApproval(invoice, { id: 'admin-1', role: 'Admin' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals?.[0].role).toBe('Admin');
      }
    });

    it('Uses stable approver ID when username is omitted and defaults the role', () => {
      const invoice = createInvoice(10_000);
      const result = evaluateApproval(invoice, { id: 'user-1' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('user-1');
        expect(result.invoice.approvals?.[0].userId).toBe('user-1');
        expect(result.invoice.approvals?.[0].role).toBe('Approver');
      }
    });
  });

  describe('Deep Equality & Immutability when Validation Fails', () => {
    it('Preserves deep equality of invoice on Manager limit rejection', () => {
      const invoice = createInvoice(75_000);
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

      const result = evaluateApproval(invoice, { id: 'mgr-1', role: 'Manager' });

      expect(result.ok).toBe(false);
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('Preserves deep equality of invoice on duplicate Director approval rejection', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          { userId: 'dir-1', role: 'Director', timestamp: '2026-01-01T00:00:00.000Z' },
        ],
      };
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

      const result = evaluateApproval(invoice, { id: 'dir-1', role: 'Director' });

      expect(result.ok).toBe(false);
      expect(invoice).toEqual(invoiceSnapshot);
    });
  });

  describe('ApprovalService Integration', () => {
    it('throws ApprovalRejectedError with reason LIMIT_EXCEEDED when Manager approves over 50,000', async () => {
      const invoice = createInvoice(75_000, 'INV-1002');
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));
      const repo = new FakeInvoiceRepository(invoice);
      const service = new ApprovalService(repo);

      await expect(
        service.approve('INV-1002', { id: 'usr-manager', username: 'demo.manager', role: 'Manager' })
      ).rejects.toMatchObject({ reason: 'LIMIT_EXCEEDED' });

      // Repository invoice must remain completely unchanged
      const stored = await repo.getById('INV-1002');
      expect(stored).toEqual(invoiceSnapshot);
    });

    it('successfully approves when Manager approves invoice <= 50,000', async () => {
      const invoice = createInvoice(40_000, 'INV-1001');
      const repo = new FakeInvoiceRepository(invoice);
      const service = new ApprovalService(repo);

      const approved = await service.approve('INV-1001', {
        id: 'usr-manager', username: 'demo.manager', role: 'Manager',
      });
      expect(approved.status).toBe('Approved');
      expect(approved.decidedBy).toBe('demo.manager');

      const stored = await repo.getById('INV-1001');
      expect(stored?.status).toBe('Approved');
    });

    it('successfully approves when Director approves invoice <= 500,000', async () => {
      const invoice = createInvoice(75_000, 'INV-1002');
      const repo = new FakeInvoiceRepository(invoice);
      const service = new ApprovalService(repo);

      const approved = await service.approve('INV-1002', {
        id: 'usr-director', username: 'demo.director', role: 'Director',
      });
      expect(approved.status).toBe('Approved');
      expect(approved.decidedBy).toBe('demo.director');

      const stored = await repo.getById('INV-1002');
      expect(stored?.status).toBe('Approved');
    });

    it('throws ApprovalRejectedError with reason SAME_APPROVER when Director approves > 500,000 twice', async () => {
      const invoice = createInvoice(600_000, 'INV-1003');
      const repo = new FakeInvoiceRepository(invoice);
      const service = new ApprovalService(repo);

      await service.approve('INV-1003', {
        id: 'usr-director', username: 'demo.director', role: 'Director',
      });
      const partialStored = await repo.getById('INV-1003');
      const partialSnapshot = JSON.parse(JSON.stringify(partialStored));

      await expect(
        service.approve('INV-1003', {
          id: 'usr-director', username: 'demo.director', role: 'Director',
        })
      ).rejects.toMatchObject({ reason: 'SAME_APPROVER' });

      // Repository invoice must remain completely unchanged
      const stored = await repo.getById('INV-1003');
      expect(stored).toEqual(partialSnapshot);
    });
  });
});
