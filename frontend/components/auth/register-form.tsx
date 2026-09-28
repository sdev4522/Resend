'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhoneInput } from '@/components/ui/phone-input';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptPolicy, setAcceptPolicy] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptPolicy) {
      setError('You must accept the Terms of Service & Privacy Policy');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const cleanPhone = (phone || '').trim();
    if (!cleanPhone || !/^\+[0-9]{8,16}$/.test(cleanPhone)) {
      setError('Please provide a valid WhatsApp phone number with country calling code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        mobile_with_country_code: cleanPhone,
        acceptPolicy: true,
      });

      if (onSuccess) {
        onSuccess();
      }

      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Full Name */}
      <div className="space-y-1 text-start">
        <Label htmlFor="reg-name" className="text-xs font-semibold">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="reg-name"
          placeholder="e.g. John Doe"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="h-10 text-sm"
        />
      </div>

      {/* Email Address */}
      <div className="space-y-1 text-start">
        <Label htmlFor="reg-email" className="text-xs font-semibold">
          Email address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="reg-email"
          type="email"
          placeholder="name@company.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="h-10 text-sm"
        />
      </div>

      {/* Standardized Phone Input (+91 India default) */}
      <PhoneInput
        id="reg-phone"
        label="WhatsApp Phone Number"
        required
        value={phone}
        onChange={setPhone}
        disabled={loading}
      />

      {/* Password & Confirm Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 text-start">
          <Label htmlFor="reg-password" className="text-xs font-semibold">
            Password <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-10 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1 text-start">
          <Label htmlFor="reg-confirm-password" className="text-xs font-semibold">
            Confirm Password <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="reg-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="h-10 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label="Toggle confirm password visibility"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start gap-2 pt-1">
        <input
          id="reg-accept"
          type="checkbox"
          checked={acceptPolicy}
          onChange={(e) => setAcceptPolicy(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5 cursor-pointer"
        />
        <Label htmlFor="reg-accept" className="text-[11px] text-muted-foreground leading-snug cursor-pointer">
          I agree to the Terms of Service and Privacy Policy
        </Label>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-10 text-sm font-medium"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      <div className="text-center text-xs text-muted-foreground pt-1">
        Already have an account?{' '}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary font-semibold hover:underline ml-0.5"
          >
            Sign in
          </button>
        ) : (
          <Link href="/login" className="text-primary font-semibold hover:underline ml-0.5">
            Sign in
          </Link>
        )}
      </div>
    </form>
  );
}

export default RegisterForm;
