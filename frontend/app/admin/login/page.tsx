'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center p-4 bg-muted/30">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <Card className="shadow-xl border-border/80">
          <CardHeader className="space-y-2 text-center pb-4 items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">System Administration</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Restricted portal. Super-administrator credentials required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminLoginForm />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        Resend Administration Engine
      </div>
    </div>
  );
}
