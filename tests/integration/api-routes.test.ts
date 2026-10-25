import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as getInvoicesRoute, POST as createInvoiceRoute } from '@/app/api/invoices/route';
import { GET as getInvoiceByIdRoute, DELETE as deleteInvoiceRoute } from '@/app/api/invoices/[id]/route';
import { POST as submitInvoiceRoute } from '@/app/api/invoices/[id]/submit/route';
import { POST as approveRoute } from '@/app/api/approvals/[id]/approve/route';
import { POST as rejectRoute } from '@/app/api/approvals/[id]/reject/route';
import { POST as resetRoute } from '@/app/api/test/reset/route';
import { getSessionStore } from '@/infrastructure/auth/session-store';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';

describe('API Route Handlers Integration', () => {
  let approverToken: string;
  let adminToken: string;
  let managerToken: string;
  let directorToken: string;

  beforeEach(async () => {
    // Reset session store and repo for clean test state
    globalThis.__sessionStore = undefined;
    globalThis.__invoiceRepository = undefined;

    const sessionStore = getSessionStore();
    approverToken = sessionStore.create({ username: 'demo.approver', role: 'Approver' });
    adminToken = sessionStore.create({ username: 'demo.admin', role: 'Admin' });
    managerToken = sessionStore.create({ username: 'demo.manager', role: 'Manager' });
    directorToken = sessionStore.create({ username: 'demo.director1', role: 'Director' });
  });

  const createRequest = (url: string, method: string, options: { token?: string; body?: any } = {}) => {
    const headers = new Headers();
    if (options.token) {
      headers.set('Authorization', `Bearer ${options.token}`);
    }
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextRequest(new URL(url, 'http://localhost:5000'), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  describe('Auth Routes', () => {
    it('login returns 200 with token and role for valid credentials', async () => {
      const req = createRequest('/api/auth/login', 'POST', {
        body: { username: 'demo.approver', password: 'ChangeMe123!' },
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.username).toBe('demo.approver');
      expect(data.role).toBe('Approver');
    });

    it('login returns 401 for invalid credentials', async () => {
      const req = createRequest('/api/auth/login', 'POST', {
        body: { username: 'demo.approver', password: 'wrong' },
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid username or password.');
    });

    it('login returns 200 with Manager and Director roles', async () => {
      const managerReq = createRequest('/api/auth/login', 'POST', {
        body: { username: 'demo.manager', password: 'ChangeMe123!' },
      });
      const managerRes = await loginRoute(managerReq);
      expect(managerRes.status).toBe(200);
      const managerData = await managerRes.json();
      expect(managerData.role).toBe('Manager');

      const directorReq = createRequest('/api/auth/login', 'POST', {
        body: { username: 'demo.director1', password: 'ChangeMe123!' },
      });
      const directorRes = await loginRoute(directorReq);
      expect(directorRes.status).toBe(200);
      const directorData = await directorRes.json();
      expect(directorData.role).toBe('Director');
    });

    it('logout returns 204 and clears session', async () => {
      const req = createRequest('/api/auth/logout', 'POST', { token: approverToken });
      const res = await logoutRoute(req);
      expect(res.status).toBe(204);
      expect(getSessionStore().get(approverToken)).toBeNull();
    });
  });

  describe('Invoices Routes', () => {
    it('GET /api/invoices requires authentication', async () => {
      const req = createRequest('/api/invoices', 'GET');
      const res = await getInvoicesRoute(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/invoices returns all seed invoices for authenticated user', async () => {
      const req = createRequest('/api/invoices', 'GET', { token: approverToken });
      const res = await getInvoicesRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(5);
    });

    it('GET /api/invoices filters by status', async () => {
      const req = createRequest('/api/invoices?status=Draft', 'GET', { token: approverToken });
      const res = await getInvoicesRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.every((i: any) => i.status === 'Draft')).toBe(true);
    });

    it('GET /api/invoices returns 400 for unknown status', async () => {
      const req = createRequest('/api/invoices?status=InvalidStatus', 'GET', { token: approverToken });
      const res = await getInvoicesRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Unknown status 'InvalidStatus'.");
    });

    it('POST /api/invoices validates required customer name', async () => {
      const req = createRequest('/api/invoices', 'POST', {
        token: approverToken,
        body: { customerName: '  ', amount: 500 },
      });
      const res = await createInvoiceRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Customer name is required.');
    });

    it('POST /api/invoices validates amount > 0', async () => {
      const req = createRequest('/api/invoices', 'POST', {
        token: approverToken,
        body: { customerName: 'New School', amount: 0 },
      });
      const res = await createInvoiceRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Amount must be greater than zero.');
    });

    it('POST /api/invoices creates a new draft invoice', async () => {
      const req = createRequest('/api/invoices', 'POST', {
        token: approverToken,
        body: { customerName: 'New Academy', amount: 750.25 },
      });
      const res = await createInvoiceRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('INV-1006');
      expect(data.status).toBe('Draft');
      expect(data.customerName).toBe('New Academy');
      expect(data.amount).toBe(750.25);
      expect(res.headers.get('Location')).toBe('/api/invoices/INV-1006');
    });

    it('GET /api/invoices/[id] returns invoice if found or 404', async () => {
      const reqFound = createRequest('/api/invoices/INV-1001', 'GET', { token: approverToken });
      const resFound = await getInvoiceByIdRoute(reqFound, { params: { id: 'INV-1001' } });
      expect(resFound.status).toBe(200);

      const reqNotFound = createRequest('/api/invoices/INV-9999', 'GET', { token: approverToken });
      const resNotFound = await getInvoiceByIdRoute(reqNotFound, { params: { id: 'INV-9999' } });
      expect(resNotFound.status).toBe(404);
    });

    it('DELETE /api/invoices/[id] returns 403 for non-Admin', async () => {
      const req = createRequest('/api/invoices/INV-1005', 'DELETE', { token: approverToken });
      const res = await deleteInvoiceRoute(req, { params: { id: 'INV-1005' } });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/invoices/[id] returns 204 for Admin', async () => {
      const req = createRequest('/api/invoices/INV-1005', 'DELETE', { token: adminToken });
      const res = await deleteInvoiceRoute(req, { params: { id: 'INV-1005' } });
      expect(res.status).toBe(204);

      const getReq = createRequest('/api/invoices/INV-1005', 'GET', { token: adminToken });
      const getRes = await getInvoiceByIdRoute(getReq, { params: { id: 'INV-1005' } });
      expect(getRes.status).toBe(404);
    });
  });

  describe('Approvals Routes', () => {
    it('POST /api/invoices/[id]/submit moves draft to PendingApproval', async () => {
      const req = createRequest('/api/invoices/INV-1005/submit', 'POST', { token: approverToken });
      const res = await submitInvoiceRoute(req, { params: { id: 'INV-1005' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('PendingApproval');
    });

    it('POST /api/invoices/[id]/submit returns 409 if invoice is not Draft', async () => {
      const req = createRequest('/api/invoices/INV-1001/submit', 'POST', { token: approverToken });
      const res = await submitInvoiceRoute(req, { params: { id: 'INV-1001' } });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('only drafts can be submitted');
    });

    it('POST /api/approvals/[id]/approve approves pending invoice', async () => {
      const req = createRequest('/api/approvals/INV-1001/approve', 'POST', { token: approverToken });
      const res = await approveRoute(req, { params: { id: 'INV-1001' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('Approved');
      expect(data.decidedBy).toBe('demo.approver');
      expect(data.decidedAt).toBeDefined();
    });

    it('POST /api/approvals/[id]/approve returns 422 with LIMIT_EXCEEDED when Manager approves over 50k and leaves repo invoice unchanged', async () => {
      const repo = getInvoiceRepository();
      const beforeInvoice = await repo.getById('INV-1002');
      expect(beforeInvoice?.amount).toBe(75000);
      expect(beforeInvoice?.status).toBe('PendingApproval');

      const req = createRequest('/api/approvals/INV-1002/approve', 'POST', { token: managerToken });
      const res = await approveRoute(req, { params: { id: 'INV-1002' } });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.reason).toBe('LIMIT_EXCEEDED');
      expect(data.error).toContain('exceeds Manager approval limit');

      const afterInvoice = await repo.getById('INV-1002');
      expect(afterInvoice).toEqual(beforeInvoice);
    });

    it('POST /api/approvals/[id]/approve returns 200 when Manager approves invoice <= 50k', async () => {
      const req = createRequest('/api/approvals/INV-1001/approve', 'POST', { token: managerToken });
      const res = await approveRoute(req, { params: { id: 'INV-1001' } });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('Approved');
      expect(data.decidedBy).toBe('demo.manager');
    });

    it('POST /api/approvals/[id]/approve returns 200 when Director approves invoice <= 500k', async () => {
      const req = createRequest('/api/approvals/INV-1002/approve', 'POST', { token: directorToken });
      const res = await approveRoute(req, { params: { id: 'INV-1002' } });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('Approved');
      expect(data.decidedBy).toBe('demo.director1');
    });

    it('POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices', async () => {
      const repo = getInvoiceRepository();
      const sessionStore = getSessionStore();
      const director2Token = sessionStore.create({ username: 'demo.director2', role: 'Director' });

      const beforeInvoice = await repo.getById('INV-1003');
      expect(beforeInvoice?.amount).toBe(600000);

      // 1st approval by Director 1 moves to PartiallyApproved
      const req1 = createRequest('/api/approvals/INV-1003/approve', 'POST', { token: directorToken });
      const res1 = await approveRoute(req1, { params: { id: 'INV-1003' } });
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.status).toBe('PartiallyApproved');
      expect(data1.approvals).toHaveLength(1);

      // Duplicate approval attempt by same Director returns 422 SAME_APPROVER
      const dupReq = createRequest('/api/approvals/INV-1003/approve', 'POST', { token: directorToken });
      const dupRes = await approveRoute(dupReq, { params: { id: 'INV-1003' } });
      expect(dupRes.status).toBe(422);
      const dupData = await dupRes.json();
      expect(dupData.reason).toBe('SAME_APPROVER');

      // 2nd approver as Manager returns 422 SECOND_APPROVER_NOT_DIRECTOR
      const mgrReq = createRequest('/api/approvals/INV-1003/approve', 'POST', { token: managerToken });
      const mgrRes = await approveRoute(mgrReq, { params: { id: 'INV-1003' } });
      expect(mgrRes.status).toBe(422);
      const mgrData = await mgrRes.json();
      expect(mgrData.reason).toBe('SECOND_APPROVER_NOT_DIRECTOR');

      // 2nd approval by distinct Director returns 200 and transitions to Approved
      const req2 = createRequest('/api/approvals/INV-1003/approve', 'POST', { token: director2Token });
      const res2 = await approveRoute(req2, { params: { id: 'INV-1003' } });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.status).toBe('Approved');
      expect(data2.approvals).toHaveLength(2);
    });

    it('POST /api/approvals/[id]/reject requires non-empty reason', async () => {
      const req = createRequest('/api/approvals/INV-1002/reject', 'POST', {
        token: approverToken,
        body: { reason: '   ' },
      });
      const res = await rejectRoute(req, { params: { id: 'INV-1002' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('A reason is required to reject an invoice.');
    });

    it('POST /api/approvals/[id]/reject rejects pending invoice with reason', async () => {
      const req = createRequest('/api/approvals/INV-1002/reject', 'POST', {
        token: approverToken,
        body: { reason: 'Price too high' },
      });
      const res = await rejectRoute(req, { params: { id: 'INV-1002' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('Rejected');
      expect(data.decisionNote).toBe('Price too high');
      expect(data.decidedBy).toBe('demo.approver');
    });
  });

  describe('Test Reset Route', () => {
    it('POST /api/test/reset restores default seed invoices and counter', async () => {
      const repo = getInvoiceRepository();
      // Add an extra invoice
      await repo.add({ customerName: 'Temp School', amount: 123 });
      expect((await repo.getAll()).length).toBe(6);

      const res = await resetRoute();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Reset successful');

      const invoices = await repo.getAll();
      expect(invoices.length).toBe(5);
      expect(invoices.find(i => i.id === 'INV-1001')?.amount).toBe(40000);
      expect(invoices.find(i => i.id === 'INV-1002')?.amount).toBe(75000);
      expect(invoices.find(i => i.id === 'INV-1003')?.amount).toBe(600000);
    });

    it('POST /api/test/reset returns 404 when NODE_ENV is production', async () => {
      try {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await resetRoute();
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe('Not found');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
