export type InvoiceStatus =
  | 'Draft'
  | 'PendingApproval'
  | 'PartiallyApproved'
  | 'Approved'
  | 'Rejected';

export type Role = 'Approver' | 'Admin' | 'Manager' | 'Director' | string;

export interface InvoiceApproval {
  userId: string;
  role: Role;
  timestamp: string;
  approvedAt?: string;
}

export interface Invoice {
  id: string;
  customerName: string;
  amount: number;
  status: InvoiceStatus;
  createdAt: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  approvals?: InvoiceApproval[];
}

