import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/auth/session';

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    let pathSegments = resolvedParams.path || [];

    // Path traversal prevention: reject any segment containing '..' or path separators
    if (pathSegments.some((seg) => seg.includes('..') || seg.includes('/') || seg.includes('\\') || seg.includes('%2e'))) {
      return NextResponse.json({ success: false, msg: 'Invalid path segments' }, { status: 400 });
    }

    if (pathSegments.length > 0 && pathSegments[0] === 'api') {
      pathSegments = pathSegments.slice(1);
    }
    const targetPath = pathSegments.map(encodeURIComponent).join('/');

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const token = sessionCookie?.value;

    const url = new URL(request.url);
    const targetUrl = `${API_BASE_URL}/api/${targetPath}${url.search}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const incomingAuth = request.headers.get('authorization');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (incomingAuth) {
      headers['Authorization'] = incomingAuth;
    }

    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    let body: any = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text();
    }

    const backendRes = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const responseData = await backendRes.json().catch(() => null);

    // If session invalidated or expired
    if (
      backendRes.status === 401 ||
      (responseData && responseData.logout) ||
      (responseData && responseData.msg === 'Session expired. Please login again.')
    ) {
      const response = NextResponse.json(
        responseData || { success: false, msg: 'Session expired', logout: true },
        { status: 401 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      response.cookies.delete(ROLE_COOKIE_NAME);
      return response;
    }

    return NextResponse.json(responseData, { status: backendRes.status });
  } catch (error: any) {
    console.error('API Proxy error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Proxy request failed' },
      { status: 500 }
    );
  }
}

export { handleProxy as GET, handleProxy as POST, handleProxy as PUT, handleProxy as PATCH, handleProxy as DELETE };
