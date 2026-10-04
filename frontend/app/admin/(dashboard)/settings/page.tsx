'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Loader2,
  RefreshCw,
  Cloud,
  CreditCard,
  Copy,
  Check,
  Webhook,
  Coins,
  Globe,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  Mail,
  Bell,
  Send,
  Palette,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { SupportedCurrencyItem } from '@/lib/api/admin';
import { useGlobalTheme } from '@/components/providers/theme-provider';


const CURRENCY_PRESETS = [
  { code: "USD", symbol: "$", name: "US Dollar", rate: 1.0 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", rate: 83.5 },
  { code: "EUR", symbol: "€", name: "Euro", rate: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", rate: 0.79 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rate: 3.67 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", rate: 1.36 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", rate: 1.52 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", rate: 1.34 },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('razorpay');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Meta settings states
  const [appId, setAppId] = useState('');
  const [configId, setConfigId] = useState('');
  const [graphVersion, setGraphVersion] = useState('v21.0');
  const [appSecret, setAppSecret] = useState('');
  const [hasAppSecret, setHasAppSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Razorpay settings states
  const [rzId, setRzId] = useState('');
  const [rzKey, setRzKey] = useState('');
  const [hasRzKey, setHasRzKey] = useState(false);
  const [showRzKey, setShowRzKey] = useState(false);
  const [rzActive, setRzActive] = useState(true);
  const [rzWebhookSecret, setRzWebhookSecret] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Currency settings states
  const [baseCurrencyCode, setBaseCurrencyCode] = useState("USD");
  const [baseCurrencySymbol, setBaseCurrencySymbol] = useState("$");
  const [baseExchangeRate, setBaseExchangeRate] = useState<number>(1);
  const [roundingMode, setRoundingMode] = useState<string>("smart_saas");
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrencyItem[]>([]);
  const [savingCurrency, setSavingCurrency] = useState(false);

  // SMTP settings states
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [hasSmtpPass, setHasSmtpPass] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // Platform branding states
  const [appName, setAppName] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  // FCM states
  const [fcmKey, setFcmKey] = useState('');
  const [savingFcm, setSavingFcm] = useState(false);

  // Global theme settings states
  const { reloadTheme, applyPreview, resetToDefault } = useGlobalTheme();
  const [themePresets, setThemePresets] = useState<Array<{ id: string; name: string; description: string; isProtected: boolean; isActive: boolean }>>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('default');
  const [themePrimary, setThemePrimary] = useState<string>('#6366f1');
  const [themeSecondary, setThemeSecondary] = useState<string>('#4f46e5');
  const [themeAccent, setThemeAccent] = useState<string>('#ec4899');
  const [themeRadius, setThemeRadius] = useState<string>('0.625rem');
  const [savingTheme, setSavingTheme] = useState<boolean>(false);
  const [resettingTheme, setResettingTheme] = useState<boolean>(false);

  // Fetch current admin settings
  const fetchSettings = async () => {
    try {
      setLoading(true);

      // 1. Meta settings
      const metaRes = await adminApi.getMetaConfig();
      if (metaRes.success && metaRes.data) {
        setAppId(metaRes.data.appId || '');
        setConfigId(metaRes.data.configId || '');
        setGraphVersion(metaRes.data.graphVersion || 'v21.0');
        setHasAppSecret(Boolean(metaRes.data.hasAppSecret));
        setAppSecret('');
      }

      // 2. Razorpay settings
      const rzRes = await adminApi.getRazorpaySettings();
      if (rzRes.success && rzRes.data) {
        setRzId(rzRes.data.rz_id || '');
        setRzActive(Boolean(rzRes.data.rz_active));
        setHasRzKey(Boolean(rzRes.data.has_rz_key));
        setRzWebhookSecret(rzRes.data.rz_webhook_secret || '');
        setRzKey('');
      }

      // 3. Currency settings
      const currRes = await adminApi.getCurrencySettings();
      if (currRes.success && currRes.data) {
        setBaseCurrencyCode(currRes.data.baseCode || "USD");
        setBaseCurrencySymbol(currRes.data.baseSymbol || "$");
        setBaseExchangeRate(currRes.data.baseExchangeRate || 1);
        if (currRes.data.roundingMode) setRoundingMode(currRes.data.roundingMode);
        setSupportedCurrencies(currRes.data.supportedCurrencies || []);
      }

      // 4. SMTP settings
      const smtpRes = await adminApi.getSmtp();
      if (smtpRes.success && smtpRes.data) {
        setSmtpHost(smtpRes.data.host || '');
        setSmtpPort(Number(smtpRes.data.port) || 587);
        setSmtpUser(smtpRes.data.username || '');
        setHasSmtpPass(Boolean(smtpRes.data.password && smtpRes.data.password !== ''));
        setSmtpFromEmail(smtpRes.data.from_email || smtpRes.data.email || '');
        setSmtpFromName(smtpRes.data.from_name || '');
        setSmtpSecure(Boolean(smtpRes.data.secure) || Number(smtpRes.data.port) === 465);
      }

      // 5. Branding settings
      const webRes = await adminApi.getWebPublic();
      if (webRes.success && webRes.data) {
        setAppName(webRes.data.app_name || 'Resend');
        setMetaDescription(webRes.data.meta_description || '');
        setSiteLogo(webRes.data.logo || '');
      }

      // 6. FCM settings
      const fcmRes = await adminApi.getFcmData();
      if (fcmRes.success && fcmRes.data) {
        setFcmKey(fcmRes.data.server_key || '');
      }

      // 7. Global Theme settings
      try {
        const themeListRes = await adminApi.listThemes();
        if (themeListRes.success && Array.isArray(themeListRes.data)) {
          setThemePresets(themeListRes.data);
          const activeTheme = themeListRes.data.find((t) => t.isActive);
          if (activeTheme) {
            setSelectedPresetId(activeTheme.id);
          }
        }
        const activeThemeRes = await adminApi.getThemeConfig();
        if (activeThemeRes.success && activeThemeRes.data) {
          const cfg = activeThemeRes.data;
          if (cfg.brandColors?.primary || cfg.primary_light) {
            setThemePrimary(cfg.brandColors?.primary || cfg.primary_light);
          }
          if (cfg.brandColors?.secondary || cfg.secondary_light) {
            setThemeSecondary(cfg.brandColors?.secondary || cfg.secondary_light);
          }
          if (cfg.brandColors?.accent || cfg.accent_light) {
            setThemeAccent(cfg.brandColors?.accent || cfg.accent_light);
          }
          const rad = cfg.radius ?? cfg.card?.borderRadius ?? cfg.button?.contained?.borderRadius;
          if (rad !== undefined) {
            setThemeRadius(typeof rad === 'number' ? `${rad}px` : String(rad));
          }
        }
      } catch {
        // theme fetch fallback
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchSettings();
  }, []);


  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCurrency(true);
      const res = await adminApi.updateCurrencySettings({
        baseCode: baseCurrencyCode.trim().toUpperCase(),
        baseSymbol: baseCurrencySymbol.trim(),
        baseExchangeRate: Number(baseExchangeRate) || 1,
        roundingMode,
        supportedCurrencies,
      });

      if (res.success) {
        toast.success(res.msg || "Currency settings saved successfully!");
      } else {
        toast.error(res.msg || "Failed to save currency settings");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving currency settings");
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSelectPreset = (code: string, symbol: string, defaultRate: number) => {
    setBaseCurrencyCode(code);
    setBaseCurrencySymbol(symbol);
    setSupportedCurrencies((prev) => {
      const exists = prev.some((c) => c.code === code);
      if (!exists) {
        return [...prev, { code, symbol, rate: defaultRate, name: `${code} Currency`, enabled: true }];
      }
      return prev.map((c) => (c.code === code ? { ...c, enabled: true } : c));
    });
    toast.info(`Selected ${code} (${symbol}) as primary platform currency`);
  };

  const handleToggleCurrency = (code: string) => {
    if (code.toUpperCase() === baseCurrencyCode.toUpperCase()) {
      toast.warning("Base platform currency cannot be disabled");
      return;
    }
    setSupportedCurrencies((prev) =>
      prev.map((c) => (c.code === code ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleUpdateUsdRate = (code: string, newUsdRate: number) => {
    setSupportedCurrencies((prev) => {
      const baseItem = prev.find((c) => c.code.toUpperCase() === baseCurrencyCode.toUpperCase());
      const baseUsdRate = baseItem ? ((baseItem as any).usdRate || baseItem.rate || 1.0) : 1.0;
      return prev.map((c) => {
        if (c.code === code) {
          const relativeRate = Math.round((newUsdRate / baseUsdRate) * 10000) / 10000;
          return {
            ...c,
            usdRate: newUsdRate,
            rate: c.code.toUpperCase() === baseCurrencyCode.toUpperCase() ? 1.0 : relativeRate,
          } as any;
        }
        return c;
      });
    });
  };

  const handleResetMarketRates = () => {
    const marketRates: Record<string, number> = {
      USD: 1.0,
      INR: 85.0,
      EUR: 0.92,
      GBP: 0.79,
      AED: 3.67,
      CAD: 1.36,
      AUD: 1.52,
      SGD: 1.34,
    };
    setSupportedCurrencies((prev) =>
      prev.map((c) => {
        const usdRate = marketRates[c.code] ?? 1.0;
        const baseUsdRate = marketRates[baseCurrencyCode] ?? 1.0;
        const relativeRate = Math.round((usdRate / baseUsdRate) * 10000) / 10000;
        return {
          ...c,
          usdRate,
          rate: c.code.toUpperCase() === baseCurrencyCode.toUpperCase() ? 1.0 : relativeRate,
        } as any;
      })
    );
    toast.success("Synchronized with global market exchange rates");
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await adminApi.updateMetaConfig({
        appId: appId.trim(),
        configId: configId.trim(),
        graphVersion: graphVersion.trim() || 'v21.0',
        ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
      });

      if (res.success) {
        toast.success(res.msg || 'Meta configuration saved successfully!');
        if (appSecret.trim()) {
          setHasAppSecret(true);
          setAppSecret('');
        }
      } else {
        toast.error(res.msg || 'Failed to save Meta configuration');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving Meta settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await adminApi.updateRazorpaySettings({
        rz_id: rzId.trim(),
        rz_active: rzActive ? 1 : 0,
        rz_webhook_secret: rzWebhookSecret.trim(),
        ...(rzKey.trim() ? { rz_key: rzKey.trim() } : {}),
      });

      if (res.success) {
        toast.success(res.msg || 'Razorpay settings saved successfully!');
        if (rzKey.trim()) {
          setHasRzKey(true);
          setRzKey('');
        }
      } else {
        toast.error(res.msg || 'Failed to save Razorpay settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving Razorpay settings');
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/razorpay/webhook`
    : 'https://your-domain.com/api/webhooks/razorpay/webhook';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success('Webhook URL copied to clipboard');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSmtp(true);
      const res = await adminApi.updateSmtp({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        username: smtpUser.trim(),
        password: smtpPass.trim() || undefined,
        from_email: smtpFromEmail.trim(),
        email: smtpFromEmail.trim(),
        from_name: smtpFromName.trim() || undefined,
        secure: smtpSecure,
      });
      if (res.success) {
        toast.success(res.msg || 'SMTP configuration updated successfully!');
        if (smtpPass.trim()) {
          setHasSmtpPass(true);
          setSmtpPass('');
        }
      } else {
        toast.error(res.msg || 'Failed to update SMTP settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving SMTP configuration');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTarget.trim()) {
      toast.warning('Please enter a recipient email address for testing');
      return;
    }
    try {
      setTestEmailLoading(true);
      const res = await adminApi.sendTestEmail({
        to: testEmailTarget.trim(),
        to_email: testEmailTarget.trim(),
        host: smtpHost.trim() || undefined,
        port: Number(smtpPort) || undefined,
        username: smtpUser.trim() || undefined,
        password: smtpPass.trim() || undefined,
        from_email: smtpFromEmail.trim() || undefined,
        email: smtpFromEmail.trim() || undefined,
        from_name: smtpFromName.trim() || undefined,
        secure: smtpSecure,
      });
      if (res.success) {
        toast.success(res.msg || 'Test email successfully dispatched!');
      } else {
        toast.error(res.msg || 'Failed to send test email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error dispatching test email');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBranding(true);
      const res = await adminApi.updateWebPublic({
        app_name: appName.trim(),
        meta_description: metaDescription.trim(),
        logo: siteLogo.trim(),
      });
      if (res.success) {
        toast.success(res.msg || 'Branding configuration saved successfully!');
      } else {
        toast.error(res.msg || 'Failed to save branding');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving branding');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveFcm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingFcm(true);
      const res = await adminApi.updateFcmData({
        server_key: fcmKey.trim(),
      });
      if (res.success) {
        toast.success(res.msg || 'FCM credentials updated successfully!');
      } else {
        toast.error(res.msg || 'Failed to save FCM credentials');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving FCM credentials');
    } finally {
      setSavingFcm(false);
    }
  };

  const handleSelectThemePreset = async (presetId: string) => {
    setSelectedPresetId(presetId);
    try {
      const res = await adminApi.setActiveTheme(presetId);
      if (res.success) {
        await reloadTheme();
        const activeThemeRes = await adminApi.getThemeConfig();
        if (activeThemeRes.success && activeThemeRes.data) {
          const cfg = activeThemeRes.data;
          setThemePrimary(cfg.brandColors?.primary || cfg.primary_light || '#6366f1');
          setThemeSecondary(cfg.brandColors?.secondary || cfg.secondary_light || '#4f46e5');
          setThemeAccent(cfg.brandColors?.accent || cfg.accent_light || '#ec4899');
          const rad = cfg.radius ?? cfg.card?.borderRadius ?? cfg.button?.contained?.borderRadius;
          if (rad !== undefined) {
            setThemeRadius(typeof rad === 'number' ? `${rad}px` : String(rad));
          }
        }
        toast.success(`Theme switched to '${presetId}'`);
      } else {
        toast.error(res.msg || 'Failed to activate theme preset');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error activating theme');
    }
  };

  const handleUpdateColors = (type: 'primary' | 'secondary' | 'accent', value: string) => {
    let p = themePrimary;
    let s = themeSecondary;
    let a = themeAccent;
    if (type === 'primary') {
      p = value;
      setThemePrimary(value);
    } else if (type === 'secondary') {
      s = value;
      setThemeSecondary(value);
    } else if (type === 'accent') {
      a = value;
      setThemeAccent(value);
    }
    applyPreview({
      brandColors: { primary: p, secondary: s, accent: a },
      radius: themeRadius,
      isCustomized: true,
    });
  };

  const handleUpdateRadius = (val: string) => {
    setThemeRadius(val);
    applyPreview({
      brandColors: { primary: themePrimary, secondary: themeSecondary, accent: themeAccent },
      radius: val,
      isCustomized: true,
    });
  };

  const handleSaveThemeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingTheme(true);
      const res = await adminApi.updateBrandColors({
        primary: themePrimary,
        secondary: themeSecondary,
        accent: themeAccent,
      });
      if (res.success) {
        await adminApi.updateThemeConfig({
          brandColors: { primary: themePrimary, secondary: themeSecondary, accent: themeAccent },
          primary_light: themePrimary,
          primary_dark: themePrimary,
          secondary_light: themeSecondary,
          secondary_dark: themeSecondary,
          accent_light: themeAccent,
          accent_dark: themeAccent,
          radius: themeRadius,
          isCustomized: true,
        });
        await reloadTheme();
        toast.success('Global theme configuration saved and applied site-wide!');
      } else {
        toast.error(res.msg || 'Failed to save theme configuration');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving global theme');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleResetThemeConfig = async () => {
    try {
      setResettingTheme(true);
      const res = await adminApi.resetThemeConfig();
      if (res.success) {
        await resetToDefault();
        await reloadTheme();
        setSelectedPresetId('default');
        setThemePrimary('#6366f1');
        setThemeSecondary('#4f46e5');
        setThemeAccent('#ec4899');
        setThemeRadius('0.625rem');
        toast.success('Theme successfully reset to factory defaults');
      } else {
        toast.error(res.msg || 'Failed to reset theme');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error resetting theme');
    } finally {
      setResettingTheme(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Global System Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure system-wide SaaS integrations, Razorpay billing keys, Autopay, SMTP email, and branding.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSettings}
          disabled={loading || saving}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="theme" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Palette className="h-3.5 w-3.5 text-primary" />
            Global Theme
          </TabsTrigger>
          <TabsTrigger value="smtp" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" />
            SMTP & Email
          </TabsTrigger>
          <TabsTrigger value="branding" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Platform Branding
          </TabsTrigger>
          <TabsTrigger value="fcm" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Web Push (FCM)
          </TabsTrigger>
          <TabsTrigger value="razorpay" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            Razorpay & Autopay
          </TabsTrigger>
          <TabsTrigger value="currency" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-primary" />
            Currency
          </TabsTrigger>
          <TabsTrigger value="meta" className="text-xs gap-1.5 font-semibold px-3 py-1.5">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            Meta WhatsApp Cloud API
          </TabsTrigger>
        </TabsList>


        {/* 0. SMTP & EMAIL SETTINGS */}
        <TabsContent value="smtp">
          {loading ? (
            <Card className="shadow-xs border p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-10 w-full mt-4" />
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleSaveSmtp}>
                <Card className="shadow-xs border rounded-2xl overflow-hidden">
                  <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      SMTP Outbound Server Configuration
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Credentials used by the platform to dispatch transactional mail, password resets, and notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="smtpHost" className="text-xs font-medium">
                          SMTP Host / Server
                        </Label>
                        <Input
                          id="smtpHost"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="e.g. smtp.mailgun.org or smtp.sendgrid.net"
                          required
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPort" className="text-xs font-medium">
                          Port Number
                        </Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          placeholder="587"
                          required
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpUser" className="text-xs font-medium">
                          SMTP Username / Account
                        </Label>
                        <Input
                          id="smtpUser"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="username@domain.com"
                          required
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPass" className="text-xs font-medium flex items-center justify-between">
                          <span>SMTP Password</span>
                          {hasSmtpPass && (
                            <span className="text-[11px] text-emerald-600 font-normal">
                              Password Saved in Database
                            </span>
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            id="smtpPass"
                            type={showSmtpPass ? 'text' : 'password'}
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            placeholder={hasSmtpPass ? '•••••••••••• (Leave blank to keep current)' : 'Enter SMTP password'}
                            className="h-9 text-xs font-mono pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          >
                            {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpFromEmail" className="text-xs font-medium">
                          Sender Email Address (From)
                        </Label>
                        <Input
                          id="smtpFromEmail"
                          type="email"
                          value={smtpFromEmail}
                          onChange={(e) => setSmtpFromEmail(e.target.value)}
                          placeholder="notifications@yourdomain.com"
                          required
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpFromName" className="text-xs font-medium">
                          Sender Display Name
                        </Label>
                        <Input
                          id="smtpFromName"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                          placeholder="Resend System"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="smtpSecure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded border-input h-4 w-4 text-primary"
                      />
                      <Label htmlFor="smtpSecure" className="text-xs cursor-pointer">
                        Enable SSL / TLS encryption (port 465)
                      </Label>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>SMTP secrets are encrypted and masked before transmission.</span>
                    </span>
                    <Button
                      type="submit"
                      disabled={savingSmtp}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-8 font-semibold"
                    >
                      {savingSmtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save SMTP Settings
                    </Button>
                  </CardFooter>
                </Card>
              </form>

              {/* Test Email Card */}
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-500" />
                    Live SMTP Connection Test
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatch an instantaneous verification email to confirm server credentials and handshake.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Input
                      placeholder="Enter destination email (e.g. test@yourdomain.com)"
                      value={testEmailTarget}
                      onChange={(e) => setTestEmailTarget(e.target.value)}
                      className="h-9 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={testEmailLoading}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-9 shrink-0"
                    >
                      {testEmailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Live Test Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 0.1 PLATFORM BRANDING SETTINGS */}
        <TabsContent value="branding">
          {loading ? (
            <Card className="shadow-xs border p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ) : (
            <form onSubmit={handleSaveBranding}>
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Platform Identity & Public Branding
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure customer-facing product name, SEO description, and platform logo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="appName" className="text-xs font-medium">
                      Platform Name / Brand Title
                    </Label>
                    <Input
                      id="appName"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="Resend"
                      required
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="metaDescription" className="text-xs font-medium">
                      Meta Description (Search & Social Previews)
                    </Label>
                    <textarea
                      id="metaDescription"
                      rows={3}
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Production-grade WhatsApp CRM and Automation platform"
                      className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="siteLogo" className="text-xs font-medium">
                      Platform Logo URL
                    </Label>
                    <Input
                      id="siteLogo"
                      value={siteLogo}
                      onChange={(e) => setSiteLogo(e.target.value)}
                      placeholder="/images/logo.png or https://cdn..."
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={savingBranding}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-8 font-semibold"
                  >
                    {savingBranding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Branding
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </TabsContent>

        {/* 0.2 WEB PUSH & FCM SETTINGS */}
        <TabsContent value="fcm">
          {loading ? (
            <Card className="shadow-xs border p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ) : (
            <form onSubmit={handleSaveFcm}>
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Firebase Cloud Messaging (FCM)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Credentials for delivering background web push notifications to customer browsers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="fcmKey" className="text-xs font-medium">
                      FCM Server Key
                    </Label>
                    <textarea
                      id="fcmKey"
                      rows={4}
                      value={fcmKey}
                      onChange={(e) => setFcmKey(e.target.value)}
                      placeholder="Paste FCM Server Key or Service Account credentials..."
                      className="w-full rounded-md border border-input bg-background p-2.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={savingFcm}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-8 font-semibold"
                  >
                    {savingFcm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save FCM Credentials
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </TabsContent>

        {/* 1. RAZORPAY PAYMENT GATEWAY & AUTOPAY SETTINGS */}
        <TabsContent value="razorpay">
          {loading ? (
            <Card className="shadow-xs border">
              <CardHeader className="p-6 pb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSaveRazorpay}>
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">
                          Razorpay Payment Gateway & Autopay Configuration
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Configure production or test API keys for Razorpay checkout, recurring Autopay subscriptions, and webhook reconciliation.
                      </CardDescription>
                    </div>

                    <Badge
                      variant={rzActive && rzId ? 'default' : 'secondary'}
                      className={`text-[11px] font-medium shrink-0 ${
                        rzActive && rzId
                          ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {rzActive && rzId ? '● Enabled' : '○ Disabled'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {/* Enable Gateway Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label htmlFor="rzActive" className="text-xs font-semibold cursor-pointer">
                        Enable Razorpay Payment Gateway
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Allow users to subscribe to plans using Razorpay Checkout and recurring Autopay.
                      </p>
                    </div>
                    <input
                      id="rzActive"
                      type="checkbox"
                      checked={rzActive}
                      onChange={(e) => setRzActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  {/* Razorpay Key ID */}
                  <div className="space-y-1.5">
                    <Label htmlFor="rzId" className="text-xs font-medium">
                      Razorpay Key ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="rzId"
                      value={rzId}
                      onChange={(e) => setRzId(e.target.value)}
                      placeholder="e.g. rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                      className="font-mono text-xs"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Public Key ID found in Razorpay Dashboard under Account &amp; Settings &gt; API Keys.
                    </p>
                  </div>

                  {/* Razorpay Key Secret */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rzKey" className="text-xs font-medium">
                        Razorpay Key Secret
                      </Label>
                      {hasRzKey && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Secret stored securely on server</span>
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        id="rzKey"
                        type={showRzKey ? 'text' : 'password'}
                        value={rzKey}
                        onChange={(e) => setRzKey(e.target.value)}
                        placeholder={hasRzKey ? '•••••••••••••••••••••••••••••••• (Leave blank to keep existing)' : 'Enter Razorpay Key Secret'}
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRzKey(!showRzKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        title={showRzKey ? 'Hide secret' : 'Show secret'}
                      >
                        {showRzKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Private Key Secret used for server-side HMAC-SHA256 signature verification. Never exposed to browser clients.
                    </p>
                  </div>

                  {/* Webhook Secret */}
                  <div className="space-y-1.5">
                    <Label htmlFor="rzWebhookSecret" className="text-xs font-medium">
                      Razorpay Webhook Secret
                    </Label>
                    <Input
                      id="rzWebhookSecret"
                      value={rzWebhookSecret}
                      onChange={(e) => setRzWebhookSecret(e.target.value)}
                      placeholder="e.g. resend_rz_webhook_secret"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Secret configured when setting up the webhook in Razorpay Dashboard. Used to verify server-to-server webhook requests.
                    </p>
                  </div>

                  {/* Webhook URL Display */}
                  <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Webhook className="h-4 w-4 text-primary" />
                      Razorpay Webhook Endpoint URL
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="font-mono text-xs bg-background h-8 select-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyWebhookUrl}
                        className="h-8 text-xs gap-1.5 shrink-0"
                      >
                        {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedWebhook ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      In your Razorpay Dashboard under <strong>Settings &gt; Webhooks</strong>, add this URL and enable events:{' '}
                      <code className="text-primary font-mono font-semibold">payment.captured</code>,{' '}
                      <code className="text-primary font-mono font-semibold">subscription.charged</code>,{' '}
                      <code className="text-primary font-mono font-semibold">subscription.cancelled</code>.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Credentials are stored safely in database and server environment.</span>
                  </span>

                  <Button
                    type="submit"
                    disabled={saving}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shadow-2xs font-semibold"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Razorpay Configuration</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </TabsContent>

        {/* 2. CURRENCY & MULTI-CURRENCY SETTINGS */}
        <TabsContent value="currency">
          {loading ? (
            <Card className="shadow-xs border">
              <CardHeader className="p-6 pb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSaveCurrency} className="space-y-6">
              {/* PRIMARY CURRENCY & PRESETS */}
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">
                          Platform Base Currency & Localization
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Configure the default billing and pricing currency for all plans, invoices, and checkout transactions.
                      </CardDescription>
                    </div>

                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-mono font-bold">
                      {baseCurrencyCode} ({baseCurrencySymbol})
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Quick Preset Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Quick Preset Selector (1-Click Switch)
                    </Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {CURRENCY_PRESETS.map((preset) => {
                        const isSelected = baseCurrencyCode.toUpperCase() === preset.code.toUpperCase();
                        return (
                          <Button
                            key={preset.code}
                            type="button"
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => handleSelectPreset(preset.code, preset.symbol, preset.rate)}
                            className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                              isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                            }`}
                          >
                            <span className="font-mono font-bold">{preset.symbol}</span>
                            <span>{preset.code}</span>
                            <span className="text-[10px] opacity-75 font-normal">({preset.name})</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="baseCurrencyCode" className="text-xs font-medium">
                        Currency ISO Code
                      </Label>
                      <Input
                        id="baseCurrencyCode"
                        value={baseCurrencyCode}
                        onChange={(e) => setBaseCurrencyCode(e.target.value.toUpperCase())}
                        placeholder="e.g. USD, INR, EUR"
                        className="font-mono text-xs uppercase"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Standard 3-letter currency code (ISO 4217).
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="baseCurrencySymbol" className="text-xs font-medium">
                        Currency Symbol
                      </Label>
                      <Input
                        id="baseCurrencySymbol"
                        value={baseCurrencySymbol}
                        onChange={(e) => setBaseCurrencySymbol(e.target.value)}
                        placeholder="e.g. $, ₹, €, £"
                        className="font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Visual symbol displayed across pricing tables.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="baseExchangeRate" className="text-xs font-medium">
                        Base Multiplier Rate
                      </Label>
                      <Input
                        id="baseExchangeRate"
                        type="number"
                        step="0.01"
                        value={baseExchangeRate}
                        onChange={(e) => setBaseExchangeRate(parseFloat(e.target.value) || 1)}
                        className="font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Base currency baseline rate (Standard: 1.0).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PRICING & SAAS ROUNDING STRATEGY */}
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-base font-semibold">
                        SaaS Pricing & Psychological Rounding Strategy
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Prevent weird fractions like ₹417.50 or $4.87 after currency conversion. Choose how converted plan prices are presented to customers.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div
                      onClick={() => setRoundingMode("smart_saas")}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        roundingMode === "smart_saas"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span>✨ Smart SaaS (Recommended)</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono">₹499 / $4.99</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Eliminates awkward paise/cents. Automatically normalizes INR/AED to popular SaaS price points (₹499, ₹799, ₹999) or nearest tens, and USD/EUR to .99.
                      </p>
                    </div>

                    <div
                      onClick={() => setRoundingMode("whole_number")}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        roundingMode === "whole_number"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs">Clean Whole Numbers</span>
                        <Badge variant="outline" className="text-[10px] font-mono">₹418 / $5</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Rounds converted amounts to the nearest whole integer. Zero decimal points displayed across any currency.
                      </p>
                    </div>

                    <div
                      onClick={() => setRoundingMode("exact")}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        roundingMode === "exact"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs">Exact Float</span>
                        <Badge variant="outline" className="text-[10px] font-mono">₹417.50 / $4.99</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Mathematical conversion keeping exact decimal fractions. May produce non-standard SaaS pricing figures.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* MULTI-CURRENCY SUPPORT & EXCHANGE RATES */}
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">
                          Supported Multi-Currencies & Universal Exchange Rates
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Exchange rates use a standard USD benchmark (e.g. 1 USD = 85.00 INR). Cross rates relative to your base currency ({baseCurrencyCode}) are calculated automatically.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetMarketRates}
                        className="h-8 text-xs gap-1.5 hover:bg-primary/5 hover:text-primary transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Sync Standard Market Rates</span>
                      </Button>
                      <Badge variant="outline" className="text-[11px] font-medium h-8 px-2.5">
                        {supportedCurrencies.filter((c) => c.enabled).length} Enabled
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {supportedCurrencies.map((curr) => {
                      const isBase = curr.code.toUpperCase() === baseCurrencyCode.toUpperCase();
                      const currentUsdRate = (curr as any).usdRate ?? (curr.code === "INR" ? 85 : curr.rate);
                      return (
                        <div
                          key={curr.code}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            curr.enabled
                              ? "bg-card border-border/80 shadow-2xs"
                              : "bg-muted/30 border-muted opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-sm shrink-0">
                              {curr.symbol}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-foreground font-mono">{curr.code}</span>
                                <span className="text-[11px] text-muted-foreground">({curr.name || curr.code})</span>
                                {isBase && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20">
                                    Base Platform
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                                <span className="font-semibold text-foreground/80">1 USD =</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={!curr.enabled}
                                  value={currentUsdRate}
                                  onChange={(e) => handleUpdateUsdRate(curr.code, parseFloat(e.target.value) || 1)}
                                  className="w-20 h-6 px-1.5 text-xs font-mono rounded border bg-background text-foreground font-bold focus:ring-1 focus:ring-primary"
                                />
                                <span>{curr.symbol}</span>
                              </div>
                              {baseCurrencyCode.toUpperCase() !== "USD" && (
                                <p className="text-[10px] text-muted-foreground/80 font-mono">
                                  Effective: 1 {baseCurrencyCode} ≈ {isBase ? "1.0000" : curr.rate} {curr.symbol}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isBase ? true : curr.enabled}
                                disabled={isBase}
                                onChange={() => handleToggleCurrency(curr.code)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sample Live Conversion Matrix Preview */}
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-2 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                        Live Multi-Currency Preview for a 10 {baseCurrencyCode} Sample Plan
                      </div>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        Strategy: {roundingMode.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {supportedCurrencies
                        .filter((c) => c.enabled)
                        .map((c) => {
                          const raw = 10 * (c.code === baseCurrencyCode ? 1.0 : c.rate);
                          let displayPrice = "";
                          if (roundingMode === "whole_number") {
                            displayPrice = Math.round(raw).toString();
                          } else if (roundingMode === "smart_saas") {
                            if (c.code === "INR") {
                              displayPrice = raw < 100 ? Math.round(raw).toString() : Math.round(raw / 10) * 10 - 1 + "";
                            } else {
                              displayPrice = raw.toFixed(2);
                            }
                          } else {
                            displayPrice = raw.toFixed(2);
                          }
                          return (
                            <div
                              key={c.code}
                              className="px-2.5 py-1.5 rounded-lg bg-background border text-xs font-mono flex items-center gap-1.5 shadow-2xs"
                            >
                              <span className="text-muted-foreground">{c.code}:</span>
                              <span className="font-bold text-primary">
                                {c.symbol}{displayPrice}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Changes take effect immediately across all billing, pricing, and checkout screens.</span>
                  </span>

                  <Button
                    type="submit"
                    disabled={savingCurrency}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shadow-2xs font-semibold"
                  >
                    {savingCurrency ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Currency...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Currency Settings</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </TabsContent>

        {/* 3. META CLOUD API SETTINGS */}
        <TabsContent value="meta">
          {loading ? (
            <Card className="shadow-xs border">
              <CardHeader className="p-6 pb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSaveMeta}>
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">
                          Meta WhatsApp Cloud API &amp; Embedded Signup
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Configure your SaaS-level Meta App credentials. All workspace tenants will use this application to connect their WhatsApp Business Accounts.
                      </CardDescription>
                    </div>

                    <Badge
                      variant={hasAppSecret && appId && configId ? 'default' : 'secondary'}
                      className={`text-[11px] font-medium shrink-0 ${
                        hasAppSecret && appId && configId
                          ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {hasAppSecret && appId && configId ? '● Active' : '○ Not Configured'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="appId" className="text-xs font-medium">
                      Meta App ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="appId"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="e.g. 102938475612345"
                      className="font-mono text-xs"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Found in your Meta App Dashboard under App Settings &gt; Basic.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="appSecret" className="text-xs font-medium">
                        Meta App Secret
                      </Label>
                      {hasAppSecret && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Secret stored securely on server</span>
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        id="appSecret"
                        type={showSecret ? 'text' : 'password'}
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                        placeholder={hasAppSecret ? '•••••••••••••••••••••••••••••••• (Leave blank to keep existing)' : 'Enter Meta App Secret'}
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        title={showSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Server-side secret used for OAuth code exchange. Leaving this field blank will preserve the existing secret.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="configId" className="text-xs font-medium">
                      Embedded Signup Configuration ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="configId"
                      value={configId}
                      onChange={(e) => setConfigId(e.target.value)}
                      placeholder="e.g. 5647382910"
                      className="font-mono text-xs"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Created under WhatsApp &gt; Quickstart &gt; Embedded Signup Configuration in your Meta App Dashboard.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="graphVersion" className="text-xs font-medium">
                      Graph API Version
                    </Label>
                    <Input
                      id="graphVersion"
                      value={graphVersion}
                      onChange={(e) => setGraphVersion(e.target.value)}
                      placeholder="v21.0"
                      className="font-mono text-xs max-w-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Recommended version: <code className="font-mono">v21.0</code>.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Zero-knowledge security: Raw App Secret is never sent to user browsers.</span>
                  </span>

                  <Button
                    type="submit"
                    disabled={saving}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shadow-2xs font-semibold"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Configuration</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </TabsContent>

        {/* GLOBAL THEME CUSTOMIZATION SETTINGS */}
        <TabsContent value="theme">
          {loading ? (
            <Card className="shadow-xs border p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-10 w-full mt-4" />
              <Skeleton className="h-10 w-full mt-4" />
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Presets Gallery Card */}
              <Card className="shadow-xs border rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Curated Global Theme Presets
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Choose from professionally curated palettes or customize token colors below.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Active: {selectedPresetId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {themePresets.map((preset) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectThemePreset(preset.id)}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-24 ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                              : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground line-clamp-1">
                                {preset.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                              {preset.description || 'Pre-designed palette'}
                            </p>
                          </div>
                          {preset.isProtected && (
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                              System Default
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Custom Token Configuration Form */}
              <form onSubmit={handleSaveThemeConfig}>
                <Card className="shadow-xs border rounded-2xl overflow-hidden">
                  <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      Semantic Design Tokens & CSS Variables
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configure site-wide brand colors, contrast, and corner radiuses. These map dynamically to shadcn variables.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Brand Colors Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Primary Color */}
                      <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-card">
                        <Label htmlFor="themePrimary" className="text-xs font-semibold flex items-center justify-between">
                          <span>Primary Brand Color</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">--primary</span>
                        </Label>
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            id="themePrimaryPicker"
                            value={themePrimary.startsWith('#') ? themePrimary : '#6366f1'}
                            onChange={(e) => handleUpdateColors('primary', e.target.value)}
                            className="h-9 w-12 rounded-lg border border-input cursor-pointer bg-transparent p-0.5"
                          />
                          <Input
                            id="themePrimary"
                            value={themePrimary}
                            onChange={(e) => handleUpdateColors('primary', e.target.value)}
                            placeholder="#6366f1"
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Used for main CTA buttons, active sidebar links, key badges, and focused borders.
                        </p>
                      </div>

                      {/* Secondary Color */}
                      <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-card">
                        <Label htmlFor="themeSecondary" className="text-xs font-semibold flex items-center justify-between">
                          <span>Secondary Brand Color</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">--secondary</span>
                        </Label>
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            id="themeSecondaryPicker"
                            value={themeSecondary.startsWith('#') ? themeSecondary : '#4f46e5'}
                            onChange={(e) => handleUpdateColors('secondary', e.target.value)}
                            className="h-9 w-12 rounded-lg border border-input cursor-pointer bg-transparent p-0.5"
                          />
                          <Input
                            id="themeSecondary"
                            value={themeSecondary}
                            onChange={(e) => handleUpdateColors('secondary', e.target.value)}
                            placeholder="#4f46e5"
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Used for secondary actions, subtle hover surfaces, and complementary containers.
                        </p>
                      </div>

                      {/* Accent Color */}
                      <div className="space-y-2 p-4 rounded-xl border border-border/60 bg-card">
                        <Label htmlFor="themeAccent" className="text-xs font-semibold flex items-center justify-between">
                          <span>Accent Highlight Color</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">--accent</span>
                        </Label>
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            id="themeAccentPicker"
                            value={themeAccent.startsWith('#') ? themeAccent : '#ec4899'}
                            onChange={(e) => handleUpdateColors('accent', e.target.value)}
                            className="h-9 w-12 rounded-lg border border-input cursor-pointer bg-transparent p-0.5"
                          />
                          <Input
                            id="themeAccent"
                            value={themeAccent}
                            onChange={(e) => handleUpdateColors('accent', e.target.value)}
                            placeholder="#ec4899"
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Used for highlights, micro-interactions, pill tags, and dynamic stats indicators.
                        </p>
                      </div>
                    </div>

                    {/* Corner Radius Controls */}
                    <div className="space-y-2.5 p-4 rounded-xl border border-border/60 bg-card">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Sliders className="h-3.5 w-3.5 text-primary" />
                          <span>Component Corner Radius</span>
                        </Label>
                        <span className="text-xs font-mono text-muted-foreground">{themeRadius}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {[
                          { label: 'Sharp (0px)', value: '0px' },
                          { label: 'Subtle (4px)', value: '4px' },
                          { label: 'Standard (8px)', value: '8px' },
                          { label: 'Default (10px)', value: '0.625rem' },
                          { label: 'Rounded (16px)', value: '16px' },
                        ].map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => handleUpdateRadius(r.value)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                              themeRadius === r.value
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : 'border-border/60 hover:bg-muted text-foreground'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live Interactive UI Preview */}
                    <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Live Interactive Component Preview
                        </h4>
                        <span className="text-[11px] text-muted-foreground">Updates instantly across session</span>
                      </div>
                      <div className="p-4 rounded-xl border bg-background space-y-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Button size="sm" type="button" className="text-xs h-8">
                            Primary CTA
                          </Button>
                          <Button size="sm" type="button" variant="secondary" className="text-xs h-8">
                            Secondary
                          </Button>
                          <Button size="sm" type="button" variant="outline" className="text-xs h-8">
                            Outline
                          </Button>
                          <Button size="sm" type="button" variant="destructive" className="text-xs h-8">
                            Destructive
                          </Button>
                          <Badge variant="default" className="text-[11px]">Primary Badge</Badge>
                          <Badge variant="secondary" className="text-[11px]">Secondary</Badge>
                          <Badge variant="outline" className="text-[11px]">Outline</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <Input placeholder="Preview input field with active theme..." className="text-xs h-8" />
                          <div className="p-2.5 rounded-lg border bg-card flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Card Surface Preview</span>
                            <span className="font-semibold text-primary">Active</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetThemeConfig}
                      disabled={resettingTheme || savingTheme}
                      className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
                    >
                      {resettingTheme ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Reset to Factory Default
                    </Button>

                    <Button
                      type="submit"
                      disabled={savingTheme}
                      size="sm"
                      className="bg-primary text-primary-foreground hover:opacity-90 gap-1.5 text-xs h-8 font-semibold shadow-xs"
                    >
                      {savingTheme ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Global Theme
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
