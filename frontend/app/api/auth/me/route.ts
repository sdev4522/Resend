import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/api';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, parseJwt } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

    // If no session cookie, user is simply unauthenticated (not an error)
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, unauthenticated: true, msg: 'No active session' },
        { status: 200 }
      );
    }

    const token = sessionCookie.value;
    const decoded = parseJwt(token);

    if (!decoded || !decoded.uid) {
      const response = NextResponse.json(
        { success: false, msg: 'Invalid session token', logout: true },
        { status: 401 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      response.cookies.delete(ROLE_COOKIE_NAME);
      return response;
    }

    const role = decoded.role || 'user';

    if (role === 'admin') {
      try {
        const adminRes = await fetch(`${API_BASE_URL}/api/admin/get_admin`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const adminData = await adminRes.json().catch(() => null);
        if (adminData && adminData.success && adminData.data) {
          const { password: _, ...cleanAdmin } = adminData.data;
          return NextResponse.json({
            success: true,
            user: {
              ...cleanAdmin,
              name: cleanAdmin.name || 'System Administrator',
              role: 'admin',
            },
            role: 'admin',
            workspace: {
              id: cleanAdmin.uid || decoded.uid,
              name: 'Admin Console',
              ownerUid: cleanAdmin.uid || decoded.uid,
              role: 'admin',
              isOwner: true,
            },
          });
        }
      } catch (err) {
        console.error('Failed to fetch real admin details:', err);
      }

      return NextResponse.json({
        success: true,
        user: {
          uid: decoded.uid,
          email: decoded.email || 'admin@admin.com',
          name: 'Administrator',
          role: 'admin',
        },
        role: 'admin',
        workspace: {
          id: decoded.uid,
          name: 'Admin Workspace',
          ownerUid: decoded.uid,
          role: 'admin',
          isOwner: true,
        },
      });
    }

    const endpoint = role === 'agent'
      ? `${API_BASE_URL}/api/agent/get_me`
      : `${API_BASE_URL}/api/user/get_me`;

    const backendRes = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await backendRes.json();

    // Check if session invalid or expired
    if (!backendRes.ok || data.logout || data.success === false) {
      const response = NextResponse.json(
        {
          success: false,
          msg: data.msg || 'Session expired or invalidated',
          logout: true,
        },
        { status: 401 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      response.cookies.delete(ROLE_COOKIE_NAME);
      return response;
    }

    // Strip password and format user & workspace context
    const rawUserData = data.data || {};
    const { password: _, ...userData } = rawUserData;

    // Parse plan JSON string if needed
    let parsedPlan = null;
    if (userData.plan) {
      if (typeof userData.plan === 'string') {
        try {
          parsedPlan = JSON.parse(userData.plan);
        } catch {
          parsedPlan = null;
        }
      } else {
        parsedPlan = userData.plan;
      }
    }

    let planExpireFormatted = userData.plan_expire;
    if (userData.plan_expire) {
      const ts = Number(userData.plan_expire);
      if (!isNaN(ts) && ts > 0) {
        planExpireFormatted = new Date(ts).toISOString();
      }
    }

    let waConnected = false;
    let waPhone: string | undefined = undefined;

    const [qrSettled, metaSettled] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/qr/get_all`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE_URL}/api/user/get_meta_keys`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null),
    ]);

    const qrData = qrSettled.status === 'fulfilled' ? qrSettled.value : null;
    if (qrData && qrData.success && Array.isArray(qrData.data)) {
      const activeInstance = qrData.data.find((inst: any) => inst.status === 'ACTIVE');
      if (activeInstance) {
        waConnected = true;
        waPhone = activeInstance.number || undefined;
      }
    }

    if (!waConnected) {
      const metaData = metaSettled.status === 'fulfilled' ? metaSettled.value : null;
      if (metaData && metaData.success && metaData.data?.waba_id) {
        waConnected = true;
        let phoneDetails = null;
        if (typeof metaData.data.embed_data === 'string') {
          try {
            phoneDetails = JSON.parse(metaData.data.embed_data)?.phoneDetails;
          } catch {
            phoneDetails = null;
          }
        } else if (metaData.data.embed_data) {
          phoneDetails = metaData.data.embed_data.phoneDetails;
        }
        waPhone = phoneDetails?.display_phone_number || metaData.data.business_phone_number_id || 'Meta Cloud';
      }
    }

    const cleanUser = {
      ...userData,
      email_verified: Boolean(userData.email_verified_at),
      wa_connected: waConnected,
      wa_phone: waPhone,
      plan: parsedPlan,
      plan_expire: planExpireFormatted,
      subscription_id: userData.subscription_id || null,
      subscription_status: userData.subscription_status || (parsedPlan?.is_trial ? 'trialing' : null),
      trial: typeof userData.trial !== 'undefined' ? Number(userData.trial) : (parsedPlan?.is_trial ? 1 : 0),
      role,
    };

    const workspace = {
      id: role === 'agent' ? decoded.owner_uid : userData.uid,
      name: `${userData.name || 'My'}'s Workspace`,
      ownerUid: role === 'agent' ? decoded.owner_uid : userData.uid,
      role,
      isOwner: role === 'user',
      contactCount: userData.contact || 0,
      plan: parsedPlan,
      planExpire: planExpireFormatted,
      addons: data.addon || [],
    };

    return NextResponse.json({
      success: true,
      user: cleanUser,
      role,
      workspace,
    });
  } catch (error: any) {
    console.error('Me route error:', error);
    return NextResponse.json(
      { success: false, msg: error.message || 'Failed to authenticate session' },
      { status: 500 }
    );
  }
}
