import { Invoice } from '@/domain/invoice';
import { IInvoiceRepository } from '@/domain/invoice-repository.interface';

export class FakeInvoiceRepository implements IInvoiceRepository {
  private readonly initialSeed: Invoice[];
  private readonly invoices: Invoice[] = [];

  constructor(...seed: Invoice[]) {
    this.initialSeed = seed.map(i => ({ ...i }));
    this.invoices.push(...seed.map(i => ({ ...i })));
  }

  async getAll(): Promise<Invoice[]> {
    return [...this.invoices];
  }

  async getById(id: string): Promise<Invoice | null> {
    const found = this.invoices.find(i => i.id === id);
    return found ? { ...found } : null;
  }

  async getByIds(ids: string[]): Promise<Invoice[]> {
    const idSet = new Set(ids);
    return this.invoices.filter(i => idSet.has(i.id)).map(i => ({ ...i }));
  }

  async add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'status'> & Partial<Pick<Invoice, 'id' | 'createdAt' | 'status'>>): Promise<Invoice> {
    const newInvoice: Invoice = {
      id: invoice.id || `INV-${this.invoices.length + 1000}`,
      customerName: invoice.customerName,
      amount: invoice.amount,
      status: invoice.status || 'Draft',
      createdAt: invoice.createdAt || new Date().toISOString(),
      decidedBy: invoice.decidedBy,
      decidedAt: invoice.decidedAt,
      decisionNote: invoice.decisionNote,
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

  async reset(): Promise<void> {
    this.invoices.length = 0;
    this.invoices.push(...this.initialSeed.map(i => ({ ...i })));
  }
}
