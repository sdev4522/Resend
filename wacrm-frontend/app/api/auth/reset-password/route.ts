import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, msg: 'Token and new password are required' },
        { status: 400 }
      );
    }

    const backendRes = await fetch(
      `${API_BASE_URL}/api/user/modify_password?pass=${encodeURIComponent(password)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
