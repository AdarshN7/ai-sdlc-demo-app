import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';
import { requireAuth } from '@/infrastructure/auth/auth-guard';
import { handleApiError } from '@/infrastructure/http/api-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request);

    const repository = getInvoiceRepository();
    const invoice = await repository.getById(params.id);

    if (!invoice) {
      return new NextResponse(null, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request, ['Admin']);

    const repository = getInvoiceRepository();
    const removed = await repository.remove(params.id);

    if (!removed) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
