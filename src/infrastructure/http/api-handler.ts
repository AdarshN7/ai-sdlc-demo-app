import { NextResponse } from 'next/server';
import {
  ApprovalRejectedError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof ApprovalRejectedError) {
    return NextResponse.json(
      {
        error: error.message,
        message: error.message,
        reason: error.reason,
      },
      { status: 422 }
    );
  }


  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return new NextResponse(null, { status: 403 });
  }

  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
}
