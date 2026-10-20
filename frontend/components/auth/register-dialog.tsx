'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuthDialog } from './auth-dialog-context';
import { RegisterForm } from './register-form';
import { VerifyEmailForm } from './verify-email-form';
import Stepper, { Step } from '@/components/Stepper';
import { MessageCircle, MailCheck } from 'lucide-react';

export function RegisterDialog() {
  const router = useRouter();
  const { dialog, closeDialog, openLogin } = useAuthDialog();
  const { resolvedTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeDialog();
      // Reset back to Step 1 when modal is closed
      setStep(1);
    }
  };

  const stepperTheme: 'dark' | 'light' = mounted && resolvedTheme === 'light' ? 'light' : 'dark';

  return (
    <Dialog open={dialog === 'register'} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-5 sm:max-w-[460px] sm:p-6">
        <DialogHeader className="items-center gap-1.5 text-center">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/10 transition-colors">
            {step === 1 ? (
              <MessageCircle className="h-5 w-5" />
            ) : (
              <MailCheck className="h-5 w-5" />
            )}
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {step === 1 ? 'Start your free WhatsApp CRM trial' : 'Verify your email'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {step === 1
              ? 'WhatsApp CRM · 14 days free · No credit card required'
              : 'Enter the 6-digit verification code sent to your inbox'}
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          <Stepper
            step={step}
            theme={stepperTheme}
            accentColor="#059669"
            frame={false}
            linear={true}
            disableStepIndicators={true}
            showFooter={false}
            width="100%"
            className="w-full"
            contentClassName="pt-1"
          >
            <Step title="Create account">
              <RegisterForm
                initialValues={formData}
                onValuesChange={setFormData}
                onRegistered={(email) => {
                  setRegisteredEmail(email);
                  setFormData((prev) => ({ ...prev, email }));
                  setStep(2);
                }}
                onSuccess={closeDialog}
                onSwitchToLogin={openLogin}
              />
            </Step>

            <Step title="Verify email">
              <VerifyEmailForm
                email={registeredEmail || formData.email}
                onBackToRegister={() => setStep(1)}
                onSuccess={() => {
                  closeDialog();
                  router.push('/onboarding');
                }}
              />
            </Step>
          </Stepper>
        </div>
      </DialogContent>
    </Dialog>
  );
}