import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, SESSION_MAX_AGE, parseJwt } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, idToken, code, redirectUri } = body;

    const rawToken = idToken || token;
    if (!rawToken && !code) {
      return NextResponse.json(
        { success: false, code: 'TOKEN_MISSING', msg: 'Google credential token or authorization code is required' },
        { status: 400 }
      );
    }

    // Extract client IP safely, prioritizing Cloudflare / Nginx headers
    const clientIp =
      request.headers.get('cf-connecting-ip')?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '';

    const backendRes = await fetch(`${API_BASE_URL}/api/user/login_with_google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clientIp ? { 'x-real-ip': clientIp, 'x-forwarded-for': clientIp } : {}),
      },
      body: JSON.stringify({
        idToken: rawToken,
        token: rawToken,
        code,
        redirectUri,
      }),
    });

    let data: any = {};
    try {
      data = await backendRes.json();
    } catch {
      data = { success: false, msg: backendRes.statusText || 'Internal server error' };
    }

    // Propagate backend failures with their true status code and error classification
    if (!backendRes.ok || !data.token || data.success === false) {
      const statusCode = backendRes.status >= 400 ? backendRes.status : 401;
      const resp = NextResponse.json(
        {
          success: false,
          code: data.code || (statusCode === 401 ? 'INVALID_TOKEN' : 'AUTH_ERROR'),
          msg: data.msg || 'Google authentication failed',
        },
        { status: statusCode }
      );
      resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      resp.headers.set('Pragma', 'no-cache');
      return resp;
    }

    const jwtToken = data.token;
    const decoded = parseJwt(jwtToken);
    const resolvedRole = decoded?.role || data.role || 'user';

    // Fetch user or agent profile using the verified JWT token
    let userProfile: any = {
      uid: decoded?.uid,
      email: decoded?.email,
      role: resolvedRole,
    };

    if (resolvedRole === 'user') {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/user/get_me`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
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
        console.error('Error fetching user profile after Google login:', e);
      }
    } else if (resolvedRole === 'agent') {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/agent/get_me`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        const meData = await meRes.json();
        if (meData.data) {
          const { password: _, ...cleanData } = meData.data;
          userProfile = { ...cleanData, role: 'agent', owner_uid: decoded?.owner_uid };
        }
      } catch (e) {
        console.error('Error fetching agent profile after Google login:', e);
      }
    }

    const response = NextResponse.json({
      success: true,
      user: userProfile,
      role: resolvedRole,
      is_new_user: Boolean(data.is_new_user),
      msg: data.msg || 'Google authentication successful',
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');

    const isSecure = request.nextUrl.protocol === 'https:';

    // Set secure httpOnly session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: jwtToken,
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
    console.error('Google auth route error:', error);
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', msg: error.message || 'Internal server error during Google authentication' },
      { status: 500 }
    );
  }
}
