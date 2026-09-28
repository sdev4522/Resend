import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    const userEmail = (email || '').toString().toLowerCase().trim();

    if (!userEmail) {
      return NextResponse.json(
        { success: false, msg: 'Email is required' },
        { status: 400 }
      );
    }

    const backendRes = await fetch(`${API_BASE_URL}/api/user/resend_verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data.success) {
      return NextResponse.json(
        {
          success: false,
          code: data.code,
          cooldown: data.cooldown,
          msg: data.msg || 'Failed to resend verification email',
        },
        { status: backendRes.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      cooldown: data.cooldown || 60,
      msg: data.msg || 'Verification code sent',
    });
  } catch (error: any) {
    console.error('Resend verification route error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Internal server error while resending verification' },
      { status: 500 }
    );
  }
}
