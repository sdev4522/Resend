'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  initialError?: string | null;
}

export function LoginForm({ onSuccess, onSwitchToRegister, initialError = null }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setLoading(true);

    try {
      await login({ email, password });
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('verify your email')) {
        setUnverifiedEmail(email.trim().toLowerCase());
      } else {
        setError(err.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {unverifiedEmail && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <AlertDescription className="text-xs flex items-center justify-between">
            <span>Please verify your email to continue.</span>
            <Link
              href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              className="font-semibold underline ml-2 shrink-0 hover:text-amber-900 dark:hover:text-amber-100"
            >
              Verify now
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5 text-start">
        <Label htmlFor="login-email" className="text-xs font-semibold">Email address</Label>
        <Input
          id="login-email"
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

      <div className="space-y-1.5 text-start">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-xs font-semibold">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
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

      <Button
        type="submit"
        className="w-full h-10 text-sm font-medium"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      <div className="text-center text-xs text-muted-foreground pt-1">
        Don&apos;t have an account?{' '}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-primary font-semibold hover:underline ml-0.5"
          >
            Create one
          </button>
        ) : (
          <Link href="/register" className="text-primary font-semibold hover:underline ml-0.5">
            Create one
          </Link>
        )}
      </div>
    </form>
  );
}
