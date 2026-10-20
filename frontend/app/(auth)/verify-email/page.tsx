'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2 } from 'lucide-react';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const codeParam =
    searchParams.get('code') || searchParams.get('token') || searchParams.get('otp') || '';

  return (
    <Card className="w-full shadow-lg border-border/80">
      <CardHeader className="space-y-2 text-center pb-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-1">
          <Mail className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Verify your email
        </CardTitle>
        <CardDescription className="text-xs max-w-sm mx-auto leading-relaxed">
          {emailParam ? (
            <>
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-foreground">{emailParam}</span>. Enter it
              below to activate your account.
            </>
          ) : (
            'Enter your registered email and the 6-digit code sent to your inbox to activate your account.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <VerifyEmailForm
          email={emailParam}
          initialCode={codeParam}
          allowEditEmail={true}
        />
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full shadow-lg border-border/80 p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading verification screen...</p>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
