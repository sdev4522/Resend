'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, Key, Mail, User, Phone, Globe } from 'lucide-react';

export interface ProfileFormValues {
  name?: string;
  email: string;
  mobile_with_country_code?: string;
  timezone?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface ProfileFormProps {
  mode: 'user' | 'admin';
  initialValues: {
    name?: string;
    email: string;
    mobile_with_country_code?: string;
    timezone?: string;
  };
  onSubmit: (values: ProfileFormValues) => Promise<{ success: boolean; msg?: string }>;
}

export function ProfileForm({ mode, initialValues, onSubmit }: ProfileFormProps) {
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    name: initialValues.name || '',
    email: initialValues.email || '',
    mobile_with_country_code: initialValues.mobile_with_country_code || '',
    timezone: initialValues.timezone || 'Asia/Kolkata',
    newPassword: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (statusMessage) setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formValues.newPassword && formValues.newPassword !== formValues.confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (formValues.newPassword && formValues.newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (mode === 'user') {
      if (!formValues.name || !formValues.email || !formValues.mobile_with_country_code) {
        setStatusMessage({ type: 'error', text: 'Please fill all required profile fields.' });
        return;
      }
    } else {
      if (!formValues.email) {
        setStatusMessage({ type: 'error', text: 'Email is required.' });
        return;
      }
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await onSubmit(formValues);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.msg || (mode === 'admin' ? 'Admin credentials updated successfully.' : 'Profile updated successfully.'),
        });
        setFormValues((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }));
      } else {
        setStatusMessage({
          type: 'error',
          text: res.msg || 'Failed to update profile.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'An error occurred while saving profile.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-xs">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            {mode === 'admin' ? 'Security & Credentials' : 'Personal & Contact Details'}
          </CardTitle>
          <CardDescription className="text-xs">
            {mode === 'admin'
              ? 'Update the administrative root email and system access password.'
              : 'Keep your contact information up to date for workspace notifications and reports.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {statusMessage && (
            <Alert variant={statusMessage.type === 'error' ? 'destructive' : 'default'} className="py-2.5">
              {statusMessage.type === 'error' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <AlertDescription className="text-xs font-medium">
                {statusMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {mode === 'user' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-medium">
                Full Name *
              </Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formValues.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="pl-9 h-9 text-sm"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium">
              Email Address *
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formValues.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className="pl-9 h-9 text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {mode === 'user' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mobile_with_country_code" className="text-xs font-medium">
                  Mobile (with Country Code) *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="mobile_with_country_code"
                    name="mobile_with_country_code"
                    type="tel"
                    required
                    value={formValues.mobile_with_country_code}
                    onChange={handleChange}
                    placeholder="+1234567890"
                    className="pl-9 h-9 text-sm font-mono"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-xs font-medium">
                  Timezone *
                </Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="timezone"
                    name="timezone"
                    type="text"
                    required
                    value={formValues.timezone}
                    onChange={handleChange}
                    placeholder="e.g. Asia/Kolkata, America/New_York"
                    className="pl-9 h-9 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2 border-t space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Change Password (Optional)
              </h3>
              <p className="text-xs text-muted-foreground">
                Leave blank if you do not want to change your current password.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" text-xs="true" className="text-xs font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={formValues.newPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="pl-9 h-9 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" text-xs="true" className="text-xs font-medium">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={formValues.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="pl-9 h-9 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="submit"
            disabled={loading}
            className={mode === 'admin' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
