import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, SESSION_MAX_AGE, parseJwt } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role = 'user' } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, msg: 'Please provide email and password' },
        { status: 400 }
      );
    }

    let backendUrl = `${API_BASE_URL}/api/user/login`;
    if (role === 'admin') {
      backendUrl = `${API_BASE_URL}/api/admin/login`;
    } else if (role === 'agent') {
      backendUrl = `${API_BASE_URL}/api/agent/login`;
    }

    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data = await backendRes.json();

    if (data.email_unverified) {
      return NextResponse.json(
        {
          success: false,
          email_unverified: true,
          email: data.email || email,
          msg: data.msg || 'Please verify your email address before logging in.',
        },
        { status: 403 }
      );
    }

    // If default user login returned invalid credentials, fallback to agent login if no role was specified
    if ((!data.token || data.success === false) && !body.role) {
      const agentRes = await fetch(`${API_BASE_URL}/api/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const agentData = await agentRes.json();
      if (agentData.token) {
        data = agentData;
      }
    }

    if (!data.token) {
      return NextResponse.json(
        { success: false, msg: data.msg || 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = data.token;
    const decoded = parseJwt(token);
    const resolvedRole = decoded?.role || role;

    // Fetch user profile using the token to return immediate user context
    let userProfile: any = {
      uid: decoded?.uid,
      email,
      role: resolvedRole,
    };

    if (resolvedRole === 'user') {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/user/get_me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        if (meData.data) {
          const { password: _, ...cleanData } = meData.data;
          let parsedPlan = null;
          if (cleanData.plan) {
            try {
              parsedPlan = typeof cleanData.plan === 'string' ? JSON.parse(cleanData.plan) : cleanData.plan;
            } catch {
              parsedPlan = null;
            }
          }
          let planExpireFormatted = cleanData.plan_expire;
          if (cleanData.plan_expire) {
            const ts = Number(cleanData.plan_expire);
            if (!isNaN(ts) && ts > 0) {
              planExpireFormatted = new Date(ts).toISOString();
            }
          }
          userProfile = {
            ...cleanData,
            plan: parsedPlan,
            plan_expire: planExpireFormatted,
            role: 'user',
          };
        }
      } catch (e) {
        console.error('Error fetching user profile after login:', e);
      }
    } else if (resolvedRole === 'agent') {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/agent/get_me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        if (meData.data) {
          const { password: _, ...cleanData } = meData.data;
          userProfile = { ...cleanData, role: 'agent', owner_uid: decoded?.owner_uid };
        }
      } catch (e) {
        console.error('Error fetching agent profile after login:', e);
      }
    } else if (resolvedRole === 'admin') {
      userProfile = {
        uid: decoded?.uid,
        email,
        name: 'Administrator',
        role: 'admin',
      };
    }

    const response = NextResponse.json({
      success: true,
      user: userProfile,
      role: resolvedRole,
      msg: 'Login successful',
    });

    const isSecure = request.nextUrl.protocol === 'https:';

    // Set secure httpOnly cookie with token
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    // Set non-sensitive role cookie for edge middleware routing
    response.cookies.set({
      name: ROLE_COOKIE_NAME,
      value: resolvedRole,
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error: any) {
    console.error('Login route error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Internal server error during login' },
      { status: 500 }
    );
  }
}
