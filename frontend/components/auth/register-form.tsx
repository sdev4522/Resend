'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneInput } from '@/components/ui/phone-input';
import { Turnstile, TurnstileRef } from '@/components/security/turnstile';
import { trackEvent } from '@/lib/analytics/tracker';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const router = useRouter();

  // Unique IDs for accessibility
  const nameInputId = useId();
  const emailInputId = useId();
  const phoneInputId = useId();
  const passwordInputId = useId();
  const consentInputId = useId();

  // Form State — 4 fields + explicit unchecked consent
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [acceptPolicy, setAcceptPolicy] = useState(false); // Unchecked by default per DPDP/GDPR
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Field validation and interaction state
  const [touched, setTouched] = useState<{
    name?: boolean;
    email?: boolean;
    phone?: boolean;
    password?: boolean;
    consent?: boolean;
  }>({});
  const [submitted, setSubmitted] = useState(false);

  // Refs for widget and telemetry
  const turnstileRef = useRef<TurnstileRef>(null);
  const mountTimeRef = useRef<number | null>(null);
  const hasTrackedViewRef = useRef<boolean>(false);

  // Instrument signup_view analytics once on mount
  useEffect(() => {
    mountTimeRef.current = Date.now();
    if (!hasTrackedViewRef.current) {
      hasTrackedViewRef.current = true;
      trackEvent('signup_view');
    }
  }, []);

  // Validation functions
  const getNameError = (val: string): string | null => {
    const trimmed = (val || '').trim();
    if (!trimmed) return 'Please enter your full name.';
    if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
    return null;
  };

  const getEmailError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please enter a valid email address.';
    }
    return null;
  };

  const getPhoneError = (val: string): string | null => {
    const cleaned = (val || '').trim();
    if (!cleaned) return 'Please enter your WhatsApp phone number.';
    if (!/^\+[0-9]{8,16}$/.test(cleaned)) {
      return 'Please provide a valid phone number with country calling code (e.g. +91 98765 43210).';
    }
    return null;
  };

  const getPasswordError = (val: string): string | null => {
    if (!val) return 'Please enter a password.';
    if (val.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const getConsentError = (accepted: boolean): string | null => {
    if (!accepted) {
      return 'Please agree to the Terms of Service and Privacy Policy to continue.';
    }
    return null;
  };

  // Evaluate password strength based on meaningful characteristics
  const passwordStrength = React.useMemo(() => {
    if (!password) {
      return { score: 0, label: '', colorClass: '' };
    }
    if (password.length < 8) {
      return { score: 1, label: 'Weak', colorClass: 'bg-red-500 text-red-600 dark:text-red-400' };
    }

    let criteriaMet = 0;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) criteriaMet++;
    if (/[0-9]/.test(password)) criteriaMet++;
    if (/[^a-zA-Z0-9]/.test(password)) criteriaMet++;
    if (password.length >= 12) criteriaMet++;

    if (criteriaMet < 2) {
      return { score: 1, label: 'Weak', colorClass: 'bg-red-500 text-red-600 dark:text-red-400' };
    }
    if (criteriaMet < 4) {
      return { score: 2, label: 'Medium', colorClass: 'bg-amber-500 text-amber-600 dark:text-amber-400' };
    }
    return { score: 3, label: 'Strong', colorClass: 'bg-emerald-500 text-emerald-600 dark:text-emerald-400' };
  }, [password]);

  // Active validation errors
  const nameError = (touched.name || submitted) ? getNameError(name) : null;
  const emailError = (touched.email || submitted) ? getEmailError(email) : null;
  const phoneError = (touched.phone || submitted) ? getPhoneError(phone) : null;
  const passwordError = (touched.password || submitted) ? getPasswordError(password) : null;
  const consentError = (touched.consent || submitted) ? getConsentError(acceptPolicy) : null;

  // Handlers for blur and focus telemetry
  const handleBlur = (field: 'name' | 'email' | 'phone' | 'password' | 'consent') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let err: string | null = null;
    if (field === 'name') err = getNameError(name);
    else if (field === 'email') err = getEmailError(email);
    else if (field === 'phone') err = getPhoneError(phone);
    else if (field === 'password') err = getPasswordError(password);
    else if (field === 'consent') err = getConsentError(acceptPolicy);

    if (err) {
      trackEvent('field_error', { field });
    }
  };

  const handleFocus = (field: 'name' | 'email' | 'phone' | 'password') => {
    trackEvent('field_focus', { field });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission

    setSubmitted(true);
    setServerError(null);

    // Validate all fields
    const currentNameError = getNameError(name);
    const currentEmailError = getEmailError(email);
    const currentPhoneError = getPhoneError(phone);
    const currentPasswordError = getPasswordError(password);
    const currentConsentError = getConsentError(acceptPolicy);

    if (currentNameError || currentEmailError || currentPhoneError || currentPasswordError || currentConsentError) {
      if (currentNameError) trackEvent('field_error', { field: 'name' });
      if (currentEmailError) trackEvent('field_error', { field: 'email' });
      if (currentPhoneError) trackEvent('field_error', { field: 'phone' });
      if (currentPasswordError) trackEvent('field_error', { field: 'password' });
      if (currentConsentError) trackEvent('field_error', { field: 'consent' });
      return;
    }

    if (!turnstileToken) {
      setServerError('Please complete the security verification before continuing.');
      return;
    }

    trackEvent('signup_submit', { has_turnstile: Boolean(turnstileToken) });
    setLoading(true);

    try {
      const cleanPhone = phone.trim();
      const cleanEmail = email.trim().toLowerCase();

      await register({
        name: name.trim(),
        email: cleanEmail,
        password,
        mobile_with_country_code: cleanPhone,
        acceptPolicy: true,
        turnstileToken,
      });

      const completionTime = mountTimeRef.current ? Date.now() - mountTimeRef.current : 0;
      trackEvent('signup_success', { duration_ms: completionTime });

      if (onSuccess) {
        onSuccess();
      }

      router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please try again.');
      // Reset Turnstile token on failure while preserving user form data
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
      {serverError && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Field 1: Full Name */}
      <div className="space-y-1.5 text-start">
        <Label htmlFor={nameInputId} className="text-sm font-semibold text-foreground">
          Full Name
        </Label>
        <Input
          id={nameInputId}
          type="text"
          placeholder="e.g. John Doe"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (serverError) setServerError(null);
          }}
          onBlur={() => handleBlur('name')}
          onFocus={() => handleFocus('name')}
          disabled={loading}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? `${nameInputId}-error` : undefined}
          className={cn(
            'h-10 text-sm border-input placeholder:text-[#8b8b8b] dark:placeholder:text-zinc-400 transition-colors',
            nameError
              ? 'border-destructive focus-visible:ring-destructive/30'
              : 'focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:focus-visible:border-emerald-500'
          )}
        />
        {nameError && (
          <p
            id={`${nameInputId}-error`}
            className="text-[11px] text-destructive flex items-center gap-1.5 pt-0.5 leading-normal"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{nameError}</span>
          </p>
        )}
      </div>

      {/* Field 2: Email Address */}
      <div className="space-y-1.5 text-start">
        <Label htmlFor={emailInputId} className="text-sm font-semibold text-foreground">
          Email address
        </Label>
        <Input
          id={emailInputId}
          type="email"
          placeholder="name@company.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (serverError) setServerError(null);
          }}
          onBlur={() => handleBlur('email')}
          onFocus={() => handleFocus('email')}
          disabled={loading}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? `${emailInputId}-error` : undefined}
          className={cn(
            'h-10 text-sm border-input placeholder:text-[#8b8b8b] dark:placeholder:text-zinc-400 transition-colors',
            emailError
              ? 'border-destructive focus-visible:ring-destructive/30'
              : 'focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:focus-visible:border-emerald-500'
          )}
        />
        {emailError && (
          <p
            id={`${emailInputId}-error`}
            className="text-[11px] text-destructive flex items-center gap-1.5 pt-0.5 leading-normal"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{emailError}</span>
          </p>
        )}
      </div>

      {/* Field 3: WhatsApp Phone Number with country calling code */}
      <div className="space-y-1.5 text-start">
        <PhoneInput
          id={phoneInputId}
          label="WhatsApp Phone Number"
          required={false}
          value={phone}
          onChange={(val) => {
            setPhone(val);
            if (serverError) setServerError(null);
          }}
          onBlur={() => handleBlur('phone')}
          onFocus={() => handleFocus('phone')}
          disabled={loading}
          error={phoneError}
          helperText="We'll use this number to verify your account and connect your WhatsApp workspace."
          className="w-full"
        />
      </div>

      {/* Field 4: Password with persistent helper text and live strength feedback */}
      <div className="space-y-1.5 text-start">
        <Label htmlFor={passwordInputId} className="text-sm font-semibold text-foreground">
          Password
        </Label>
        <div className="relative">
          <Input
            id={passwordInputId}
            type={showPassword ? 'text' : 'password'}
            placeholder="Min 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (serverError) setServerError(null);
            }}
            onBlur={() => handleBlur('password')}
            onFocus={() => handleFocus('password')}
            disabled={loading}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={
              passwordError
                ? `${passwordInputId}-error`
                : `${passwordInputId}-helper ${passwordInputId}-strength`
            }
            className={cn(
              'h-10 pr-10 text-sm border-input placeholder:text-[#8b8b8b] dark:placeholder:text-zinc-400 transition-colors',
              passwordError
                ? 'border-destructive focus-visible:ring-destructive/30'
                : 'focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:focus-visible:border-emerald-500'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Persistent helper text */}
        <p id={`${passwordInputId}-helper`} className="text-[11px] text-muted-foreground leading-normal">
          Use at least 8 characters.
        </p>

        {/* Live Password Strength Meter */}
        {password.length > 0 && (
          <div
            id={`${passwordInputId}-strength`}
            className="pt-1 space-y-1.5"
            aria-live="polite"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Password strength:</span>
              <span className={cn('font-semibold', passwordStrength.colorClass)}>
                {passwordStrength.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
              <div
                className={cn(
                  'h-full rounded-full transition-colors',
                  passwordStrength.score >= 1 ? passwordStrength.colorClass.split(' ')[0] : 'bg-muted'
                )}
              />
              <div
                className={cn(
                  'h-full rounded-full transition-colors',
                  passwordStrength.score >= 2 ? passwordStrength.colorClass.split(' ')[0] : 'bg-muted'
                )}
              />
              <div
                className={cn(
                  'h-full rounded-full transition-colors',
                  passwordStrength.score >= 3 ? passwordStrength.colorClass.split(' ')[0] : 'bg-muted'
                )}
              />
            </div>
          </div>
        )}

        {passwordError && (
          <p
            id={`${passwordInputId}-error`}
            className="text-[11px] text-destructive flex items-center gap-1.5 pt-0.5 leading-normal"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{passwordError}</span>
          </p>
        )}
      </div>

      {/* Controlled Terms and Privacy Policy Consent Checkbox (unchecked by default) */}
      <div className="space-y-1 text-start pt-0.5">
        <div className="flex items-start gap-2.5">
          <input
            id={consentInputId}
            type="checkbox"
            checked={acceptPolicy}
            onChange={(e) => {
              setAcceptPolicy(e.target.checked);
              setTouched((prev) => ({ ...prev, consent: true }));
              if (serverError) setServerError(null);
            }}
            aria-invalid={Boolean(consentError)}
            aria-describedby={consentError ? `${consentInputId}-error` : undefined}
            className="h-4 w-4 rounded-sm border-input text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 mt-0.5 cursor-pointer accent-emerald-600"
          />
          <Label
            htmlFor={consentInputId}
            className="text-xs text-muted-foreground leading-snug cursor-pointer select-none"
          >
            I agree to the{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Privacy Policy
            </Link>
          </Label>
        </div>

        {consentError && (
          <p
            id={`${consentInputId}-error`}
            className="text-[11px] text-destructive flex items-center gap-1.5 pl-6 pt-0.5 leading-normal"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{consentError}</span>
          </p>
        )}
      </div>

      {/* Cloudflare Turnstile (Standard Verification) */}
      <div className="flex justify-center py-1">
        <Turnstile
          ref={turnstileRef}
          action="signup"
          size="normal"
          onSuccess={(token) => {
            setTurnstileToken(token);
            setServerError(null);
          }}
          onExpire={() => {
            setTurnstileToken('');
          }}
          onError={() => {
            setTurnstileToken('');
          }}
          onTimeout={() => {
            setTurnstileToken('');
          }}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-10 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
        disabled={loading || !turnstileToken}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting free trial...
          </>
        ) : (
          'Start free trial'
        )}
      </Button>

      {/* Clearly visible Sign-in navigation */}
      <div className="text-center text-sm text-muted-foreground pt-1">
        Already have an account?{' '}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer ml-0.5"
          >
            Sign in
          </button>
        ) : (
          <Link
            href="/login"
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline ml-0.5"
          >
            Sign in
          </Link>
        )}
      </div>
    </form>
  );
}

export default RegisterForm;
