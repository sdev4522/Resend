'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { OnboardingModal } from './onboarding-modal';

interface OnboardingContextType {
  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isOnboardingOpen: false,
  openOnboarding: () => {},
  closeOnboarding: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Automatically prompt onboarding modal if user is authenticated but has not completed workspace setup (no timezone)
  useEffect(() => {
    if (status === 'AUTHENTICATED' && user && !user.timezone && user.role !== 'admin') {
      setIsOnboardingOpen(true);
    } else {
      setIsOnboardingOpen(false);
    }
  }, [status, user]);

  const openOnboarding = () => setIsOnboardingOpen(true);
  const closeOnboarding = () => setIsOnboardingOpen(false);

  return (
    <OnboardingContext.Provider value={{ isOnboardingOpen, openOnboarding, closeOnboarding }}>
      {children}
      {isOnboardingOpen && (
        <OnboardingModal open={isOnboardingOpen} onComplete={() => setIsOnboardingOpen(false)} />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
