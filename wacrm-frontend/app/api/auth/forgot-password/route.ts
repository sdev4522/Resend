import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, msg: 'Email is required' },
        { status: 400 }
      );
    }

    const backendRes = await fetch(`${API_BASE_URL}/api/user/send_resovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Failed to send recovery email' },
      { status: 500 }
    );
  }
}
