'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SupportedBillingCurrency } from '@/types/billing';
import { billingApi } from '@/lib/api/billing';

interface CurrencyContextType {
  selectedCurrency: string;
  currencySymbol: string;
  activeRate: number;
  supportedCurrencies: SupportedBillingCurrency[];
  detectedCurrency: string | null;
  detectedCountry: string | null;
  isAutoDetected: boolean;
  setCurrency: (code: string) => void;
  isLoading: boolean;
}

const DEFAULT_CURRENCY: SupportedBillingCurrency = {
  code: 'USD',
  symbol: '$',
  rate: 1.0,
  name: 'US Dollar',
  enabled: true,
};

const CurrencyContext = createContext<CurrencyContextType>({
  selectedCurrency: 'USD',
  currencySymbol: '$',
  activeRate: 1.0,
  supportedCurrencies: [DEFAULT_CURRENCY],
  detectedCurrency: null,
  detectedCountry: null,
  isAutoDetected: false,
  setCurrency: () => {},
  isLoading: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [activeRate, setActiveRate] = useState<number>(1.0);
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedBillingCurrency[]>([DEFAULT_CURRENCY]);
  const [detectedCurrency, setDetectedCurrency] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let saved: string | null = null;
    if (typeof window !== 'undefined') {
      saved = localStorage.getItem('wacrm_selected_currency');
    }

    Promise.all([
      billingApi.getPlans().catch(() => null),
      saved ? Promise.resolve(null) : billingApi.detectCurrency().catch(() => null),
    ]).then(([plansRes, detectRes]) => {
      let list = [DEFAULT_CURRENCY];
      let baseCurr = 'USD';
      let baseSym = '$';

      if (plansRes && plansRes.success) {
        baseCurr = plansRes.currency || 'USD';
        baseSym = plansRes.currencySymbol || '$';
        if (plansRes.supportedCurrencies && plansRes.supportedCurrencies.length > 0) {
          list = plansRes.supportedCurrencies;
        } else {
          list = [{ code: baseCurr, symbol: baseSym, rate: 1.0, name: baseCurr, enabled: true }];
        }
        setSupportedCurrencies(list);
      }

      if (detectRes && detectRes.success) {
        setDetectedCurrency(detectRes.currency);
        setDetectedCountry(detectRes.country);
      }

      // Determine initial currency:
      // 1. User manual override from localStorage
      // 2. Auto-detected currency from GeoIP/Locale (if enabled in supported list)
      // 3. Base currency from database
      // 4. Default fallback: USD
      let targetCode = saved;
      let wasAuto = false;

      if (!targetCode && detectRes?.success && detectRes.currency) {
        const foundAuto = list.find(
          (c) => c.code.toUpperCase() === detectRes.currency.toUpperCase() && c.enabled !== false
        );
        if (foundAuto) {
          targetCode = foundAuto.code;
          wasAuto = true;
        }
      }

      if (!targetCode) {
        targetCode = baseCurr;
      }

      const matched = list.find((c) => c.code.toUpperCase() === targetCode.toUpperCase() && c.enabled !== false)
        || list.find((c) => c.code.toUpperCase() === baseCurr.toUpperCase())
        || list[0];

      if (matched) {
        setSelectedCurrency(matched.code);
        setCurrencySymbol(matched.symbol);
        setActiveRate(matched.rate || 1.0);
        setIsAutoDetected(wasAuto);
      }
    }).catch((err) => {
      console.warn('Currency config load error:', err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const setCurrency = useCallback((code: string) => {
    const matched = supportedCurrencies.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (matched) {
      setSelectedCurrency(matched.code);
      setCurrencySymbol(matched.symbol);
      setActiveRate(matched.rate || 1.0);
      setIsAutoDetected(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('wacrm_selected_currency', matched.code);
      }
    }
  }, [supportedCurrencies]);

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        currencySymbol,
        activeRate,
        supportedCurrencies,
        detectedCurrency,
        detectedCountry,
        isAutoDetected,
        setCurrency,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
