import { NextResponse } from 'next/server';
import { getInvoiceRepository } from '@/infrastructure/in-memory-invoice-repository';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const repository = getInvoiceRepository();
  await repository.reset();

  return NextResponse.json({ message: 'Reset successful' });
}
