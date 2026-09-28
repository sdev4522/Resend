'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api/client';
import { qrApi } from '@/lib/api/qr';
import { metaApi } from '@/lib/api/meta';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Smartphone,
  Users,
  Sparkles,
  Loader2,
  AlertCircle,
  QrCode,
  RefreshCw,
  Minus,
  Check,
} from 'lucide-react';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type WhatsAppConnectionStatus = 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'SKIPPED';

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1: Workspace Profile State
  const [workspaceName, setWorkspaceName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Step 2: WhatsApp Channel Real State
  const [waStatus, setWaStatus] = useState<WhatsAppConnectionStatus>('NOT_CONNECTED');
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waProvider, setWaProvider] = useState<string>('Baileys Web QR');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrUniqueId, setQrUniqueId] = useState<string | null>(null);
  const [qrPollTimer, setQrPollTimer] = useState<NodeJS.Timeout | null>(null);

  // Step 3: Team Agent Setup
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentMobile, setAgentMobile] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [agentCount, setAgentCount] = useState<number>(1);

  const activePollingRef = useRef<boolean>(false);

  // Authoritatively check backend connection state
  const checkRealConnection = useCallback(async () => {
    try {
      // 1. Check QR Instances
      const qrRes = await api.get<{ success?: boolean; data?: any[] }>('qr/get_all').catch(() => null);
      if (qrRes && qrRes.data && Array.isArray(qrRes.data)) {
        const active = qrRes.data.find((inst: any) => inst.status === 'ACTIVE');
        if (active) {
          setWaStatus('CONNECTED');
          setWaPhone(active.number || 'Active Phone');
          setWaProvider('WhatsApp Web (Baileys)');
          return true;
        }
      }

      // 2. Check Meta Cloud API
      const metaRes = await metaApi.getConnection().catch(() => null);
      if (metaRes && metaRes.data && (metaRes.data.waba_id || metaRes.data.business_phone_number_id)) {
        setWaStatus('CONNECTED');
        setWaPhone(metaRes.data.business_phone_number_id || 'Meta Cloud');
        setWaProvider('Meta Cloud API');
        return true;
      }

      // If neither is active, state is NOT_CONNECTED
      return false;
    } catch {
      return false;
    }
  }, []);

  // Initialize from user state
  useEffect(() => {
    if (user) {
      if (user.name) setWorkspaceName(user.name);
      const existingPhone = user.mobile_with_country_code || user.phone || '';
      if (existingPhone) setPhone(existingPhone);
      if (user.timezone) {
        setTimezone(user.timezone);
        setCurrentStep((prev) => (prev === 1 ? 2 : prev));
      }
    }
  }, [user]);

  // Initial WhatsApp status check
  useEffect(() => {
    checkRealConnection();
  }, [checkRealConnection]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      activePollingRef.current = false;
      if (qrPollTimer) clearInterval(qrPollTimer);
    };
  }, [qrPollTimer]);

  // Handler: Save Workspace Profile (Step 1)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || !phone.trim() || !timezone) {
      setError('Please fill in all workspace profile fields');
      return;
    }

    if (!/^\+[0-9]{8,16}$/.test(phone.trim())) {
      setError('Please provide a valid WhatsApp phone number with country calling code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post('user/update_profile', {
        name: workspaceName.trim(),
        email: user?.email,
        mobile_with_country_code: phone.trim(),
        timezone,
      });

      await refreshUser();
      setSuccessMsg('Workspace profile configured successfully');
      setTimeout(() => {
        setSuccessMsg(null);
        setCurrentStep(2);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace profile');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Start QR Code Connection (Step 2)
  const handleStartQrConnection = async () => {
    setError(null);
    setLoading(true);
    setWaStatus('CONNECTING');
    setQrCodeDataUrl(null);

    const generatedId = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setQrUniqueId(generatedId);
    activePollingRef.current = true;

    try {
      const genRes = await qrApi.generateQr({
        title: `Setup ${workspaceName || 'WhatsApp'}`,
        uniqueId: generatedId,
      });

      if (!genRes.success && (genRes as any).msg) {
        setWaStatus('ERROR');
        setError((genRes as any).msg || 'Failed to initialize WhatsApp connection session');
        return;
      }

      // Begin polling for QR code and ACTIVE status
      let pollCount = 0;
      const interval = setInterval(async () => {
        if (!activePollingRef.current) {
          clearInterval(interval);
          return;
        }

        pollCount++;
        if (pollCount > 40) {
          // Timeout after 2 minutes
          clearInterval(interval);
          activePollingRef.current = false;
          setWaStatus('ERROR');
          setError('QR code expired. Please refresh to try again.');
          return;
        }

        try {
          const statusRes = await qrApi.getQrStatus(generatedId);
          if (statusRes.success && statusRes.data) {
            if (statusRes.data.status === 'ACTIVE') {
              clearInterval(interval);
              activePollingRef.current = false;
              setWaStatus('CONNECTED');
              setWaPhone(statusRes.data.number || null);
              setWaProvider('WhatsApp Web (Baileys)');
              await refreshUser();
              return;
            }

            if (statusRes.data.qr) {
              setQrCodeDataUrl(statusRes.data.qr);
            }
          }
        } catch {
          // Non-blocking poll attempt
        }
      }, 3000);

      setQrPollTimer(interval);
    } catch (err: any) {
      setWaStatus('ERROR');
      setError(err.message || 'Unable to initialize WhatsApp session');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Skip WhatsApp Connection (Step 2)
  const handleSkipWhatsApp = () => {
    activePollingRef.current = false;
    if (qrPollTimer) clearInterval(qrPollTimer);
    if (qrUniqueId) {
      qrApi.cancelPending(qrUniqueId).catch(() => {});
    }
    setWaStatus('SKIPPED');
    setCurrentStep(3);
  };

  // Handler: Refresh QR code
  const handleRefreshQr = () => {
    activePollingRef.current = false;
    if (qrPollTimer) clearInterval(qrPollTimer);
    if (qrUniqueId) {
      qrApi.cancelPending(qrUniqueId).catch(() => {});
    }
    handleStartQrConnection();
  };

  // Handler: Invite Agent (Step 3)
  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName || !agentEmail || !agentMobile || !agentPassword) {
      setError('Please provide all agent details or click Skip');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post('agent/add_agent', {
        name: agentName.trim(),
        email: agentEmail.trim().toLowerCase(),
        mobile: agentMobile.trim(),
        password: agentPassword,
      });

      setAgentCount(2);
      setSuccessMsg('Team member invited successfully');
      setTimeout(() => {
        setSuccessMsg(null);
        setCurrentStep(4);
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Failed to invite agent. You can skip this step and invite later.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Skip Team Agent (Step 3)
  const handleSkipAgent = () => {
    setCurrentStep(4);
  };

  // Handler: Finish Onboarding (Step 4)
  const handleFinish = async () => {
    setLoading(true);
    await refreshUser();
    router.push('/dashboard');
  };

  const steps = [
    { num: 1, title: 'Workspace Profile', icon: Building2 },
    { num: 2, title: 'WhatsApp Channel', icon: Smartphone },
    { num: 3, title: 'Team Setup', icon: Users },
    { num: 4, title: 'Ready to Launch', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {/* Stepper Progress Bar */}
      <div className="flex items-center justify-between px-2 sm:px-4">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isCompleted = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          let stepBadgeText = s.title;
          if (s.num === 2 && waStatus === 'SKIPPED') {
            stepBadgeText = 'WhatsApp (Skipped)';
          }

          return (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'border-2 border-emerald-600 bg-emerald-500/10 text-emerald-600'
                    : 'border bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className="hidden md:inline-block text-xs font-medium text-foreground">
                {stepBadgeText}
              </span>
              {idx < steps.length - 1 && (
                <div
                  className={`hidden sm:block h-0.5 w-10 md:w-16 ${
                    currentStep > s.num ? 'bg-emerald-600' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* STEP 1: Workspace Profile */}
      {currentStep === 1 && (
        <Card className="shadow-lg border-border/80">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Set up your workspace</CardTitle>
            <CardDescription className="text-xs">
              Confirm your workspace name and primary operating timezone for scheduled campaigns.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSaveProfile}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="wsName" className="text-xs font-semibold">
                  Business or Workspace Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wsName"
                  placeholder="e.g. Acme Marketing"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={loading}
                  className="h-10 text-sm"
                />
              </div>

              {/* Standardized Phone Input (+91 default, prefilled from signup) */}
              <PhoneInput
                id="wsPhone"
                label="Primary Contact Phone (WhatsApp)"
                required
                value={phone}
                onChange={setPhone}
                disabled={loading}
              />

              <div className="space-y-1.5 text-start">
                <Label htmlFor="tz" className="text-xs font-semibold">
                  Operating Timezone <span className="text-destructive">*</span>
                </Label>
                <select
                  id="tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button
                type="submit"
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Continue to WhatsApp Setup</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* STEP 2: WhatsApp Channel Connection */}
      {currentStep === 2 && (
        <Card className="shadow-lg border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Connect WhatsApp Channel</CardTitle>
              <Badge
                variant={waStatus === 'CONNECTED' ? 'default' : 'secondary'}
                className={
                  waStatus === 'CONNECTED'
                    ? 'bg-emerald-600 text-white text-xs'
                    : 'text-xs'
                }
              >
                {waStatus === 'CONNECTED'
                  ? 'Connected'
                  : waStatus === 'CONNECTING'
                  ? 'Waiting for Scan'
                  : waStatus === 'SKIPPED'
                  ? 'Skipped'
                  : 'Not Connected'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Link a WhatsApp number to send broadcasts, manage inbox conversations, and automate customer responses.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* STATE 1: ALREADY CONNECTED (Backend Verified) */}
            {waStatus === 'CONNECTED' && (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div className="h-12 w-12 rounded-full bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="h-6 w-6" />
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2 justify-center sm:justify-start">
                    <span>WhatsApp Connected</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Active
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono">
                    {waPhone ? waPhone : 'Connected Device'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Provider: {waProvider}
                  </p>
                </div>
              </div>
            )}

            {/* STATE 2: NOT CONNECTED (Choice screen) */}
            {waStatus === 'NOT_CONNECTED' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">Option 1: WhatsApp Web QR (Instant)</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Link your WhatsApp number instantly using Linked Devices on your phone.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleStartQrConnection}
                    disabled={loading}
                    className="w-full sm:w-auto h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                    <span>Generate QR Code</span>
                  </Button>
                </div>

                <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">Option 2: Meta Cloud API</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Use official Meta WhatsApp Business API. You can configure Meta credentials anytime inside Settings &rarr; Integrations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STATE 3: CONNECTING (Real QR display + instructions) */}
            {waStatus === 'CONNECTING' && (
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-xl border bg-muted/20">
                <div className="h-44 w-44 rounded-xl border bg-white flex flex-col items-center justify-center p-2 text-center shrink-0 shadow-sm relative">
                  {qrCodeDataUrl ? (
                    <Image
                      src={qrCodeDataUrl}
                      alt="WhatsApp Web QR Code"
                      width={160}
                      height={160}
                      unoptimized
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                      <span className="text-[11px] text-muted-foreground font-medium">Generating QR...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs flex-1 text-start">
                  <h4 className="font-bold text-foreground text-sm">Scan with your phone</h4>
                  <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside leading-relaxed text-xs">
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Menu</strong> or <strong>Settings</strong> &rarr; <strong>Linked Devices</strong></li>
                    <li>Tap <strong>Link a Device</strong> and point your camera here</li>
                  </ol>

                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshQr}
                      className="h-8 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Refresh QR</span>
                    </Button>
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                      Listening for scan...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STATE 4: ERROR */}
            {waStatus === 'ERROR' && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3 text-start">
                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Connection attempt failed</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The WhatsApp session could not be established or the QR code timed out.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartQrConnection}
                    className="h-8 text-xs"
                  >
                    Retry QR Connection
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="h-10 text-xs"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {waStatus !== 'CONNECTED' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipWhatsApp}
                  className="h-10 text-xs text-muted-foreground hover:text-foreground"
                >
                  I will connect later
                </Button>
              )}

              <Button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2"
              >
                <span>{waStatus === 'CONNECTED' ? 'Continue' : 'Next Step'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Team Support Agent Invitation */}
      {currentStep === 3 && (
        <Card className="shadow-lg border-border/80">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Invite a team member</CardTitle>
            <CardDescription className="text-xs">
              Multiple agents can respond to customer inquiries from your WhatsApp channel. (Optional)
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAddAgent}>
            <CardContent className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                <div className="space-y-1.5">
                  <Label htmlFor="agName" className="text-xs font-semibold">Agent Name</Label>
                  <Input
                    id="agName"
                    placeholder="e.g. Sarah Connor"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agEmail" className="text-xs font-semibold">Agent Email</Label>
                  <Input
                    id="agEmail"
                    type="email"
                    placeholder="agent@company.com"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                <div className="space-y-1.5">
                  <Label htmlFor="agPhone" className="text-xs font-semibold">Mobile Number</Label>
                  <Input
                    id="agPhone"
                    placeholder="+919876543210"
                    value={agentMobile}
                    onChange={(e) => setAgentMobile(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agPass" className="text-xs font-semibold">Initial Password</Label>
                  <Input
                    id="agPass"
                    type="password"
                    placeholder="Temporary login password"
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="h-10 text-xs"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipAgent}
                  className="h-10 text-xs text-muted-foreground"
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Invite & Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* STEP 4: Ready to Launch (Accurate State Summary) */}
      {currentStep === 4 && (
        <Card className="shadow-lg border-border/80 text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-3 shadow-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold">Your workspace is ready</CardTitle>
            <CardDescription className="text-xs max-w-sm mx-auto">
              Your WaCRM account is fully set up. Here is a summary of your workspace configuration:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-w-md mx-auto text-left">
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2.5 text-xs">
              {/* Workspace */}
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Workspace:</span>
                <span className="font-semibold text-foreground">{workspaceName || 'My Workspace'}</span>
              </div>

              {/* Verified Email */}
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Email:</span>
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{user?.email || '—'}</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 px-1 py-0">
                    ✓ Verified
                  </Badge>
                </div>
              </div>

              {/* Phone */}
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono font-medium text-foreground">{phone || user?.mobile_with_country_code || '—'}</span>
              </div>

              {/* WhatsApp Status */}
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">WhatsApp:</span>
                {waStatus === 'CONNECTED' ? (
                  <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    <span>Connected {waPhone ? `(${waPhone})` : ''}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-3.5 w-3.5" />
                    <span>Not connected &bull; Connect anytime in Integrations</span>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Team:</span>
                <span className="font-semibold text-foreground">
                  {agentCount > 1 ? `${agentCount} members` : '1 member (Owner)'}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pt-2">
            <Button
              onClick={handleFinish}
              className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-500/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span>Go to Dashboard</span>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
