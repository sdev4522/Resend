'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Automatically prompt onboarding modal if user is authenticated as 'user' (MED-05: exclude agents and admin)
  // and has not completed workspace setup (no timezone), and dedupe if already on /onboarding page (MED-05)
  useEffect(() => {
    if (
      status === 'AUTHENTICATED' &&
      user &&
      user.role === 'user' &&
      !user.timezone &&
      pathname !== '/onboarding'
    ) {
      setIsOnboardingOpen(true);
    } else {
      setIsOnboardingOpen(false);
    }
  }, [status, user, pathname]);

  const openOnboarding = () => {
    if (user?.role === 'user' && pathname !== '/onboarding') {
      setIsOnboardingOpen(true);
    }
  };
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
