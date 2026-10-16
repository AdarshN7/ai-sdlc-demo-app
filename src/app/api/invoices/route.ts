import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';
import { requireAuth } from '@/infrastructure/auth/auth-guard';
import { handleApiError } from '@/infrastructure/http/api-handler';
import { InvoiceStatus } from '@/domain/invoice';

const VALID_STATUSES: InvoiceStatus[] = ['Draft', 'PendingApproval', 'Approved', 'Rejected'];

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const repository = getInvoiceRepository();
    let invoices = await repository.getAll();

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');

    if (statusParam) {
      const matched = VALID_STATUSES.find(
        s => s.toLowerCase() === statusParam.toLowerCase()
      );

      if (!matched) {
        return NextResponse.json(
          { error: `Unknown status '${statusParam}'.` },
          { status: 400 }
        );
      }

      invoices = invoices.filter(i => i.status === matched);
    }

    return NextResponse.json(invoices);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    const body = await request.json();
    const { customerName, amount } = body;

    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Customer name is required.' },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero.' },
        { status: 400 }
      );
    }

    const repository = getInvoiceRepository();
    const invoice = await repository.add({
      customerName: customerName.trim(),
      amount: numericAmount,
    });

    return NextResponse.json(invoice, {
      status: 201,
      headers: {
        Location: `/api/invoices/${invoice.id}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
