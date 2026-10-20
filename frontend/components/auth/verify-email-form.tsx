'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VerifyEmailFormProps {
  email: string;
  onSuccess?: () => void;
  onBackToRegister?: () => void;
  initialCode?: string;
  allowEditEmail?: boolean;
  className?: string;
}

export function VerifyEmailForm({
  email: initialEmail,
  onSuccess,
  onBackToRegister,
  initialCode = '',
  allowEditEmail = false,
  className,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const { verifyEmail, resendVerification } = useAuth();

  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(60);
  const [isVerified, setIsVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);

  // Sync email when prop changes
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Handle initialCode
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      const digits = initialCode.split('').slice(0, 6);
      setOtpDigits(digits);
    }
  }, [initialCode]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerifyDigits = useCallback(
    async (userEmail: string, fullCode: string) => {
      if (isVerifyingRef.current || loading || isVerified) return;

      if (!userEmail) {
        setError('Please provide your registered email address.');
        return;
      }
      if (fullCode.length !== 6) {
        setError('Please enter all 6 digits of the verification code.');
        return;
      }

      isVerifyingRef.current = true;
      setError(null);
      setLoading(true);

      try {
        const res = await verifyEmail({ email: userEmail, otp: fullCode });
        if (res.success) {
          setIsVerified(true);
          setSuccessMsg(res.msg || 'Email verified successfully!');
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              router.push('/onboarding');
            }
          }, 800);
        } else {
          setError(res.msg || 'Invalid verification code.');
        }
      } catch (err: any) {
        setError(err.message || 'Verification failed. Please check the code and try again.');
      } finally {
        setLoading(false);
        isVerifyingRef.current = false;
      }
    },
    [verifyEmail, onSuccess, router, loading, isVerified]
  );

  const handleDigitChange = (index: number, value: string) => {
    setError(null);
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // Pasted multiple digits into an input
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

    // Single digit input
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned[0];
    setOtpDigits(newDigits);

    // Auto-advance focus to next digit
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
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
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
        setSuccessMsg('A fresh 6-digit code has been sent to your email.');
        setCooldown(res.cooldown || 60);
      } else {
        setError(res.msg || 'Unable to resend verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('space-y-4', className)}>
      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs leading-snug">{error}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs font-medium leading-snug">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Email Display / Edit Strip */}
      {email ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-start">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Code sent to</p>
              <p className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-[240px]">
                {email}
              </p>
            </div>
          </div>
          {onBackToRegister ? (
            <button
              type="button"
              onClick={onBackToRegister}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors shrink-0 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          ) : allowEditEmail ? (
            <button
              type="button"
              onClick={() => setEmail('')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors shrink-0 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              <span>Change</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5 text-start">
          <label htmlFor="verify-email-input" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <Input
            id="verify-email-input"
            type="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || isVerified}
            className="h-11 text-base sm:text-sm"
          />
        </div>
      )}

      {/* 6-Digit OTP Inputs */}
      <div className="space-y-2 pt-1 text-center">
        <label className="text-xs font-medium text-muted-foreground block text-start">
          Enter 6-digit verification code
        </label>
        <div className="flex justify-center items-center gap-1.5 xs:gap-2 sm:gap-2.5">
          {otpDigits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading || isVerified}
              aria-label={`Digit ${index + 1}`}
              className="h-11 w-9.5 xs:h-12 xs:w-10 sm:h-12 sm:w-11 text-center text-lg sm:text-xl font-bold font-mono rounded-lg border border-input bg-background shadow-xs transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
              autoFocus={index === 0}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground pt-0.5">
          Code expires in 30 minutes
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="h-11 w-full cursor-pointer rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-600 dark:hover:bg-emerald-700"
        disabled={loading || isVerified || otpDigits.join('').length !== 6}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying code...
          </>
        ) : isVerified ? (
          <>
            <span>Verified! Setting up account...</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        ) : (
          'Verify email & continue'
        )}
      </Button>

      {/* Resend Action */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-0.5">
        <span>Didn&apos;t receive the code?</span>
        {cooldown > 0 ? (
          <span className="font-mono text-muted-foreground text-xs">
            Resend in {cooldown}s
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || isVerified || !email}
            className="cursor-pointer font-semibold text-emerald-600 hover:underline dark:text-emerald-400 flex items-center gap-1 disabled:opacity-50"
          >
            {resending && <RefreshCw className="h-3 w-3 animate-spin" />}
            <span>Resend code</span>
          </button>
        )}
      </div>

      {/* Back to register or standalone links */}
      {onBackToRegister ? (
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
          Need to correct account details?{' '}
          <button
            type="button"
            onClick={onBackToRegister}
            className="cursor-pointer font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Back to account creation
          </button>
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
          Wrong email address?{' '}
          <Link href="/register" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Create another account
          </Link>
          {' · '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Sign in
          </Link>
        </div>
      )}
    </form>
  );
}
