'use client';

import React from 'react';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';

export default function OnboardingPage() {
  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center">
      {/* 
        The 3-step Onboarding Modal opens automatically on desktop as Dialog 
        and on mobile as full-screen Sheet with touch targets 44px+ and resumable state.
      */}
      <OnboardingModal open={true} />
    </div>
  );
}
