import { NextResponse } from 'next/server';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';

export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_RESET !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const repository = getInvoiceRepository();
  await repository.reset();

  return NextResponse.json({ message: 'Reset successful' });
}
