import { NextResponse } from 'next/server';
import { getSessionStore } from '@/infrastructure/auth/session-store';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring('Bearer '.length);
    getSessionStore().remove(token);
  }

  return new NextResponse(null, { status: 204 });
}
