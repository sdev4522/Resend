'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendVerification } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const codeParam = searchParams.get('code') || searchParams.get('token') || searchParams.get('otp') || '';

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(60);
  const [isVerified, setIsVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleVerifyDigits = useCallback(async (userEmail: string, fullCode: string) => {
    if (!userEmail) {
      setError('Please provide your registered email address.');
      return;
    }
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await verifyEmail({ email: userEmail, otp: fullCode });
      if (res.success) {
        setIsVerified(true);
        setSuccessMsg(res.msg || 'Email verified successfully!');
        setTimeout(() => {
          router.push('/onboarding');
        }, 1000);
      } else {
        setError(res.msg || 'Invalid verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  }, [verifyEmail, router]);

  // Update email if query param changes
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Handle auto-population from URL
  useEffect(() => {
    if (codeParam && codeParam.length === 6) {
      const digits = codeParam.split('').slice(0, 6);
      setOtpDigits(digits);
      if (emailParam) {
        handleVerifyDigits(emailParam, codeParam);
      }
    }
  }, [codeParam, emailParam, handleVerifyDigits]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    setError(null);
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // If pasted multiple digits
    if (cleaned.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6 && index + i < 6; i++) {
        if (cleaned[i]) {
          newDigits[index + i] = cleaned[i];
        }
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + cleaned.length, 5);
      inputRefs.current[nextFocus]?.focus();

      const fullCode = newDigits.join('');
      if (fullCode.length === 6 && email) {
        handleVerifyDigits(email, fullCode);
      }
      return;
    }

    // Single digit entry
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned[0];
    setOtpDigits(newDigits);

    // Auto-advance
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && email) {
      handleVerifyDigits(email, fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasteData.length; i++) {
      newDigits[i] = pasteData[i];
    }
    setOtpDigits(newDigits);

    const focusIndex = Math.min(pasteData.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (pasteData.length === 6 && email) {
      handleVerifyDigits(email, pasteData);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerifyDigits(email, otpDigits.join(''));
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;

    setError(null);
    setSuccessMsg(null);
    setResending(true);

    try {
      const res = await resendVerification({ email });
      if (res.success) {
        setSuccessMsg('A fresh 6-digit verification code has been sent to your email.');
        setCooldown(res.cooldown || 60);
      } else {
        setError(res.msg || 'Unable to resend verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-full shadow-lg border-border/80">
      <CardHeader className="space-y-2 text-center pb-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-1">
          {isVerified ? <CheckCircle2 className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {isVerified ? 'Email Verified!' : 'Verify your email'}
        </CardTitle>
        <CardDescription className="text-xs max-w-sm mx-auto leading-relaxed">
          {email ? (
            <>
              We sent a 6-digit verification code to <span className="font-semibold text-foreground">{email}</span>.
              Enter it below to activate your account.
            </>
          ) : (
            'Enter your registered email and the 6-digit code sent to your inbox.'
          )}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <AlertDescription className="text-xs font-medium">{successMsg}</AlertDescription>
            </Alert>
          )}

          {!emailParam && (
            <div className="space-y-1 text-start">
              <label htmlFor="verify-email-input" className="text-xs font-semibold text-foreground">
                Email Address
              </label>
              <Input
                id="verify-email-input"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || isVerified}
                className="h-10 text-sm"
              />
            </div>
          )}

          {/* 6-Digit OTP Input Grid */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-center items-center gap-2 sm:gap-2.5">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={loading || isVerified}
                  aria-label={`Digit ${index + 1}`}
                  className="h-12 w-10 sm:h-13 sm:w-12 text-center text-xl font-bold font-mono rounded-lg border border-input bg-background shadow-xs transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  autoFocus={index === 0}
                />
              ))}
            </div>
            <p className="text-[11px] text-center text-muted-foreground pt-1">
              Code expires in 30 minutes
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            className="w-full h-10 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={loading || isVerified || otpDigits.join('').length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying Code...
              </>
            ) : isVerified ? (
              <>
                <span>Verified! Proceeding to Setup</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              'Verify & Continue'
            )}
          </Button>

          {/* Resend Action */}
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground pt-1 px-1">
            <span>Didn&apos;t receive the code?</span>
            {cooldown > 0 ? (
              <span className="text-muted-foreground font-mono text-xs">
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || isVerified || !email}
                className="text-emerald-600 hover:underline font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {resending ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                <span>Resend code</span>
              </button>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2 border-t w-full">
            Wrong email address?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create another account
            </Link>
            {' · '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </form>
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
