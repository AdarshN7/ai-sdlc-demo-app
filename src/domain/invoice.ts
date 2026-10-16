export type InvoiceStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected';

export interface Invoice {
  id: string;
  customerName: string;
  amount: number;
  status: InvoiceStatus;
  createdAt: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
}
