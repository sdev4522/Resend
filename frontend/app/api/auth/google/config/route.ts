import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const backendRes = await fetch(`${API_BASE_URL}/api/user/google_auth_config`, {
      cache: 'no-store',
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      const resp = NextResponse.json({
        success: true,
        enabled: Boolean(data.enabled),
        clientId: data.client_id || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      });
      resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return resp;
    }

    // Fallback to environment variable if backend is temporarily unreachable
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const resp = NextResponse.json({
      success: true,
      enabled: Boolean(envClientId),
      clientId: envClientId,
    });
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return resp;
  } catch (error: any) {
    console.error('Error fetching Google auth config:', error);
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    return NextResponse.json({
      success: true,
      enabled: Boolean(envClientId),
      clientId: envClientId,
    });
  }
}
