'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const [initialError, setInitialError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam === 'session_expired') {
        setInitialError('Your session has expired. Please sign in again.');
      } else if (errorParam === 'unauthorized_admin') {
        setInitialError('You do not have administrator permissions to access that page.');
      }
    }
  }, []);

  return (
    <Card className="w-full shadow-lg border-border/80">
      <CardHeader className="space-y-1 text-center pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">Sign in to Resend</CardTitle>
        <CardDescription className="text-xs">
          Enter your email and password to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm initialError={initialError} />
      </CardContent>
    </Card>
  );
}
