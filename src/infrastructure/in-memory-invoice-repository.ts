import { Invoice } from '@/domain/invoice';
import { IInvoiceRepository } from '@/domain/invoice-repository.interface';

/**
 * In-memory store so the demo app runs with no database. Seeded with default invoices.
 */
export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private nextNumber = 1006;
  private readonly invoices: Invoice[] = [
    {
      id: 'INV-1001',
      customerName: 'Lakeside School District',
      amount: 4250.00,
      status: 'PendingApproval',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'INV-1002',
      customerName: 'Hilltop Academy',
      amount: 980.50,
      status: 'PendingApproval',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'INV-1003',
      customerName: 'Riverside Charter',
      amount: 12300.00,
      status: 'Approved',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      decidedBy: 'demo.approver',
      decidedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'INV-1004',
      customerName: 'Oakwood Independent',
      amount: 615.75,
      status: 'PendingApproval',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'INV-1005',
      customerName: 'Maple Grove Prep',
      amount: 310.00,
      status: 'Draft',
      createdAt: new Date().toISOString(),
    },
  ];

  async getAll(): Promise<Invoice[]> {
    return [...this.invoices.map(i => ({ ...i }))];
  }

  async getById(id: string): Promise<Invoice | null> {
    const found = this.invoices.find(i => i.id === id);
    return found ? { ...found } : null;
  }

  async getByIds(ids: string[]): Promise<Invoice[]> {
    const set = new Set(ids);
    return this.invoices.filter(i => set.has(i.id)).map(i => ({ ...i }));
  }

  async add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'status'> & Partial<Pick<Invoice, 'id' | 'createdAt' | 'status'>>): Promise<Invoice> {
    const id = invoice.id || `INV-${this.nextNumber++}`;
    const newInvoice: Invoice = {
      id,
      customerName: invoice.customerName,
      amount: invoice.amount,
      status: invoice.status || 'Draft',
      createdAt: invoice.createdAt || new Date().toISOString(),
      decidedBy: invoice.decidedBy ?? null,
      decidedAt: invoice.decidedAt ?? null,
      decisionNote: invoice.decisionNote ?? null,
    };
    this.invoices.push(newInvoice);
    return { ...newInvoice };
  }

  async update(invoice: Invoice): Promise<void> {
    const index = this.invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      this.invoices[index] = { ...invoice };
    }
  }

  async remove(id: string): Promise<boolean> {
    const initialLen = this.invoices.length;
    const remaining = this.invoices.filter(i => i.id !== id);
    this.invoices.length = 0;
    this.invoices.push(...remaining);
    return remaining.length < initialLen;
  }
}

// Global singleton caching to maintain persistence across Next.js dev reloads
declare global {
  // eslint-disable-next-line no-var
  var __invoiceRepository: InMemoryInvoiceRepository | undefined;
}

export function getInvoiceRepository(): InMemoryInvoiceRepository {
  if (!globalThis.__invoiceRepository) {
    globalThis.__invoiceRepository = new InMemoryInvoiceRepository();
  }
  return globalThis.__invoiceRepository;
}
