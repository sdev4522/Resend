'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  QrConnectionState,
  QrInstance,
  QrCodeEvent,
  QrConnectedEvent,
  QrDisconnectedEvent,
  QrErrorEvent,
} from '@/types/qr';
import {
  MetaConnectionState,
  MetaConnection,
  MetaPublicConfig,
} from '@/types/meta';
import { qrApi } from '@/lib/api/qr';
import { metaApi } from '@/lib/api/meta';
import { launchEmbeddedSignup } from '@/lib/meta/sdk';
import { connectSocket } from '@/lib/socket/client';
import { useAuth } from '@/lib/auth/auth-context';
import { toast } from 'sonner';
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  LogOut,
  Plus,
  ShieldCheck,
  Cloud,
  Check,
  Loader2,
  Info,
  Clock,
  Building2,
  Unlink,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';

export default function IntegrationsPage() {
  const { user, refreshUser } = useAuth();

  // ── 1. QR Instances State ──────────────────────────────────────────────
  const [instances, setInstances] = useState<QrInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);

  // QR Modal & Connection State Machine
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connectionState, setConnectionState] = useState<QrConnectionState>('IDLE');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [qrErrorMsg, setQrErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [_pendingUniqueId, setPendingUniqueId] = useState<string | null>(null);
  const [isCreatingQr, setIsCreatingQr] = useState<boolean>(false);
  const pendingUniqueIdRef = useRef<string | null>(null);

  // QR deletion/logout alert dialogs
  const [instanceToDelete, setInstanceToDelete] = useState<QrInstance | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Socket reference
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── 2. Meta Cloud API State ─────────────────────────────────────────────
  const [metaConnection, setMetaConnection] = useState<MetaConnection | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaPublicConfig, setMetaPublicConfig] = useState<MetaPublicConfig | null>(null);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaState, setMetaState] = useState<MetaConnectionState>('IDLE');
  const [metaErrorMsg, setMetaErrorMsg] = useState<string | null>(null);
  const [metaDisconnecting, setMetaDisconnecting] = useState(false);
  const [showMetaDisconnectDialog, setShowMetaDisconnectDialog] = useState(false);

  // Fetch instances from backend
  const fetchInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      setInstanceError(null);
      const res = await qrApi.getInstances();
      setInstances(res.data || []);
    } catch (err: any) {
      console.error('Failed to load WhatsApp instances:', err);
      setInstanceError(err.message || 'Unable to load WhatsApp accounts. Please try again.');
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  // Fetch Meta connection & public config
  const fetchMetaConnection = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [connRes, configRes] = await Promise.all([
        metaApi.getConnection().catch(() => ({ success: false, data: null })),
        metaApi.getPublicConfig().catch(() => ({ success: false, data: null })),
      ]);

      if (connRes.success && connRes.data) {
        setMetaConnection(connRes.data);
      } else {
        setMetaConnection(null);
      }

      if (configRes.success && configRes.data) {
        setMetaPublicConfig(configRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load Meta connection:', err);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInstances();
    fetchMetaConnection();
  }, [fetchInstances, fetchMetaConnection]);

  // Setup Socket.IO listener for real-time QR events (strictly instance-scoped)
  useEffect(() => {
    let isSubscribed = true;

    async function initSocket() {
      try {
        const s = await connectSocket();
        if (!isSubscribed || !s) return;
        socketRef.current = s;

        s.on('qr_code', (data: QrCodeEvent) => {
          if (!data || !data.qr) return;
          // Only update UI if QR matches current pending session
          if (pendingUniqueIdRef.current && data.uniqueId && data.uniqueId !== pendingUniqueIdRef.current) {
            return;
          }
          setQrCodeDataUrl(data.qr);
          setConnectionState('QR_READY');
          setCountdown(60);
        });

        s.on('qr_connected', (data: QrConnectedEvent) => {
          // If this matches our pending connection, transition modal to connected
          if (!pendingUniqueIdRef.current || data?.uniqueId === pendingUniqueIdRef.current) {
            setConnectionState('CONNECTED');
            if (data?.number) {
              setConnectedNumber(data.number);
            }
            pendingUniqueIdRef.current = null;
            setPendingUniqueId(null);
            toast.success('WhatsApp connected successfully!');
          }
          fetchInstances();
          refreshUser();
        });

        s.on('qr_disconnected', (data?: QrDisconnectedEvent) => {
          const disconnectedId = data?.uniqueId;

          // Case 1: The pending QR session timed out or was cancelled
          if (disconnectedId && disconnectedId === pendingUniqueIdRef.current) {
            if (!data?.cancelled) {
              setConnectionState('EXPIRED');
            }
            pendingUniqueIdRef.current = null;
            setPendingUniqueId(null);
            // Existing connected accounts MUST remain completely unchanged!
            return;
          }

          // Case 2: An existing connected account disconnected
          if (disconnectedId) {
            setInstances((prev) =>
              prev.map((inst) =>
                inst.uniqueId === disconnectedId ? { ...inst, status: 'INACTIVE' } : inst
              )
            );
            toast.info('WhatsApp session disconnected');
            fetchInstances();
            refreshUser();
          }
        });

        s.on('qr_expired', (data?: { uniqueId: string }) => {
          if (!data?.uniqueId || data.uniqueId === pendingUniqueIdRef.current) {
            setConnectionState('EXPIRED');
            pendingUniqueIdRef.current = null;
            setPendingUniqueId(null);
          }
        });

        s.on('error', (data: QrErrorEvent) => {
          if (!data?.uniqueId || data.uniqueId === pendingUniqueIdRef.current) {
            setConnectionState('ERROR');
            setQrErrorMsg(data?.message || data?.error || 'Connection error occurred.');
          }
        });
      } catch (err) {
        console.error('Socket connection error:', err);
      }
    }

    initSocket();

    return () => {
      isSubscribed = false;
      if (socketRef.current) {
        socketRef.current.off('qr_code');
        socketRef.current.off('qr_connected');
        socketRef.current.off('qr_disconnected');
        socketRef.current.off('qr_expired');
        socketRef.current.off('error');
      }
    };
  }, [fetchInstances, refreshUser]);

  // Handle countdown timer for QR expiration
  useEffect(() => {
    if (connectionState === 'QR_READY' && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setConnectionState('EXPIRED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connectionState, countdown]);

  // Cancel any active pending QR session
  const handleCancelPending = useCallback(async () => {
    const idToCancel = pendingUniqueIdRef.current;
    pendingUniqueIdRef.current = null;
    setPendingUniqueId(null);
    setDialogOpen(false);
    setConnectionState('IDLE');
    setQrCodeDataUrl(null);
    setQrErrorMsg(null);
    setConnectedNumber(null);
    if (timerRef.current) clearInterval(timerRef.current);

    if (idToCancel) {
      try {
        await qrApi.cancelPending(idToCancel);
      } catch {
        // Silent cleanup
      }
    }
  }, []);

  // ── Start QR connection flow for a new account ─────────────────────────
  const handleStartQrConnection = async () => {
    if (!user?.uid || isCreatingQr) {
      if (!user?.uid) toast.error('Authentication required to connect WhatsApp');
      return;
    }

    setIsCreatingQr(true);

    // Cancel prior pending session if exists
    if (pendingUniqueIdRef.current) {
      qrApi.cancelPending(pendingUniqueIdRef.current).catch(() => {});
    }

    const generatedId = `${user.uid}_${Date.now().toString(36)}`;
    setPendingUniqueId(generatedId);
    pendingUniqueIdRef.current = generatedId;

    setDialogOpen(true);
    setConnectionState('CREATING');
    setQrCodeDataUrl(null);
    setQrErrorMsg(null);
    setConnectedNumber(null);
    setCountdown(60);

    try {
      const response = await qrApi.generateQr({
        title: `WhatsApp Web ${new Date().toLocaleDateString()}`,
        uniqueId: generatedId,
      });

      if (!response.success && (response as any).msg) {
        setConnectionState('ERROR');
        setQrErrorMsg((response as any).msg);
        return;
      }

      setConnectionState('WAITING_FOR_QR');

      setTimeout(async () => {
        try {
          if (pendingUniqueIdRef.current !== generatedId) return;
          const statusRes = await qrApi.getQrStatus(generatedId);
          if (statusRes.success && statusRes.data) {
            if (statusRes.data.qr) {
              setQrCodeDataUrl(statusRes.data.qr);
              setConnectionState('QR_READY');
              setCountdown(60);
            } else if (statusRes.data.status === 'ACTIVE') {
              setConnectionState('CONNECTED');
              setConnectedNumber(statusRes.data.number || null);
              pendingUniqueIdRef.current = null;
              setPendingUniqueId(null);
              fetchInstances();
              refreshUser();
            }
          }
        } catch {
          // Socket will handle
        }
      }, 4000);
    } catch (err: any) {
      console.error('Error generating QR:', err);
      setConnectionState('ERROR');
      setQrErrorMsg(err.message || 'Unable to initialize WhatsApp session. Please try again.');
    } finally {
      setIsCreatingQr(false);
    }
  };

  // ── Reconnect flow for an existing disconnected account ────────────────
  const handleReconnect = async (uniqueId: string) => {
    if (!user?.uid || isCreatingQr) return;

    setIsCreatingQr(true);

    // Cancel prior pending session if exists
    if (pendingUniqueIdRef.current && pendingUniqueIdRef.current !== uniqueId) {
      qrApi.cancelPending(pendingUniqueIdRef.current).catch(() => {});
    }

    setPendingUniqueId(uniqueId);
    pendingUniqueIdRef.current = uniqueId;

    setDialogOpen(true);
    setConnectionState('CREATING');
    setQrCodeDataUrl(null);
    setQrErrorMsg(null);
    setConnectedNumber(null);
    setCountdown(60);

    try {
      const response = await qrApi.reconnectInstance(uniqueId);
      if (!response.success) {
        setConnectionState('ERROR');
        setQrErrorMsg(response.msg || 'Unable to start reconnection');
        return;
      }

      setConnectionState('WAITING_FOR_QR');

      setTimeout(async () => {
        try {
          if (pendingUniqueIdRef.current !== uniqueId) return;
          const statusRes = await qrApi.getQrStatus(uniqueId);
          if (statusRes.success && statusRes.data) {
            if (statusRes.data.qr) {
              setQrCodeDataUrl(statusRes.data.qr);
              setConnectionState('QR_READY');
              setCountdown(60);
            } else if (statusRes.data.status === 'ACTIVE') {
              setConnectionState('CONNECTED');
              setConnectedNumber(statusRes.data.number || null);
              pendingUniqueIdRef.current = null;
              setPendingUniqueId(null);
              fetchInstances();
              refreshUser();
            }
          }
        } catch {
          // Socket will handle
        }
      }, 4000);
    } catch (err: any) {
      console.error('Error reconnecting instance:', err);
      setConnectionState('ERROR');
      setQrErrorMsg(err.message || 'Unable to reconnect WhatsApp. Please try again.');
    } finally {
      setIsCreatingQr(false);
    }
  };

  // Logout QR instance
  const handleLogout = async (uniqueId: string) => {
    try {
      setActionLoadingId(uniqueId);
      await qrApi.logoutInstance(uniqueId);
      toast.success('WhatsApp session logged out');
      await fetchInstances();
      refreshUser();
    } catch (err: any) {
      toast.error(err.message || 'Failed to logout instance');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete QR instance permanently
  const handleDeleteConfirm = async () => {
    if (!instanceToDelete) return;
    const uniqueId = instanceToDelete.uniqueId;
    try {
      setActionLoadingId(uniqueId);
      await qrApi.deleteInstance(uniqueId);
      toast.success('WhatsApp connection removed');
      setInstanceToDelete(null);
      await fetchInstances();
      refreshUser();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete instance');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Launch Meta Embedded Signup Flow ───────────────────────────────────
  const handleStartMetaSignup = async () => {
    if (!metaPublicConfig?.configured || !metaPublicConfig.embed_app_id || !metaPublicConfig.embed_app_config) {
      toast.error('Meta WhatsApp is not configured yet. Please contact your administrator.');
      return;
    }

    setMetaDialogOpen(true);
    setMetaState('LAUNCHING');
    setMetaErrorMsg(null);

    try {
      setMetaState('EMBEDDED_SIGNUP');

      const result = await launchEmbeddedSignup({
        appId: metaPublicConfig.embed_app_id,
        configId: metaPublicConfig.embed_app_config,
        graphVersion: metaPublicConfig.graph_version || 'v21.0',
      });

      setMetaState('PROCESSING');

      const exchangeRes = await metaApi.exchangeEmbedToken({
        authCode: result.authCode,
        wabaId: result.wabaId,
        phoneNumId: result.phoneNumId,
        businessId: result.businessId,
        isCoexistence: result.isCoexistence,
      });

      if (exchangeRes.success) {
        setMetaState('CONNECTED');
        toast.success('WhatsApp Business Account linked successfully!');
        await fetchMetaConnection();
        refreshUser();
      } else {
        setMetaState('ERROR');
        setMetaErrorMsg(exchangeRes.msg || 'Token exchange failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Meta signup error:', err);
      if (err.message && (err.message.includes('cancelled') || err.message.includes('closed'))) {
        setMetaState('CANCELLED');
      } else {
        setMetaState('ERROR');
        setMetaErrorMsg(err.message || 'We could not complete the WhatsApp connection. Please try again.');
      }
    }
  };

  // Disconnect Meta Account
  const handleMetaDisconnectConfirm = async () => {
    try {
      setMetaDisconnecting(true);
      const res = await metaApi.disconnect();
      if (res.success) {
        toast.success('WhatsApp Business disconnected');
        setShowMetaDisconnectDialog(false);
        await fetchMetaConnection();
        refreshUser();
      } else {
        toast.error(res.msg || 'Failed to disconnect');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect WhatsApp Business');
    } finally {
      setMetaDisconnecting(false);
    }
  };

  // Plan limit calculation
  const planQrLimit = Number((user?.plan as any)?.qr_account || 1);
  const isLimitReached = instances.length >= planQrLimit;

  // Extract phone display from Meta connection embed_data if available
  const getMetaPhoneDisplay = () => {
    if (!metaConnection) return null;
    let details: any = null;
    if (typeof metaConnection.embed_data === 'string') {
      try {
        details = JSON.parse(metaConnection.embed_data);
      } catch {
        details = null;
      }
    } else {
      details = metaConnection.embed_data;
    }
    const phone = details?.phoneDetails?.display_phone_number || details?.phoneNumId || metaConnection.business_phone_number_id;
    return phone || 'Connected';
  };

  const hasAnyConnections = instances.length > 0 || !!metaConnection;

  return (
    <div className="space-y-8 max-w-6xl">
      <DashboardPageHeader
        title="WhatsApp Connections & Channels"
        description="Manage your WhatsApp accounts, link official Meta Cloud API WABA or Baileys QR instances, and view channel health."
        breadcrumbs={[{ title: 'Integrations' }]}
      />

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Connected WhatsApp Accounts
            </h2>
            <p className="text-xs text-muted-foreground">
              Active sessions receiving chats and processing automated campaigns.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-normal">
              {instances.length} / {planQrLimit} QR account{planQrLimit > 1 ? 's' : ''}
              {metaConnection ? ' · 1 Meta Cloud API' : ''}
            </Badge>

            <Button
              onClick={handleStartQrConnection}
              disabled={isLimitReached || isCreatingQr}
              size="sm"
              className="gap-1.5"
            >
              {isCreatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{isCreatingQr ? 'Creating...' : 'Connect WhatsApp'}</span>
            </Button>
          </div>
        </div>

        {isLimitReached && (
          <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs">
              Your current subscription plan allows {planQrLimit} WhatsApp QR connection{planQrLimit > 1 ? 's' : ''}.
              To connect additional QR numbers, upgrade your plan or connect an official WhatsApp Business Account via Meta Cloud API.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {(loadingInstances || loadingMeta) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="border shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent className="p-5 pt-0 pb-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
                <CardFooter className="p-5 pt-0 flex justify-end gap-2 border-t">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loadingInstances && instanceError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{instanceError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInstances}
                className="gap-1.5 shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loadingInstances && !loadingMeta && !hasAnyConnections && (
          <Card className="border shadow-xs">
            <CardContent className="p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">No WhatsApp accounts connected</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Connect your WhatsApp number using mobile QR scanner or link your official Meta WhatsApp Business Account to start sending campaigns and automating chats.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Button
                  onClick={handleStartQrConnection}
                  className="gap-2 text-xs"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Connect with QR</span>
                </Button>
                <Button
                  onClick={handleStartMetaSignup}
                  variant="outline"
                  className="gap-2 text-xs"
                >
                  <Cloud className="h-4 w-4" />
                  <span>Connect with Meta</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected Accounts List */}
        {!loadingInstances && !loadingMeta && hasAnyConnections && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Meta WhatsApp Business Card (if connected) */}
            {metaConnection && (
              <Card className="border border-border shadow-xs bg-card">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold truncate flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span>WhatsApp Business</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Meta Cloud API · {metaConnection.login_type === 'embed' ? 'Embedded Signup' : 'Direct API'}
                      </CardDescription>
                    </div>

                    <Badge
                      variant="default"
                      className="text-[11px] font-medium gap-1.5 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-600 text-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      <span>● Connected</span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 pb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-mono text-foreground font-medium">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span>{getMetaPhoneDisplay()}</span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 font-mono">
                    <div className="truncate">
                      WABA: {metaConnection.waba_id ? `••••${metaConnection.waba_id.slice(-6)}` : 'Active'}
                    </div>
                    <div className="truncate text-[11px]">
                      Phone ID: {metaConnection.business_phone_number_id ? `••••${metaConnection.business_phone_number_id.slice(-6)}` : 'Active'}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-3 px-5 border-t bg-muted/20 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Meta Cloud</span>
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMetaDisconnectDialog(true)}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2.5"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>Disconnect</span>
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* 2. QR Instances Cards */}
            {instances.map((inst) => {
              const isConnected = inst.status === 'ACTIVE';
              const isBusy = actionLoadingId === inst.uniqueId;

              return (
                <Card
                  key={inst.id || inst.uniqueId}
                  className={`border shadow-xs transition-colors ${
                    isConnected ? 'border-border' : 'border-dashed border-muted-foreground/30'
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold truncate flex items-center gap-1.5">
                          {inst.title || 'WhatsApp Account'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          WhatsApp Web / Baileys
                        </CardDescription>
                      </div>

                      <Badge
                        variant={isConnected ? 'default' : 'secondary'}
                        className={`text-[11px] font-medium gap-1.5 px-2 py-0.5 ${
                          isConnected
                            ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isConnected ? 'bg-white animate-pulse' : 'bg-muted-foreground'
                          }`}
                        />
                        <span>{isConnected ? '● Connected' : '○ Disconnected'}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 pb-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-mono text-foreground font-medium">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span>{inst.number ? `+${inst.number.replace(/^\+/, '')}` : 'Phone not synced'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Created {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : 'recently'}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 px-5 border-t bg-muted/20 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">
                      ID: {inst.uniqueId.slice(-8)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isConnected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleLogout(inst.uniqueId)}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Logout</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy || isCreatingQr}
                          onClick={() => handleReconnect(inst.uniqueId)}
                          className="h-8 text-xs gap-1 px-2.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Reconnect</span>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setInstanceToDelete(inst)}
                        className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Connection Methods Showcase */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Connection Methods
          </h2>
          <p className="text-xs text-muted-foreground">
            Select the architecture that fits your team&apos;s messaging requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method 1: QR Code */}
          <Card className="border shadow-xs hover:border-primary/50 transition-colors">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <QrCode className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">
                  Ready to Connect
                </Badge>
              </div>
              <CardTitle className="text-base font-semibold pt-2">
                WhatsApp Web (QR Scanner)
              </CardTitle>
              <CardDescription className="text-xs">
                Scan with any standard or WhatsApp Business phone number using Baileys multi-device protocol. No Meta verification required.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 pb-4 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Instant 30-second setup with any existing SIM</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Supports inbox chats, voice notes, media & auto-replies</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Multi-account support under your active subscription</span>
              </div>
            </CardContent>

            <CardFooter className="p-5 pt-0">
              <Button
                onClick={handleStartQrConnection}
                disabled={isLimitReached || isCreatingQr}
                variant="outline"
                className="w-full gap-2 text-xs"
              >
                {isCreatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                <span>{isLimitReached ? 'Plan Limit Reached' : isCreatingQr ? 'Initializing...' : 'Connect with QR Code'}</span>
              </Button>
            </CardFooter>
          </Card>

          {/* Method 2: Meta Cloud API */}
          <Card className="border shadow-xs hover:border-primary/50 transition-colors">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Cloud className="h-5 w-5" />
                </div>
                <Badge
                  variant={metaConnection ? 'default' : metaPublicConfig?.configured ? 'outline' : 'secondary'}
                  className="text-[11px] font-normal"
                >
                  {metaConnection
                    ? 'Connected'
                    : metaPublicConfig?.configured
                    ? 'Ready to Connect'
                    : 'Admin Setup Required'}
                </Badge>
              </div>
              <CardTitle className="text-base font-semibold pt-2">
                Meta Cloud API (Official Business)
              </CardTitle>
              <CardDescription className="text-xs">
                Official Meta Embedded Signup for high-volume corporate broadcasts, green-tick verified numbers, and direct Meta infrastructure.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 pb-4 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Unlimited tier messaging scalability via Meta CDN</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Official Meta verified green checkmark badge eligibility</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Direct integration with Meta template approval engine</span>
              </div>
            </CardContent>

            <CardFooter className="p-5 pt-0">
              {metaConnection ? (
                <Button
                  disabled
                  variant="outline"
                  className="w-full gap-2 text-xs border-emerald-500/30 text-emerald-600"
                >
                  <Check className="h-4 w-4" />
                  <span>WhatsApp Business Connected</span>
                </Button>
              ) : (
                <Button
                  onClick={handleStartMetaSignup}
                  disabled={!metaPublicConfig?.configured}
                  className="w-full gap-2 text-xs"
                >
                  <Cloud className="h-4 w-4" />
                  <span>
                    {metaPublicConfig?.configured
                      ? 'Connect with Meta'
                      : 'Meta Not Configured by Admin'}
                  </span>
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ── QR Code Connection Modal Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCancelPending();
        }
      }}>
        <DialogContent className="sm:max-w-md md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <span>Connect WhatsApp with QR Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link your WhatsApp phone number to this workspace using WhatsApp Web multi-device.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            {/* 1. CREATING / WAITING FOR QR */}
            {(connectionState === 'CREATING' || connectionState === 'WAITING_FOR_QR') && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">
                    {connectionState === 'CREATING'
                      ? 'Creating WhatsApp connection...'
                      : 'Generating secure QR code...'}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Initializing Baileys multi-device encryption keys. This usually takes 3 to 6 seconds.
                  </p>
                </div>
                <Button
                  onClick={handleCancelPending}
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* 2. QR READY / SCANNING */}
            {connectionState === 'QR_READY' && qrCodeDataUrl && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-white dark:bg-white/5 space-y-3">
                    <div className="relative p-2 bg-white rounded-lg shadow-xs border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeDataUrl}
                        alt="WhatsApp Web QR Code"
                        className="w-52 h-52 object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between w-full px-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Waiting for scan...</span>
                      </span>

                      <span className="font-mono text-muted-foreground">
                        Expires in {countdown}s
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Open WhatsApp on your phone
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Follow these steps to connect your device:
                      </p>
                    </div>

                    <ol className="space-y-2.5 text-xs text-foreground/90 font-medium list-decimal list-inside pl-1">
                      <li className="leading-snug">
                        <span className="text-foreground">Open WhatsApp</span> on your mobile phone
                      </li>
                      <li className="leading-snug">
                        Tap <span className="font-semibold text-foreground">Menu (⋮)</span> or <span className="font-semibold text-foreground">Settings</span>
                      </li>
                      <li className="leading-snug">
                        Select <span className="font-semibold text-foreground">Linked Devices</span>
                      </li>
                      <li className="leading-snug">
                        Tap <span className="font-semibold text-foreground">Link a Device</span>
                      </li>
                      <li className="leading-snug">
                        Point your phone&apos;s camera at this QR code
                      </li>
                    </ol>

                    <div className="p-3 rounded-lg bg-muted/50 border text-[11px] text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>
                        End-to-end encrypted session. Your messages are processed directly through your private instance.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button
                    onClick={handleCancelPending}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel Connection
                  </Button>
                </div>
              </div>
            )}

            {/* 3. CONNECTING */}
            {connectionState === 'CONNECTING' && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">QR Code Scanned!</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Establishing authenticated Baileys session with WhatsApp servers...
                  </p>
                </div>
              </div>
            )}

            {/* 4. CONNECTED */}
            {connectionState === 'CONNECTED' && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-base text-foreground">
                    ✓ WhatsApp Connected
                  </h4>
                  {connectedNumber && (
                    <p className="text-sm font-mono font-medium text-foreground">
                      +{connectedNumber.replace(/^\+/, '')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Your WhatsApp number has been successfully linked. Incoming messages and campaigns are now active.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    setConnectionState('IDLE');
                  }}
                  className="mt-2"
                >
                  Done
                </Button>
              </div>
            )}

            {/* 5. EXPIRED */}
            {connectionState === 'EXPIRED' && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">QR Code Expired</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    For your security, WhatsApp QR codes expire after 60 seconds. Click below to generate a fresh QR code.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStartQrConnection}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh QR Code</span>
                  </Button>
                  <Button
                    onClick={handleCancelPending}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* 6. ERROR */}
            {connectionState === 'ERROR' && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-destructive">
                    Connection Error
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {qrErrorMsg || 'Unable to complete WhatsApp connection. Please try again.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStartQrConnection}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Try Again</span>
                  </Button>
                  <Button
                    onClick={handleCancelPending}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Meta Embedded Signup Modal Dialog ───────────────────────────── */}
      <Dialog open={metaDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setMetaDialogOpen(false);
          setMetaState('IDLE');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <span>Connect WhatsApp Business (Meta)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link your official WhatsApp Business Account via Meta Embedded Signup.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* LAUNCHING / EMBEDDED SIGNUP */}
            {(metaState === 'LAUNCHING' || metaState === 'EMBEDDED_SIGNUP') && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">
                    {metaState === 'LAUNCHING' ? 'Opening Meta Business setup...' : 'Connecting to Meta...'}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Please complete the business verification and phone number selection in the Meta popup window.
                  </p>
                </div>
                <div className="p-3 bg-muted/50 border rounded-lg text-[11px] text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-primary" />
                  <span>If a popup window didn&apos;t appear, please allow popups in your browser address bar.</span>
                </div>
              </div>
            )}

            {/* PROCESSING */}
            {metaState === 'PROCESSING' && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Finishing WhatsApp connection...</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Exchanging credentials with Meta Graph API and subscribing webhooks. This may take a few seconds.
                  </p>
                </div>
              </div>
            )}

            {/* CONNECTED */}
            {metaState === 'CONNECTED' && (
              <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-base text-foreground">
                    ✓ WhatsApp Business Connected
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Your official Meta WhatsApp Business Account and phone number have been linked successfully.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setMetaDialogOpen(false);
                    setMetaState('IDLE');
                  }}
                  className="mt-2 text-xs"
                >
                  Done
                </Button>
              </div>
            )}

            {/* CANCELLED */}
            {metaState === 'CANCELLED' && (
              <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Meta Setup Cancelled</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    The Meta setup popup was closed. Your WhatsApp Business account was not connected.
                  </p>
                </div>
                <Button
                  onClick={handleStartMetaSignup}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </Button>
              </div>
            )}

            {/* ERROR */}
            {metaState === 'ERROR' && (
              <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-destructive">Connection Failed</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {metaErrorMsg || 'We could not complete the WhatsApp Business connection. Please try again.'}
                  </p>
                </div>
                <Button
                  onClick={handleStartMetaSignup}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Disconnect Meta Confirmation Dialog ─────────────────────────── */}
      <AlertDialog
        open={showMetaDisconnectDialog}
        onOpenChange={setShowMetaDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect WhatsApp Business?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will remove the Meta Cloud API connection and WABA credentials from this workspace. You will need to complete Embedded Signup again to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={metaDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMetaDisconnectConfirm}
              disabled={metaDisconnecting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {metaDisconnecting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Disconnecting...</span>
                </span>
              ) : (
                <span>Disconnect</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete QR Confirmation Dialog ───────────────────────────────── */}
      <AlertDialog
        open={!!instanceToDelete}
        onOpenChange={(open) => {
          if (!open) setInstanceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove WhatsApp account?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will disconnect the WhatsApp session and permanently remove{' '}
              <span className="font-semibold text-foreground">
                {instanceToDelete?.number ? `+${instanceToDelete.number}` : instanceToDelete?.title || 'this account'}
              </span>{' '}
              from your workspace. You will need to scan the QR code again to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoadingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!!actionLoadingId}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {actionLoadingId ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Removing...</span>
                </span>
              ) : (
                <span>Remove</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
