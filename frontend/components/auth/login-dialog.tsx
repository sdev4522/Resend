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
import { LoginForm } from './login-form';
import { MessageCircle } from 'lucide-react';

export function LoginDialog() {
  const { dialog, closeDialog, openRegister } = useAuthDialog();

  return (
    <Dialog open={dialog === 'login'} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-2 text-center items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <MessageCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Sign in to WaCRM
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter your email and password to access your workspace
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <LoginForm
            onSuccess={closeDialog}
            onSwitchToRegister={openRegister}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
