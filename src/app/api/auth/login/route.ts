import { NextResponse } from 'next/server';
import { DEMO_USERS } from '@/infrastructure/auth/user-session';
import { getSessionStore } from '@/infrastructure/auth/session-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const user = DEMO_USERS.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const sessionStore = getSessionStore();
    const token = sessionStore.create({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      token,
      userId: user.userId,
      username: user.username,
      role: user.role,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
