import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { success: false, msg: 'Unauthenticated' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    token: sessionCookie.value,
  });
}
