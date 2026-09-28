import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, SESSION_MAX_AGE, parseJwt } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, msg: 'Unauthorized' }, { status: 401 });
    }
    const adminPayload = parseJwt(sessionCookie);
    if (!adminPayload || adminPayload.role !== 'admin') {
      return NextResponse.json({ success: false, msg: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { uid } = await request.json();
    if (!uid) {
      return NextResponse.json({ success: false, msg: 'User ID is required' }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/admin/auto_login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionCookie}`,
      },
      body: JSON.stringify({ uid }),
    });

    const data = await res.json();
    if (!data.success || !data.token) {
      return NextResponse.json({ success: false, msg: data.msg || 'Impersonation failed' }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      msg: 'Logged in as user',
    });

    const isSecure = request.nextUrl.protocol === 'https:';

    // Store the admin's original token in wacrm_admin_return so they can switch back if needed
    response.cookies.set({
      name: 'wacrm_admin_return',
      value: sessionCookie,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600, // 1 hour return window
    });

    // Set the user token as the active session
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: data.token,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    response.cookies.set({
      name: ROLE_COOKIE_NAME,
      value: 'user',
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, msg: error.message }, { status: 500 });
  }
}
