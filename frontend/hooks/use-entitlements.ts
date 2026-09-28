'use client';

import { useState, useEffect, useCallback } from 'react';
import { billingApi } from '@/lib/api/billing';
import { UserPlanDetails } from '@/types/billing';

export function useEntitlements() {
  const [data, setData] = useState<UserPlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await billingApi.getPlanDetails();
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.msg || 'Failed to load plan details');
      }
    } catch (err: any) {
      setError(err?.data?.msg || err?.message || 'Error loading plan details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  const hasFeature = useCallback(
    (feature: keyof UserPlanDetails['entitlements']): boolean => {
      if (!data?.entitlements) return false;
      return !!data.entitlements[feature];
    },
    [data]
  );

  const getLimit = useCallback(
    (resource: 'contacts' | 'qr_accounts'): number => {
      if (!data?.usage?.[resource]) return 0;
      return data.usage[resource].limit;
    },
    [data]
  );

  const getUsage = useCallback(
    (resource: 'contacts' | 'qr_accounts') => {
      if (!data?.usage?.[resource]) {
        return { used: 0, limit: 0, remaining: 0, percentage: 0 };
      }
      return data.usage[resource];
    },
    [data]
  );

  const isLimitApproaching = useCallback(
    (resource: 'contacts' | 'qr_accounts', thresholdPercent = 80): boolean => {
      const u = getUsage(resource);
      if (u.limit <= 0) return false;
      return u.percentage >= thresholdPercent && u.percentage < 100;
    },
    [getUsage]
  );

  const isLimitReached = useCallback(
    (resource: 'contacts' | 'qr_accounts'): boolean => {
      const u = getUsage(resource);
      if (u.limit <= 0) return false;
      return u.used >= u.limit;
    },
    [getUsage]
  );

  return {
    data,
    loading,
    error,
    refresh: fetchEntitlements,
    hasFeature,
    getLimit,
    getUsage,
    isLimitApproaching,
    isLimitReached,
    plan: data?.plan || null,
    isExpired: data?.isExpired || false,
    daysLeft: data?.daysLeft || 0,
  };
}
