'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <Card className="w-full shadow-lg border-border/80">
      <CardHeader className="space-y-1 text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Start your free WhatsApp CRM trial
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Manage WhatsApp conversations, contacts, and campaigns from one workspace.
        </CardDescription>
        <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 pt-1">
          14 days free · No credit card required
        </div>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
