import { Invoice } from './invoice';

export interface IInvoiceRepository {
  getAll(): Promise<Invoice[]>;
  getById(id: string): Promise<Invoice | null>;
  getByIds(ids: string[]): Promise<Invoice[]>;
  add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'status'> & Partial<Pick<Invoice, 'id' | 'createdAt' | 'status'>>): Promise<Invoice>;
  update(invoice: Invoice): Promise<void>;
  remove(id: string): Promise<boolean>;
}
