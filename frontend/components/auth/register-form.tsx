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
import { GoogleAuthButton } from './google-auth-button';

export interface RegisterFormProps {
  onSuccess?: () => void;
  onRegistered?: (email: string) => void;
  onSwitchToLogin?: () => void;
  initialValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  onValuesChange?: (values: { name: string; email: string; phone: string }) => void;
}

/* ---------- Shared styles (44px touch targets, 16px text on mobile = no iOS zoom) ---------- */
const inputBase =
  'h-11 text-base sm:text-sm border-input placeholder:text-muted-foreground/70 transition-colors';
const inputOk =
  'focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:focus-visible:border-emerald-500';
const inputBad = 'border-destructive focus-visible:ring-destructive/30';

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-xs leading-snug text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function RegisterForm({
  onSuccess,
  onRegistered,
  onSwitchToLogin,
  initialValues,
  onValuesChange,
}: RegisterFormProps) {
  const { register } = useAuth();
  const router = useRouter();

  // Unique IDs for accessibility
  const nameInputId = useId();
  const emailInputId = useId();
  const phoneInputId = useId();
  const passwordInputId = useId();
  const consentInputId = useId();

  // Form State
  const [name, setName] = useState(initialValues?.name || '');
  const [email, setEmail] = useState(initialValues?.email || '');
  const [phone, setPhone] = useState(initialValues?.phone || '');
  const [password, setPassword] = useState('');
  const [acceptPolicy, setAcceptPolicy] = useState(false); // Unchecked by default per DPDP/GDPR
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync initialValues if updated from parent
  useEffect(() => {
    if (initialValues?.name !== undefined && initialValues.name !== name) {
      setName(initialValues.name);
    }
    if (initialValues?.email !== undefined && initialValues.email !== email) {
      setEmail(initialValues.email);
    }
    if (initialValues?.phone !== undefined && initialValues.phone !== phone) {
      setPhone(initialValues.phone);
    }
  }, [initialValues?.name, initialValues?.email, initialValues?.phone, name, email, phone]);

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
    if (trimmed.length < 2) return 'Name must be at least 2 characters.';
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
    if (!cleaned) return 'Please enter your WhatsApp number.';
    if (!/^\+[0-9]{8,16}$/.test(cleaned)) {
      return 'Enter a valid number with country code, e.g. +91 98765 43210.';
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
      return 'Please agree to the Terms and Privacy Policy to continue.';
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

  const strengthBarClass = passwordStrength.colorClass.split(' ')[0];
  const strengthTextClass = passwordStrength.colorClass.split(' ').slice(1).join(' ');

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

      if (onRegistered) {
        onRegistered(cleanEmail);
      } else {
        if (onSuccess) {
          onSuccess();
        }
        router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
      }
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
    <div className="space-y-4">
      <GoogleAuthButton
        text="signup_with"
        onSuccess={onSuccess}
        disabled={loading}
      />

      {/* Divider */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase">
          <span className="bg-background px-2 text-muted-foreground font-medium">
            Or register with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {serverError && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Full Name */}
        <div className="space-y-1.5 text-start">
          <Label htmlFor={nameInputId} className="text-sm font-medium text-foreground">
            Full name
          </Label>
          <Input
            id={nameInputId}
            type="text"
            placeholder="John Doe"
            required
            autoComplete="name"
            autoCapitalize="words"
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              if (serverError) setServerError(null);
              onValuesChange?.({ name: val, email, phone });
            }}
            onBlur={() => handleBlur('name')}
            onFocus={() => handleFocus('name')}
            disabled={loading}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${nameInputId}-error` : undefined}
            className={cn(inputBase, nameError ? inputBad : inputOk)}
          />
          <FieldError id={`${nameInputId}-error`} message={nameError} />
        </div>

        {/* Email */}
        <div className="space-y-1.5 text-start">
          <Label htmlFor={emailInputId} className="text-sm font-medium text-foreground">
            Email
          </Label>
          <Input
            id={emailInputId}
            type="email"
            inputMode="email"
            placeholder="name@company.com"
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              const val = e.target.value;
              setEmail(val);
              if (serverError) setServerError(null);
              onValuesChange?.({ name, email: val, phone });
            }}
            onBlur={() => handleBlur('email')}
            onFocus={() => handleFocus('email')}
            disabled={loading}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? `${emailInputId}-error` : undefined}
            className={cn(inputBase, emailError ? inputBad : inputOk)}
          />
          <FieldError id={`${emailInputId}-error`} message={emailError} />
        </div>

        {/* WhatsApp Phone Number */}
        <div className="text-start">
          <PhoneInput
            id={phoneInputId}
            label="WhatsApp number"
            required={false}
            value={phone}
            onChange={(val) => {
              setPhone(val);
              if (serverError) setServerError(null);
              onValuesChange?.({ name, email, phone: val });
            }}
            onBlur={() => handleBlur('phone')}
            onFocus={() => handleFocus('phone')}
            disabled={loading}
            error={phoneError}
            helperText="We'll use this number to verify your account and connect your WhatsApp workspace."
            className="w-full"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5 text-start">
          <Label htmlFor={passwordInputId} className="text-sm font-medium text-foreground">
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
              className={cn(inputBase, 'pr-11', passwordError ? inputBad : inputOk)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Persistent helper text */}
          <p id={`${passwordInputId}-helper`} className="text-[11px] text-muted-foreground leading-normal">
            Use at least 8 characters.
          </p>

          {/* Compact live strength meter (appears only while typing) */}
          {password.length > 0 && !passwordError && (
            <div
              id={`${passwordInputId}-strength`}
              className="flex items-center gap-2.5 pt-0.5"
              aria-live="polite"
            >
              <div className="grid flex-1 grid-cols-3 gap-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={cn(
                      'h-1 rounded-full transition-colors duration-300',
                      passwordStrength.score >= n ? strengthBarClass : 'bg-muted'
                    )}
                  />
                ))}
              </div>
              <span className={cn('w-14 text-right text-xs font-medium', strengthTextClass)}>
                {passwordStrength.label}
              </span>
            </div>
          )}

          <FieldError id={`${passwordInputId}-error`} message={passwordError} />
        </div>

        {/* Consent (unchecked by default) */}
        <div className="space-y-1.5 text-start">
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
              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-sm border-input accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            />
            <Label
              htmlFor={consentInputId}
              className="cursor-pointer select-none text-[13px] font-normal leading-snug text-muted-foreground"
            >
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Privacy Policy
              </Link>
            </Label>
          </div>
          <div className="pl-7">
            <FieldError id={`${consentInputId}-error`} message={consentError} />
          </div>
        </div>

        {/* Cloudflare Turnstile */}
        <div className="flex h-auto justify-center">
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

        {/* Submit */}
        <Button
          type="submit"
          className="h-11 w-full cursor-pointer rounded-lg  text-sm font-semibold text-white shadow-sm transition-all hover:scale-105 active:scale-[0.99]"
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

        {/* Sign-in navigation */}
        <p className="pt-0.5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="ml-0.5 cursor-pointer font-semibold text-primary hover:underline"
            >
              Sign in
            </button>
          ) : (
            <Link
              href="/login"
              className="ml-0.5 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Sign in
            </Link>
          )}
        </p>
      </form>
    </div>
  );
}

export default RegisterForm;