'use client';

import React, { useEffect, useState } from 'react';
import { adminApi, SupportedCurrencyItem } from '@/lib/api/admin';
import { AdminPlanItem, PlanPriceItem } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Loader2,
  Layers,
  Plus,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldAlert,
  Bot,
  Code2,
  Tag,
  FileText,
  Flame,
  FileSpreadsheet,
  Camera,
  Send,
  QrCode,
  Users,
  Settings2,
  ShieldCheck,
  Coins,
} from 'lucide-react';

interface PlanFormData {
  id?: number;
  title: string;
  short_description: string;
  price: string | number;
  price_strike: string;
  plan_duration_in_days: string | number;
  is_trial: boolean;
  contact_limit: string | number;
  qr_account: string | number;
  allow_tag: boolean;
  allow_note: boolean;
  allow_chatbot: boolean;
  allow_api: boolean;
  wa_warmer: boolean;
  rest_api_qr: boolean;
  instagram_inbox: boolean;
  telegram_inbox: boolean;
  allow_wa_forms: boolean;
  currency_prices?: Record<string, string | number>;
}

const DEFAULT_FORM: PlanFormData = {
  title: '',
  short_description: '',
  price: '0',
  price_strike: '',
  plan_duration_in_days: '30',
  is_trial: false,
  contact_limit: '1000',
  qr_account: '1',
  allow_tag: true,
  allow_note: true,
  allow_chatbot: false,
  allow_api: false,
  wa_warmer: false,
  rest_api_qr: false,
  instagram_inbox: false,
  telegram_inbox: false,
  allow_wa_forms: true,
  currency_prices: {},
};

function FeatureToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: any;
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
        checked
          ? 'bg-primary/5 border-primary/40 dark:bg-primary/10 shadow-2xs'
          : 'bg-muted/20 border-border/80 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 pr-3">
        <div
          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
            checked
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{label}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{description}</p>
        </div>
      </div>

      <div
        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-background shadow-xs transition-transform transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
}


function getPlanCustomPrices(plan: AdminPlanItem): Record<string, string | number> {
  if (!plan) return {};
  const c = (plan as any).custom;
  if (!c) return {};
  if (typeof c === "object") return c.currency_prices || {};
  try {
    const parsed = JSON.parse(c);
    return parsed?.currency_prices || {};
  } catch (_) {
    return {};
  }
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [activeTab, setActiveTab] = useState<'details' | 'features'>('details');
  const [formData, setFormData] = useState<PlanFormData>(DEFAULT_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog state
  const [planToDelete, setPlanToDelete] = useState<AdminPlanItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Main Tab & Pricing Matrix state
  const [mainTab, setMainTab] = useState<'plans' | 'matrix'>('plans');
  const [matrixPlans, setMatrixPlans] = useState<AdminPlanItem[]>([]);
  const [matrixPrices, setMatrixPrices] = useState<
    Record<string, { amount: string | number; strike_amount: string | number; is_active: boolean }>
  >({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixSuccess, setMatrixSuccess] = useState<string | null>(null);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrencyItem[]>([
    { code: "INR", symbol: "₹", rate: 85, name: "Indian Rupee", enabled: true },
    { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", enabled: true },
    { code: "GBP", symbol: "£", rate: 0.79, name: "British Pound", enabled: true },
    { code: "AED", symbol: "د.إ", rate: 3.67, name: "UAE Dirham", enabled: true },
  ]);
  const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string }>({ code: "USD", symbol: "$" });

  const fetchMatrix = async () => {
    try {
      setMatrixLoading(true);
      setMatrixError(null);
      const res = await adminApi.getPlanPricesMatrix();
      if (res && res.success) {
        setMatrixPlans(res.plans);
        const map: Record<string, { amount: string | number; strike_amount: string | number; is_active: boolean }> = {};
        if (Array.isArray(res.prices)) {
          res.prices.forEach((p) => {
            map[`${p.plan_id}_${p.currency_code.toUpperCase()}`] = {
              amount: p.amount,
              strike_amount: p.strike_amount ?? '',
              is_active: Boolean(p.is_active),
            };
          });
        }
        setMatrixPrices(map);
      } else {
        setMatrixError(res?.msg || 'Failed to load pricing matrix');
      }
    } catch (err: any) {
      setMatrixError(err?.message || 'Error communicating with server');
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleSaveMatrix = async () => {
    try {
      setMatrixSaving(true);
      setMatrixSuccess(null);
      setMatrixError(null);

      const payload: PlanPriceItem[] = [];
      const enabledCurrencies = supportedCurrencies.filter((c) => c.enabled !== false);

      matrixPlans.forEach((plan) => {
        enabledCurrencies.forEach((curr) => {
          const key = `${plan.id}_${curr.code.toUpperCase()}`;
          const entry = matrixPrices[key];
          if (entry !== undefined && entry.amount !== '' && entry.amount !== null) {
            payload.push({
              plan_id: plan.id,
              currency_code: curr.code.toUpperCase(),
              amount: Number(entry.amount),
              strike_amount:
                entry.strike_amount !== '' && entry.strike_amount !== null
                  ? Number(entry.strike_amount)
                  : null,
              billing_period_days: Number(plan.plan_duration_in_days || 30),
              is_active: entry.is_active ? 1 : 0,
            });
          }
        });
      });

      const res = await adminApi.updatePlanPricesMatrix(payload);
      if (res && res.success) {
        setMatrixSuccess('Pricing matrix saved successfully to database!');
        await fetchMatrix();
        await fetchPlans();
        setTimeout(() => setMatrixSuccess(null), 4000);
      } else {
        setMatrixError(res?.msg || 'Failed to save pricing matrix');
      }
    } catch (err: any) {
      setMatrixError(err?.message || 'Error saving pricing matrix');
    } finally {
      setMatrixSaving(false);
    }
  };

  const handleAutofillPlanPpp = async (plan: AdminPlanItem) => {
    try {
      const usdKey = `${plan.id}_USD`;
      const usdPrice = Number(matrixPrices[usdKey]?.amount ?? plan.price ?? 0);

      if (plan.is_trial) {
        setMatrixPrices((prev) => {
          const updated = { ...prev };
          supportedCurrencies.forEach((c) => {
            updated[`${plan.id}_${c.code.toUpperCase()}`] = {
              amount: 0,
              strike_amount: '',
              is_active: true,
            };
          });
          return updated;
        });
        setMatrixSuccess(`Set ${plan.title} free trial tier to 0 across all currencies.`);
        setTimeout(() => setMatrixSuccess(null), 3000);
        return;
      }

      if (usdPrice <= 0) {
        alert(`Please set a baseline USD price for ${plan.title} first.`);
        return;
      }

      const res = await adminApi.suggestPppPrices(usdPrice);
      if (res && res.success && res.suggestions) {
        setMatrixPrices((prev) => {
          const updated = { ...prev };
          Object.entries(res.suggestions).forEach(([code, item]) => {
            const key = `${plan.id}_${code.toUpperCase()}`;
            updated[key] = {
              amount: item.amount,
              strike_amount: item.strikeAmount ?? '',
              is_active: true,
            };
          });
          return updated;
        });
        setMatrixSuccess(`Applied PPP recommendations for ${plan.title}! Click Save Pricing Matrix to commit.`);
        setTimeout(() => setMatrixSuccess(null), 4000);
      }
    } catch (err: any) {
      setMatrixError('Failed to generate PPP suggestions');
    }
  };

  const handleAutofillAllPpp = async () => {
    for (const p of matrixPlans) {
      await handleAutofillPlanPpp(p);
    }
    setMatrixSuccess('Applied PPP suggestions across all plans! Review values and click Save.');
    setTimeout(() => setMatrixSuccess(null), 4000);
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getPlans();
      if (res && res.success && Array.isArray(res.data)) {
        setPlans(res.data);
      } else {
        setError(res?.msg || 'Failed to fetch subscription plans');
      }
    } catch (err: any) {
      setError(err?.data?.msg || err?.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchMatrix();
    adminApi.getCurrencySettings().then((res) => {
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.supportedCurrencies)) {
          setSupportedCurrencies(res.data.supportedCurrencies);
        }
        if (res.data.baseCode) {
          setBaseCurrency({
            code: res.data.baseCode,
            symbol: res.data.baseSymbol || "$",
          });
        }
      }
    }).catch(() => {});
  }, []);

  const openCreateModal = () => {
    setFormMode('create');
    setFormData(DEFAULT_FORM);
    setActiveTab('details');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (plan: AdminPlanItem) => {
    setFormMode('edit');
    const customPrices = getPlanCustomPrices(plan);

    setFormData({
      id: plan.id,
      title: plan.title,
      short_description: plan.short_description || '',
      price: plan.price ?? 0,
      price_strike: plan.price_strike ? String(plan.price_strike) : '',
      plan_duration_in_days: plan.plan_duration_in_days ?? 30,
      is_trial: Number(plan.is_trial) === 1,
      contact_limit: plan.contact_limit ?? 1000,
      qr_account: plan.qr_account ?? 1,
      allow_tag: Number(plan.allow_tag) === 1,
      allow_note: Number(plan.allow_note) === 1,
      allow_chatbot: Number(plan.allow_chatbot) === 1,
      allow_api: Number(plan.allow_api) === 1,
      wa_warmer: Number(plan.wa_warmer) === 1,
      rest_api_qr: Number(plan.rest_api_qr) === 1,
      instagram_inbox: Number(plan.instagram_inbox) === 1,
      telegram_inbox: Number(plan.telegram_inbox) === 1,
      allow_wa_forms: Number(plan.allow_wa_forms) === 1,
      currency_prices: customPrices,
    });
    setActiveTab('details');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openDuplicateModal = (plan: AdminPlanItem) => {
    setFormMode('duplicate');
    const customPrices = getPlanCustomPrices(plan);

    setFormData({
      title: `${plan.title} (Copy)`,
      short_description: plan.short_description || '',
      price: plan.price ?? 0,
      price_strike: plan.price_strike ? String(plan.price_strike) : '',
      plan_duration_in_days: plan.plan_duration_in_days ?? 30,
      is_trial: Number(plan.is_trial) === 1,
      contact_limit: plan.contact_limit ?? 1000,
      qr_account: plan.qr_account ?? 1,
      allow_tag: Number(plan.allow_tag) === 1,
      allow_note: Number(plan.allow_note) === 1,
      allow_chatbot: Number(plan.allow_chatbot) === 1,
      allow_api: Number(plan.allow_api) === 1,
      wa_warmer: Number(plan.wa_warmer) === 1,
      rest_api_qr: Number(plan.rest_api_qr) === 1,
      instagram_inbox: Number(plan.instagram_inbox) === 1,
      telegram_inbox: Number(plan.telegram_inbox) === 1,
      allow_wa_forms: Number(plan.allow_wa_forms) === 1,
      currency_prices: customPrices,
    });
    setActiveTab('details');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSavePlan = async () => {
    if (!formData.title.trim()) {
      setFormError('Plan Name is required');
      return;
    }
    if (Number(formData.plan_duration_in_days) <= 0) {
      setFormError('Plan Duration must be at least 1 day');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const payload: any = {
        title: formData.title.trim(),
        short_description: formData.short_description.trim(),
        price: formData.is_trial ? 0 : Number(formData.price || 0),
        price_strike: formData.price_strike ? String(formData.price_strike) : null,
        plan_duration_in_days: parseInt(String(formData.plan_duration_in_days), 10) || 30,
        is_trial: formData.is_trial ? 1 : 0,
        contact_limit: parseInt(String(formData.contact_limit), 10) || 0,
        qr_account: parseInt(String(formData.qr_account), 10) || 0,
        allow_tag: formData.allow_tag ? 1 : 0,
        allow_note: formData.allow_note ? 1 : 0,
        allow_chatbot: formData.allow_chatbot ? 1 : 0,
        allow_api: formData.allow_api ? 1 : 0,
        wa_warmer: formData.wa_warmer ? 1 : 0,
        rest_api_qr: formData.rest_api_qr ? 1 : 0,
        instagram_inbox: formData.instagram_inbox ? 1 : 0,
        telegram_inbox: formData.telegram_inbox ? 1 : 0,
        allow_wa_forms: formData.allow_wa_forms ? 1 : 0,
        custom: {
          currency_prices: (() => {
            const clean: Record<string, number> = {};
            if (formData.currency_prices) {
              Object.entries(formData.currency_prices).forEach(([curr, val]) => {
                if (val !== "" && val !== null && val !== undefined) {
                  clean[curr] = Number(val);
                }
              });
            }
            return clean;
          })(),
        },
      };

      if (formMode === 'edit' && formData.id) {
        payload.id = formData.id;
        const res = await adminApi.updatePlan(payload);
        if (!res?.success) {
          throw new Error(res?.msg || 'Failed to update plan');
        }
      } else {
        const res = await adminApi.createPlan(payload);
        if (!res?.success) {
          throw new Error(res?.msg || 'Failed to create plan');
        }
      }

      setIsFormOpen(false);
      await fetchPlans();
    } catch (err: any) {
      setFormError(err?.data?.msg || err?.message || 'Error saving plan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      const res = await adminApi.deletePlan(planToDelete.id);
      if (res?.success) {
        setPlanToDelete(null);
        await fetchPlans();
      } else {
        setDeleteError(res?.msg || 'Failed to delete plan');
      }
    } catch (err: any) {
      setDeleteError(
        err?.data?.msg || err?.message || 'An error occurred while deleting the plan'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Plan Management</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Create, configure, and manage subscription plans, resource quotas, and capability entitlements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlans}
            disabled={loading}
            className="h-9 text-xs"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateModal} className="h-9 text-xs">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <Tabs value={mainTab} onValueChange={(val: any) => setMainTab(val)} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md h-10 p-1 bg-muted/60 rounded-xl border">
          <TabsTrigger
            value="plans"
            className="text-xs font-semibold gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
          >
            <Layers className="h-3.5 w-3.5" />
            Plans & Entitlements
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className="text-xs font-semibold gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
          >
            <Coins className="h-3.5 w-3.5" />
            Multi-Currency Matrix (Fixed Prices)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4 pt-1">
          {/* Main Table Card */}
          <Card className="shadow-xs border rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Configured Subscription Plans</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Total {plans.length} plan{plans.length === 1 ? '' : 's'} registered in the database.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-semibold">Error Loading Plans</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No plans configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No subscription plans exist yet. Click Create Plan above to define your first tier.
              </p>
              <Button size="sm" onClick={openCreateModal} className="mt-2">
                <Plus className="mr-2 h-3.5 w-3.5" /> Create Plan
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[200px]">Plan Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price & Billing</TableHead>
                    <TableHead>Contact Limit</TableHead>
                    <TableHead>QR Accounts</TableHead>
                    <TableHead>Active Channels & Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => {
                    const featureCount = [
                      plan.allow_chatbot,
                      plan.allow_api,
                      plan.allow_tag,
                      plan.allow_note,
                      plan.wa_warmer,
                      plan.allow_wa_forms,
                      plan.instagram_inbox,
                      plan.telegram_inbox,
                    ].filter((f) => Number(f) === 1).length;

                    return (
                      <TableRow key={plan.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{plan.title}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {plan.short_description || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {Number(plan.is_trial) === 1 ? (
                            <Badge variant="secondary" className="font-mono text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              FREE TRIAL
                            </Badge>
                          ) : (
                            <Badge variant="default" className="font-mono text-xs">
                              PAID TIER
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground text-sm">
                                {Number(plan.is_trial) === 1 ? 'Free' : `${baseCurrency.symbol}${plan.price ?? 0}`}
                              </span>
                              {plan.price_strike && Number(plan.is_trial) !== 1 && (
                                <span className="text-muted-foreground line-through text-[11px]">
                                  ${plan.price_strike}
                                </span>
                              )}
                              {Object.entries(getPlanCustomPrices(plan)).map(([cCode, cPrice]) => (
                                <Badge
                                  key={cCode}
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 font-mono text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                                >
                                  {cCode === "INR" ? "₹" : cCode === "EUR" ? "€" : cCode === "GBP" ? "£" : ""}{cPrice} {cCode}
                                </Badge>
                              ))}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {plan.plan_duration_in_days ? `${plan.plan_duration_in_days} days validity` : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <span className="font-bold text-foreground">
                            {plan.contact_limit !== undefined ? Number(plan.contact_limit).toLocaleString() : '0'}
                          </span>{' '}
                          <span className="text-muted-foreground">contacts</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <span className="font-bold text-foreground">
                            {plan.qr_account !== undefined ? plan.qr_account : 0}
                          </span>{' '}
                          <span className="text-muted-foreground">instances</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap max-w-[260px]">
                            {Number(plan.allow_chatbot) === 1 && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Chatbot
                              </Badge>
                            )}
                            {Number(plan.allow_api) === 1 && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                API
                              </Badge>
                            )}
                            {Number(plan.allow_tag) === 1 && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                Tags
                              </Badge>
                            )}
                            {featureCount > 3 && (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                +{featureCount - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditModal(plan)} className="cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit Plan</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDuplicateModal(plan)} className="cursor-pointer">
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Duplicate Plan</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeleteError(null);
                                  setPlanToDelete(plan);
                                }}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Plan</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    {/* Multi-Currency Matrix Tab */}
    <TabsContent value="matrix" className="space-y-4 pt-1">
      {matrixSuccess && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-xs font-bold">Success</AlertTitle>
          <AlertDescription className="text-xs">{matrixSuccess}</AlertDescription>
        </Alert>
      )}

      {matrixError && (
        <Alert variant="destructive" className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Error</AlertTitle>
          <AlertDescription className="text-xs">{matrixError}</AlertDescription>
        </Alert>
      )}

      {/* Guidance & Quick Action Banner */}
      <Card className="rounded-2xl border bg-card/60 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 bg-muted/20 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">
                  Purchasing Power Parity (PPP) & Fixed Charm Pricing
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Plan prices are stored independently per currency in <code className="text-foreground font-mono font-bold bg-muted px-1.5 py-0.5 rounded">plan_prices</code>. Zero awkward math decimals (e.g. ₹501.00).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutofillAllPpp}
                disabled={matrixSaving || matrixLoading}
                className="h-8 text-xs font-semibold gap-1.5 bg-background shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Autofill All with PPP
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMatrix}
                disabled={matrixSaving || matrixLoading}
                className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
              >
                {matrixSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Save Pricing Matrix
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-xs space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
            <div className="p-2.5 rounded-xl border bg-background/50 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>🇮🇳 India (INR)</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">~35% PPP</Badge>
              </div>
              <p className="text-muted-foreground">
                Charm endings: <strong>₹149, ₹499, ₹799, ₹999</strong>. Never displays awkward decimals or paise.
              </p>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>🇪🇺 Europe (EUR)</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">~90% PPP</Badge>
              </div>
              <p className="text-muted-foreground">
                Rounded integers or .99 charm endings. E.g. $6 USD &rarr; <strong>€5 EUR</strong>.
              </p>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>🇬🇧 United Kingdom (GBP)</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">~80% PPP</Badge>
              </div>
              <p className="text-muted-foreground">
                Rounded whole GBP integers. E.g. $6 USD &rarr; <strong>£4 GBP</strong>.
              </p>
            </div>
            <div className="p-2.5 rounded-xl border bg-background/50 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>🇦🇪 UAE (AED)</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">~85% PPP</Badge>
              </div>
              <p className="text-muted-foreground">
                Clean multiples of 5 AED. E.g. $6 USD &rarr; <strong>20 AED</strong>, $10 USD &rarr; <strong>35 AED</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matrix Grid Card */}
      <Card className="rounded-2xl border shadow-xs overflow-hidden">
        <CardHeader className="p-4 bg-muted/20 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Plan & Currency Pricing Matrix</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Set explicit fixed price and optional strike-through price per currency.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold">
              {supportedCurrencies.filter((c) => c.enabled !== false).length} Active Currencies
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[220px] font-bold text-foreground">Plan Details</TableHead>
                {supportedCurrencies
                  .filter((c) => c.enabled !== false)
                  .map((curr) => (
                    <TableHead key={curr.code} className="min-w-[180px] font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-primary font-black">{curr.symbol}</span>
                        <span>{curr.code}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({curr.name || curr.code})
                        </span>
                      </div>
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrixPlans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={supportedCurrencies.filter((c) => c.enabled !== false).length + 1}
                    className="p-8 text-center text-xs text-muted-foreground"
                  >
                    No plans found to configure.
                  </TableCell>
                </TableRow>
              ) : (
                matrixPlans.map((p) => {
                  const enabledCurrs = supportedCurrencies.filter((c) => c.enabled !== false);
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/10">
                      <TableCell className="align-top py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{p.title}</span>
                            {p.is_trial ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
                              >
                                TRIAL
                              </Badge>
                            ) : (
                              <Badge className="text-[10px]">PAID</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Duration: {p.plan_duration_in_days || 30} days
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAutofillPlanPpp(p)}
                            className="h-7 px-2 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                          >
                            <Sparkles className="h-3 w-3" />
                            Suggest PPP
                          </Button>
                        </div>
                      </TableCell>

                      {enabledCurrs.map((curr) => {
                        const key = `${p.id}_${curr.code.toUpperCase()}`;
                        const entry = matrixPrices[key] || { amount: '', strike_amount: '', is_active: true };

                        return (
                          <TableCell key={curr.code} className="align-top py-3">
                            <div className="space-y-2 p-2.5 rounded-xl border bg-card/60 shadow-2xs">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                                  Price ({curr.symbol})
                                </Label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                                    {curr.symbol}
                                  </span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step={curr.code.toUpperCase() === 'INR' ? '1' : '0.01'}
                                    disabled={Number(p.is_trial) === 1}
                                    value={p.is_trial ? '0' : entry.amount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMatrixPrices((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || { strike_amount: '', is_active: true }),
                                          amount: val,
                                        },
                                      }));
                                    }}
                                    placeholder={p.is_trial ? '0' : '0'}
                                    className="pl-7 h-8 text-xs font-mono font-bold"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                                  Strike Price ({curr.symbol})
                                </Label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                                    {curr.symbol}
                                  </span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step={curr.code.toUpperCase() === 'INR' ? '1' : '0.01'}
                                    disabled={Number(p.is_trial) === 1}
                                    value={p.is_trial ? '' : entry.strike_amount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMatrixPrices((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || { amount: '', is_active: true }),
                                          strike_amount: val,
                                        },
                                      }));
                                    }}
                                    placeholder="Optional"
                                    className="pl-7 h-8 text-xs font-mono"
                                  />
                                </div>
                              </div>

                              <div className="pt-1 flex items-center justify-between text-[10px]">
                                <span className="font-mono text-muted-foreground">
                                  {entry.amount !== '' && entry.amount !== null && entry.amount !== undefined ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Fixed Price
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Fallback</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            All prices saved here are stored directly in the database <code className="font-mono font-bold">plan_prices</code> table.
          </p>
          <Button
            size="sm"
            onClick={handleSaveMatrix}
            disabled={matrixSaving || matrixLoading}
            className="h-9 px-4 text-xs font-semibold gap-1.5 shadow-xs"
          >
            {matrixSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Save Pricing Matrix
          </Button>
        </CardFooter>
      </Card>
    </TabsContent>
  </Tabs>

  {/* Plan Form Modal (Clean 2-Column with Tabs) */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && setIsFormOpen(false)}>
        <DialogContent
          className="w-[95vw] sm:max-w-4xl md:max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden gap-0 rounded-2xl border shadow-xl"
          style={{ maxWidth: '920px' }}
          showCloseButton={true}
        >
          {/* Header */}
          <div className="p-5 border-b bg-card">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {formMode === 'edit'
                  ? `Edit Plan: ${formData.title}`
                  : formMode === 'duplicate'
                  ? `Duplicate Plan: ${formData.title}`
                  : 'Create Subscription Plan'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure plan details, pricing, quotas, and capability entitlements.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <Alert variant="destructive" className="py-2.5 mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">{formError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Dialog Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Tabs & Inputs (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                  <TabsList className="grid grid-cols-2 w-full h-9">
                    <TabsTrigger value="details" className="text-xs font-semibold gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />
                      Details & Quotas
                    </TabsTrigger>
                    <TabsTrigger value="features" className="text-xs font-semibold gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Feature Entitlements
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Plan Details & Quotas */}
                  <TabsContent value="details" className="space-y-4 pt-3">
                    {/* Basic Info */}
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/15">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Basic Information
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Plan Title *</Label>
                          <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Starter, Business Pro, Enterprise"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Description</Label>
                          <Textarea
                            value={formData.short_description}
                            onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                            placeholder="Short overview of who this plan is tailored for..."
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Duration */}
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/15">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Pricing & Duration
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Price ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={formData.is_trial}
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Strike Price ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={formData.is_trial}
                            value={formData.price_strike}
                            onChange={(e) => setFormData({ ...formData, price_strike: e.target.value })}
                            placeholder="Optional"
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Duration (Days) *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={formData.plan_duration_in_days}
                            onChange={(e) => setFormData({ ...formData, plan_duration_in_days: e.target.value })}
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div
                        onClick={() => setFormData({ ...formData, is_trial: !formData.is_trial })}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer mt-1 ${
                          formData.is_trial
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                            : 'bg-background border-border hover:bg-muted/40'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold">Free Trial Tier</p>
                          <p className="text-[11px] text-muted-foreground">Price is locked to $0 for trial users.</p>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
                            formData.is_trial ? 'bg-amber-500' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full bg-background shadow-xs transition-transform transform ${
                              formData.is_trial ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Multi-Currency Fixed Price Overrides (Per-Currency Settings) */}
                    {!formData.is_trial && (
                      <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <Coins className="h-4 w-4" /> Multi-Currency Fixed Prices (Per-Currency Overrides)
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              Enter explicit fixed prices for enabled currencies (e.g. ₹499 INR, €5 EUR, £4 GBP, 20 AED). If left blank, the system automatically converts from {baseCurrency.code} ({baseCurrency.symbol}).
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                          {supportedCurrencies
                            .filter((c) => c.enabled && c.code.toUpperCase() !== baseCurrency.code.toUpperCase())
                            .map((curr) => {
                              const autoConverted = Math.round(Number(formData.price || 0) * (curr.rate || 1));
                              const customVal = formData.currency_prices?.[curr.code] ?? "";
                              const isOverridden = customVal !== "" && customVal !== undefined && customVal !== null;
                              return (
                                <div
                                  key={curr.code}
                                  className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                                    isOverridden
                                      ? "bg-background border-primary/40 shadow-xs"
                                      : "bg-background/70 border-border/80"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold font-mono flex items-center gap-1">
                                      <span className="text-primary font-bold">{curr.symbol}</span>
                                      <span>{curr.code}</span>
                                    </Label>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Auto: {curr.symbol}{autoConverted}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-muted-foreground">
                                      {curr.symbol}
                                    </span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder={String(autoConverted)}
                                      value={customVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData((prev) => ({
                                          ...prev,
                                          currency_prices: {
                                            ...(prev.currency_prices || {}),
                                            [curr.code]: val === "" ? "" : (parseFloat(val) || 0),
                                          },
                                        }));
                                      }}
                                      className="h-8 pl-7 text-xs font-mono font-semibold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground truncate">{curr.name}</span>
                                    {isOverridden ? (
                                      <span className="text-emerald-500 font-semibold shrink-0">
                                        ✓ Fixed
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/70 italic shrink-0">
                                        Auto-rate
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Resource Quotas */}
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/15">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Resource Limits
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary" /> Contacts Quota
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.contact_limit}
                            onChange={(e) => setFormData({ ...formData, contact_limit: e.target.value })}
                            placeholder="e.g. 10000"
                            className="h-9 text-xs font-mono"
                          />
                          <p className="text-[10px] text-muted-foreground">Max contacts allowed.</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <QrCode className="h-3.5 w-3.5 text-primary" /> WhatsApp QR Accounts
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.qr_account}
                            onChange={(e) => setFormData({ ...formData, qr_account: e.target.value })}
                            placeholder="e.g. 3"
                            className="h-9 text-xs font-mono"
                          />
                          <p className="text-[10px] text-muted-foreground">Max simultaneous sessions.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Feature Entitlements */}
                  <TabsContent value="features" className="space-y-4 pt-3">
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Core CRM Tools
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FeatureToggleRow
                          icon={Bot}
                          label="Chatbot Automation"
                          description="Interactive flows & triggers"
                          checked={formData.allow_chatbot}
                          onChange={(val) => setFormData({ ...formData, allow_chatbot: val })}
                        />
                        <FeatureToggleRow
                          icon={Tag}
                          label="Chat Tags"
                          description="Conversation tag labeling"
                          checked={formData.allow_tag}
                          onChange={(val) => setFormData({ ...formData, allow_tag: val })}
                        />
                        <FeatureToggleRow
                          icon={FileText}
                          label="Chat Notes"
                          description="Internal team chat notes"
                          checked={formData.allow_note}
                          onChange={(val) => setFormData({ ...formData, allow_note: val })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        WhatsApp Channels & Tools
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FeatureToggleRow
                          icon={Flame}
                          label="WhatsApp Warmer"
                          description="Auto number warm-up"
                          checked={formData.wa_warmer}
                          onChange={(val) => setFormData({ ...formData, wa_warmer: val })}
                        />
                        <FeatureToggleRow
                          icon={FileSpreadsheet}
                          label="WhatsApp Forms"
                          description="Interactive chatbot forms"
                          checked={formData.allow_wa_forms}
                          onChange={(val) => setFormData({ ...formData, allow_wa_forms: val })}
                        />
                        <FeatureToggleRow
                          icon={QrCode}
                          label="REST API QR"
                          description="Programmatic QR session API"
                          checked={formData.rest_api_qr}
                          onChange={(val) => setFormData({ ...formData, rest_api_qr: val })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Channels & Developer APIs
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FeatureToggleRow
                          icon={Code2}
                          label="REST API Access"
                          description="Developer API keys"
                          checked={formData.allow_api}
                          onChange={(val) => setFormData({ ...formData, allow_api: val })}
                        />
                        <FeatureToggleRow
                          icon={Camera}
                          label="Instagram Inbox"
                          description="Unified Instagram direct chat"
                          checked={formData.instagram_inbox}
                          onChange={(val) => setFormData({ ...formData, instagram_inbox: val })}
                        />
                        <FeatureToggleRow
                          icon={Send}
                          label="Telegram Inbox"
                          description="Unified Telegram messaging"
                          checked={formData.telegram_inbox}
                          onChange={(val) => setFormData({ ...formData, telegram_inbox: val })}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Column: Live Card Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-3 sticky top-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Live Preview
                </div>

                <Card className="border-2 border-primary/40 shadow-xs overflow-hidden bg-card">
                  <CardHeader className="p-4 pb-3 border-b bg-gradient-to-br from-primary/5 via-card to-muted/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-foreground">
                        {formData.title || 'Untitled Tier'}
                      </h3>
                      {formData.is_trial ? (
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          TRIAL
                        </Badge>
                      ) : (
                        <Badge className="text-[10px]">PAID</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
                      {formData.short_description || 'No description provided.'}
                    </p>
                    <div className="flex items-baseline gap-2 mt-2 pt-2 border-t">
                      <span className="text-2xl font-black text-foreground">
                        {formData.is_trial ? `${baseCurrency.symbol}0` : `${baseCurrency.symbol}${formData.price || 0}`}
                      </span>
                      {formData.price_strike && !formData.is_trial && (
                        <span className="text-xs text-muted-foreground line-through">
                          ${formData.price_strike}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        / {formData.plan_duration_in_days || 30} days
                      </span>
                    </div>

                    {!formData.is_trial && (
                      <div className="pt-2 flex flex-wrap gap-1.5 border-t border-dashed">
                        {supportedCurrencies
                          .filter((c) => c.enabled && c.code.toUpperCase() !== baseCurrency.code.toUpperCase())
                          .map((curr) => {
                            const customVal = formData.currency_prices?.[curr.code];
                            const effectivePrice = (customVal !== "" && customVal !== undefined && customVal !== null)
                              ? customVal
                              : Math.round(Number(formData.price || 0) * (curr.rate || 1));
                            return (
                              <Badge
                                key={curr.code}
                                variant="outline"
                                className="text-[10px] font-mono px-2 py-0.5 bg-background shadow-2xs"
                              >
                                <span className="text-muted-foreground mr-1">{curr.code}:</span>
                                <span className="font-bold text-foreground">
                                  {curr.symbol}{effectivePrice}
                                </span>
                              </Badge>
                            );
                          })}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contacts Quota:</span>
                        <span className="font-bold text-foreground">
                          {Number(formData.contact_limit || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">QR Instances:</span>
                        <span className="font-bold text-foreground">{formData.qr_account || 0}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Feature Entitlements:
                      </p>
                      <div className="grid grid-cols-1 gap-1 text-[11px]">
                        {[
                          { label: 'Chatbot Automation', enabled: formData.allow_chatbot },
                          { label: 'REST API Access', enabled: formData.allow_api },
                          { label: 'Chat Tags & Notes', enabled: formData.allow_tag || formData.allow_note },
                          { label: 'WhatsApp Warmer', enabled: formData.wa_warmer },
                          { label: 'WhatsApp Forms', enabled: formData.allow_wa_forms },
                          { label: 'Instagram / Telegram', enabled: formData.instagram_inbox || formData.telegram_inbox },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            {item.enabled ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                item.enabled ? 'text-foreground font-medium' : 'text-muted-foreground line-through'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-card/80 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              disabled={formLoading}
              className="text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={formLoading}
              className="text-xs h-9 px-4"
            >
              {formLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {formMode === 'edit' ? 'Update Plan' : 'Save Plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Delete Subscription Plan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Are you sure you want to permanently delete plan <strong>{planToDelete?.title}</strong> (ID: {planToDelete?.id})?
              </p>
              <p className="text-muted-foreground">
                <strong>Safety Policy:</strong> The backend will reject deletion if any active subscribers are currently assigned to this plan.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="py-2.5 my-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium">{deleteError}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePlan();
              }}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
