import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, parseJwt } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) {
      const decoded = parseJwt(sessionCookie.value);
      const role = decoded?.role;

      let logoutEndpoint = `${API_BASE_URL}/api/user/logout`;
      if (role === 'admin') {
        logoutEndpoint = `${API_BASE_URL}/api/admin/logout`;
      } else if (role === 'agent') {
        logoutEndpoint = `${API_BASE_URL}/api/agent/logout`;
      }

      try {
        await fetch(logoutEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionCookie.value}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (backendErr) {
        console.error('Backend logout call failed:', backendErr);
      }
    }

    const response = NextResponse.json({
      success: true,
      msg: 'Logged out successfully',
    });

    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(ROLE_COOKIE_NAME);

    return response;
  } catch (error: any) {
    console.error('Logout route error:', error);
    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(ROLE_COOKIE_NAME);
    return response;
  }
}
