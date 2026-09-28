import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, code, token } = body;
    const verificationCode = (otp || code || token || '').toString().trim();
    const userEmail = (email || '').toString().toLowerCase().trim();

    if (!userEmail || !verificationCode) {
      return NextResponse.json(
        { success: false, msg: 'Email and 6-digit verification code are required' },
        { status: 400 }
      );
    }

    const backendRes = await fetch(`${API_BASE_URL}/api/user/verify_email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, otp: verificationCode }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data.success) {
      return NextResponse.json(
        {
          success: false,
          code: data.code || 'VERIFICATION_FAILED',
          msg: data.msg || 'Verification failed. Please check the code and try again.',
        },
        { status: backendRes.status || 400 }
      );
    }

    const authToken = data.token;
    const isSecure = request.nextUrl.protocol === 'https:';

    const response = NextResponse.json({
      success: true,
      user: data.user,
      role: 'user',
      already_verified: Boolean(data.already_verified),
      msg: data.msg || 'Email verified successfully',
    });

    if (authToken) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: authToken,
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
    }

    return response;
  } catch (error: any) {
    console.error('Verify email route error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Internal server error during email verification' },
      { status: 500 }
    );
  }
}
