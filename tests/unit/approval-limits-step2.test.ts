import { describe, it, expect } from 'vitest';
import { Invoice } from '@/domain/invoice';
import { evaluateApproval } from '@/domain/approval-limits';
import { ApprovalService } from '@/domain/approval-service';
import { ApprovalRejectedError } from '@/domain/errors';
import { FakeInvoiceRepository } from '../fakes/fake-invoice-repository';

describe('Phase 5: Step 2 – Two-Approver Rule (> 500,000)', () => {
  const createInvoice = (amount: number, id = 'INV-TEST-STEP2'): Invoice => ({
    id,
    customerName: 'High Value Enterprise',
    amount,
    status: 'PendingApproval',
    createdAt: '2026-01-01T00:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    approvals: [],
  });

  describe('First Approval on High-Value Invoices (> 500,000)', () => {
    it('1st approval by Manager leaves invoice partially approved awaiting second approver', () => {
      const invoice = createInvoice(500_001);
      const result = evaluateApproval(invoice, {
        id: 'user-mgr-1',
        username: 'demo.manager',
        role: 'Manager',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('PartiallyApproved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('user-mgr-1');
        expect(result.invoice.approvals?.[0].role).toBe('Manager');
        expect(result.invoice.approvals?.[0].timestamp).toBeDefined();
      }
    });

    it('1st approval by Director leaves invoice partially approved awaiting second approver', () => {
      const invoice = createInvoice(750_000);
      const result = evaluateApproval(invoice, {
        id: 'user-dir-1',
        username: 'demo.director1',
        role: 'Director',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('PartiallyApproved');
        expect(result.invoice.approvals).toHaveLength(1);
        expect(result.invoice.approvals?.[0].userId).toBe('user-dir-1');
        expect(result.invoice.approvals?.[0].role).toBe('Director');
        expect(result.invoice.approvals?.[0].timestamp).toBeDefined();
      }
    });

    it('1st approval by unauthorized role is rejected with ROLE_NOT_ALLOWED', () => {
      const invoice = createInvoice(600_000);
      const result = evaluateApproval(invoice, {
        id: 'user-app-1',
        role: 'Approver',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('ROLE_NOT_ALLOWED');
        expect(result.message).toBe('Role Approver is not permitted to approve invoices.');
      }
    });

    it('1st approval by Admin leaves invoice partially approved', () => {
      const invoice = createInvoice(600_000);
      const result = evaluateApproval(invoice, {
        id: 'admin-1',
        role: 'Admin',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('PartiallyApproved');
        expect(result.invoice.approvals?.[0].role).toBe('Admin');
      }
    });
  });

  describe('Second Approval by Distinct Director', () => {
    it('2nd approval by distinct Director marks it Approved', () => {
      const invoice: Invoice = {
        ...createInvoice(500_001),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-dir-1',
            role: 'Director',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };

      const result = evaluateApproval(invoice, {
        id: 'user-dir-2',
        username: 'demo.director2',
        role: 'Director',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.decidedBy).toBe('demo.director2');
        expect(result.invoice.decidedAt).toBeDefined();
        expect(result.invoice.approvals).toHaveLength(2);
        expect(result.invoice.approvals?.[0].userId).toBe('user-dir-1');
        expect(result.invoice.approvals?.[1].userId).toBe('user-dir-2');
        expect(result.invoice.approvals?.[1].role).toBe('Director');
      }
    });

    it('2nd approval completes approval when 1st approver was a Manager', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-mgr-1',
            role: 'Manager',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };

      const result = evaluateApproval(invoice, {
        id: 'user-dir-1',
        username: 'demo.director',
        role: 'Director',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals).toHaveLength(2);
      }
    });

    it('2nd approval by distinct Admin completes approval to Approved', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-mgr-1',
            role: 'Manager',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };

      const result = evaluateApproval(invoice, {
        id: 'admin-1',
        role: 'Admin',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.invoice.status).toBe('Approved');
        expect(result.invoice.approvals?.[1].role).toBe('Admin');
      }
    });
  });

  describe('Negative Rule 1: Duplicate Approver (SAME_APPROVER)', () => {
    it('rejects with SAME_APPROVER when the same user attempts second approval', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-dir-1',
            role: 'Director',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

      const result = evaluateApproval(invoice, {
        id: 'user-dir-1',
        username: 'demo.director1',
        role: 'Director',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SAME_APPROVER');
        expect(result.message).toBe('The same user cannot approve an invoice twice.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });

    it('validates distinctness using userId, not display name or role', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-123',
            role: 'Director',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };

      // Even if display name/username looks different or role is Director, matching user ID is rejected
      const sameUserResult = evaluateApproval(invoice, {
        id: 'user-123',
        username: 'alias.director',
        role: 'Director',
      });

      expect(sameUserResult.ok).toBe(false);
      if (!sameUserResult.ok) {
        expect(sameUserResult.reason).toBe('SAME_APPROVER');
      }
    });

    it('rejects with SAME_APPROVER when prior approvals list has multiple entries and first approver re-approves', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-first',
            role: 'Manager',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
          {
            userId: 'user-second',
            role: 'Director',
            timestamp: '2026-01-01T11:00:00.000Z',
          },
        ],
      };

      const result = evaluateApproval(invoice, {
        id: 'user-first',
        role: 'Director',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SAME_APPROVER');
      }
    });

    it('rejects with SAME_APPROVER when user is identified by username fallback', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'demo.director',
            role: 'Director',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };

      const result = evaluateApproval(invoice, {
        username: 'demo.director',
        role: 'Director',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SAME_APPROVER');
      }
    });
  });

  describe('Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR)', () => {
    it('rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager', () => {
      const invoice: Invoice = {
        ...createInvoice(600_000),
        status: 'PartiallyApproved',
        approvals: [
          {
            userId: 'user-mgr-1',
            role: 'Manager',
            timestamp: '2026-01-01T10:00:00.000Z',
          },
        ],
      };
      const invoiceSnapshot = JSON.parse(JSON.stringify(invoice));

      const result = evaluateApproval(invoice, {
        id: 'user-mgr-2',
        username: 'demo.manager2',
        role: 'Manager',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SECOND_APPROVER_NOT_DIRECTOR');
        expect(result.message).toBe('Second approval requires a Director.');
      }
      expect(invoice).toEqual(invoiceSnapshot);
    });
  });

  describe('ApprovalService Integration for High-Value Invoices', () => {
    it('executes the full dual-approval workflow via ApprovalService', async () => {
      const invoice = createInvoice(750_000, 'INV-HIGH-VAL');
      const repo = new FakeInvoiceRepository(invoice);
      const service = new ApprovalService(repo);

      // 1st approval by Manager
      const step1Invoice = await service.approve(
        'INV-HIGH-VAL',
        { id: 'user-mgr-1', username: 'demo.manager', role: 'Manager' }
      );
      expect(step1Invoice.status).toBe('PartiallyApproved');
      expect(step1Invoice.approvals).toHaveLength(1);

      // Duplicate approval attempt by the same Manager
      await expect(
        service.approve('INV-HIGH-VAL', {
          id: 'user-mgr-1',
          username: 'demo.manager',
          role: 'Manager',
        })
      ).rejects.toThrow(ApprovalRejectedError);

      try {
        await service.approve('INV-HIGH-VAL', {
          id: 'user-mgr-1',
          username: 'demo.manager',
          role: 'Manager',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApprovalRejectedError);
        expect((err as ApprovalRejectedError).reason).toBe('SAME_APPROVER');
      }

      // Second approval attempt by another Manager (fails with SECOND_APPROVER_NOT_DIRECTOR)
      await expect(
        service.approve('INV-HIGH-VAL', {
          id: 'user-mgr-2',
          username: 'demo.manager2',
          role: 'Manager',
        })
      ).rejects.toThrow(ApprovalRejectedError);

      try {
        await service.approve('INV-HIGH-VAL', {
          id: 'user-mgr-2',
          username: 'demo.manager2',
          role: 'Manager',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApprovalRejectedError);
        expect((err as ApprovalRejectedError).reason).toBe(
          'SECOND_APPROVER_NOT_DIRECTOR'
        );
      }

      // Valid 2nd approval by distinct Director
      const step2Invoice = await service.approve(
        'INV-HIGH-VAL',
        { id: 'user-dir-1', username: 'demo.director', role: 'Director' }
      );
      expect(step2Invoice.status).toBe('Approved');
      expect(step2Invoice.decidedBy).toBe('demo.director');
      expect(step2Invoice.approvals).toHaveLength(2);

      // Verified in repository
      const finalStored = await repo.getById('INV-HIGH-VAL');
      expect(finalStored?.status).toBe('Approved');
      expect(finalStored?.approvals).toHaveLength(2);
    });
  });
});
