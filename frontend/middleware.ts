import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, parseJwt } from '@/lib/auth/session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const roleCookie = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  
  // MED-06: Parse JWT and validate exp to prevent login -> dashboard -> 401 loops
  const rawDecoded = sessionCookie ? parseJwt(sessionCookie) : null;
  const isExpired = Boolean(rawDecoded?.exp && rawDecoded.exp * 1000 <= Date.now());
  const decoded = isExpired ? null : rawDecoded;
  const role = isExpired ? null : (roleCookie || decoded?.role);
  const hasValidSession = Boolean(sessionCookie && !isExpired && decoded);

  // Admin login route
  const isAdminLogin = pathname === '/admin/login';

  // Public user auth routes (excluding /verify-email so unverified users aren't bounced)
  const isUserAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password';

  const isVerifyEmailRoute = pathname === '/verify-email';

  // Protected admin routes: /admin and /admin/* EXCEPT /admin/login
  const isProtectedAdminRoute = pathname.startsWith('/admin') && !isAdminLogin;

  // Protected user routes
  const isProtectedUserRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding');

  // MED-06: Handle expired session cookie - clear cookies and redirect to login
  if (sessionCookie && isExpired) {
    if (isProtectedUserRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete(SESSION_COOKIE_NAME);
      res.cookies.delete(ROLE_COOKIE_NAME);
      return res;
    }
    if (isProtectedAdminRoute) {
      const adminLoginUrl = new URL('/admin/login', request.url);
      adminLoginUrl.searchParams.set('callbackUrl', pathname);
      const res = NextResponse.redirect(adminLoginUrl);
      res.cookies.delete(SESSION_COOKIE_NAME);
      res.cookies.delete(ROLE_COOKIE_NAME);
      return res;
    }
    // Visiting an auth page with an expired session: strip stale cookies and continue
    const nextResponse = NextResponse.next();
    nextResponse.cookies.delete(SESSION_COOKIE_NAME);
    nextResponse.cookies.delete(ROLE_COOKIE_NAME);
    return nextResponse;
  }

  // Case 1: Unauthenticated user trying to access protected user route
  if (!hasValidSession && isProtectedUserRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Unauthenticated user trying to access protected admin route
  if (!hasValidSession && isProtectedAdminRoute) {
    const adminLoginUrl = new URL('/admin/login', request.url);
    adminLoginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(adminLoginUrl);
  }

  // Case 2b: User has session cookie but is unverified
  if (hasValidSession && role === 'user' && decoded?.emailVerified === false) {
    if (isProtectedUserRoute) {
      const verifyUrl = new URL('/verify-email', request.url);
      if (decoded.email) verifyUrl.searchParams.set('email', decoded.email);
      return NextResponse.redirect(verifyUrl);
    }
  }

  // Case 3: Authenticated user visiting /login, /register, /forgot-password
  if (hasValidSession && isUserAuthRoute) {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (role === 'user' && decoded?.emailVerified === false) {
      const verifyUrl = new URL('/verify-email', request.url);
      if (decoded.email) verifyUrl.searchParams.set('email', decoded.email);
      return NextResponse.redirect(verifyUrl);
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Case 3b: Authenticated user visiting /verify-email who is already verified
  if (hasValidSession && isVerifyEmailRoute && decoded?.emailVerified === true) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Case 4: Authenticated user visiting /admin/login
  if (hasValidSession && isAdminLogin) {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Case 5: Authenticated non-admin trying to access protected admin routes
  if (hasValidSession && isProtectedAdminRoute) {
    if (role !== 'admin') {
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('error', 'unauthorized_admin');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/verify-email',
  ],
};
