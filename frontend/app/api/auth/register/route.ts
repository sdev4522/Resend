import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, mobile_with_country_code, acceptPolicy } = body;

    if (!name || !email || !password || !mobile_with_country_code) {
      return NextResponse.json(
        { success: false, msg: 'Please fill all required details' },
        { status: 400 }
      );
    }

    if (!acceptPolicy) {
      return NextResponse.json(
        { success: false, msg: 'You must agree to the Terms of Service & Privacy Policy' },
        { status: 400 }
      );
    }

    // Call real backend signup
    const signupRes = await fetch(`${API_BASE_URL}/api/user/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        mobile_with_country_code,
        acceptPolicy: true,
      }),
    });

    const signupData = await signupRes.json();

    if (!signupData.success) {
      return NextResponse.json(
        { success: false, msg: signupData.msg || 'Signup failed' },
        { status: 400 }
      );
    }

    // Email verification is required before session creation
    return NextResponse.json({
      success: true,
      email_verification_required: true,
      email: email.toLowerCase().trim(),
      msg: signupData.msg || 'Account created. Please verify your email with the 6-digit code.',
    });
  } catch (error: any) {
    console.error('Registration route error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
