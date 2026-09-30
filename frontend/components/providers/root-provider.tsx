'use client';

import React from 'react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { CurrencyProvider } from '@/lib/currency/currency-context';
import { AuthDialogProvider } from '@/components/auth/auth-dialog-context';
import { AuthModals } from '@/components/auth/auth-modals';
import { Toaster } from '@/components/ui/sonner';

import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <CurrencyProvider>
          <AuthDialogProvider>
            <OnboardingProvider>
              {children}
              <AuthModals />
              <Toaster position="top-right" richColors closeButton />
            </OnboardingProvider>
          </AuthDialogProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
