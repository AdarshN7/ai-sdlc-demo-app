import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';
import { ApprovalService } from '@/domain/approval-service';
import { requireAuth } from '@/infrastructure/auth/auth-guard';
import { handleApiError } from '@/infrastructure/http/api-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAuth(request);

    const repository = getInvoiceRepository();
    const service = new ApprovalService(repository);
    const updated = await service.submit(params.id);

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
