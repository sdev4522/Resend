'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuthDialog } from './auth-dialog-context';
import { RegisterForm } from './register-form';
import { MessageCircle } from 'lucide-react';

export function RegisterDialog() {
  const { dialog, closeDialog, openLogin } = useAuthDialog();

  return (
    <Dialog open={dialog === 'register'} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 text-center items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <MessageCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Create your Resend account
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Start your 14-day WhatsApp CRM trial. No credit card required.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <RegisterForm
            onSuccess={closeDialog}
            onSwitchToLogin={openLogin}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
