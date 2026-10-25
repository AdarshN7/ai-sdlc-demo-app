import { getSessionStore } from './session-store';
import { UserRole, UserSession } from './user-session';
import { ForbiddenError, UnauthorizedError } from '@/domain/errors';

export function getSessionFromRequest(request: Request): UserSession | null {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring('Bearer '.length);
  return getSessionStore().get(token);
}

export function requireAuth(request: Request, allowedRoles?: UserRole[]): UserSession {
  const session = getSessionFromRequest(request);
  if (!session) {
    throw new UnauthorizedError('Unauthorized');
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new ForbiddenError('Forbidden');
  }

  return session;
}
