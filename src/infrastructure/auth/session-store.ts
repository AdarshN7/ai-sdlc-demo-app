import crypto from 'crypto';
import { UserSession } from './user-session';

/**
 * Keeps signed-in sessions in memory, keyed by an opaque bearer token.
 */
export class SessionStore {
  private readonly sessions = new Map<string, UserSession>();

  create(session: UserSession): string {
    const token = crypto.randomBytes(16).toString('hex');
    this.sessions.set(token, session);
    return token;
  }

  get(token?: string | null): UserSession | null {
    if (!token) return null;
    return this.sessions.get(token) || null;
  }

  remove(token: string): void {
    this.sessions.delete(token);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __sessionStore: SessionStore | undefined;
}

export function getSessionStore(): SessionStore {
  if (!globalThis.__sessionStore) {
    globalThis.__sessionStore = new SessionStore();
  }
  return globalThis.__sessionStore;
}
