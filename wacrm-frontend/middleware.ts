import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, parseJwt } from '@/lib/auth/session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const roleCookie = request.cookies.get(ROLE_COOKIE_NAME)?.value;

  // Admin login route
  const isAdminLogin = pathname === '/admin/login';

  // Public user auth routes
  const isUserAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/verify-email';

  // Protected admin routes: /admin and /admin/* EXCEPT /admin/login
  const isProtectedAdminRoute = pathname.startsWith('/admin') && !isAdminLogin;

  // Protected user routes
  const isProtectedUserRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding');

  // Case 1: Unauthenticated user trying to access protected user route
  if (!sessionCookie && isProtectedUserRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Case 2: Unauthenticated user trying to access protected admin route
  if (!sessionCookie && isProtectedAdminRoute) {
    const adminLoginUrl = new URL('/admin/login', request.url);
    adminLoginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(adminLoginUrl);
  }

  // Case 3: Authenticated user visiting /login, /register, /forgot-password
  if (sessionCookie && isUserAuthRoute) {
    const role = roleCookie || parseJwt(sessionCookie)?.role;
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Case 4: Authenticated user visiting /admin/login
  if (sessionCookie && isAdminLogin) {
    const role = roleCookie || parseJwt(sessionCookie)?.role;
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Case 5: Authenticated non-admin trying to access protected admin routes
  if (sessionCookie && isProtectedAdminRoute) {
    const role = roleCookie || parseJwt(sessionCookie)?.role;
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
