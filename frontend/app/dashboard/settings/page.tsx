'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useWorkspace } from '@/lib/auth/auth-context';
import { userApi } from '@/lib/api/dashboard';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { getPlanTitle } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Building2,
  Shield,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, role, refreshUser } = useAuth();
  const workspace = useWorkspace();

  // Profile Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [timezone, setTimezone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Populate from real authenticated user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMobile(user.mobile_with_country_code || user.mobile || '');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);

    try {
      const res = await userApi.updateProfile({
        name,
        email,
        mobile_with_country_code: mobile,
        timezone,
      });

      if (res.success) {
        toast.success('Profile updated successfully');
        await refreshUser();
      } else {
        throw new Error(res.msg || 'Failed to update profile');
      }
    } catch (err: any) {
      setProfileError(err.message || 'Error updating profile');
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await userApi.updateProfile({
        name,
        email,
        mobile_with_country_code: mobile,
        timezone,
        newPassword,
      });

      if (res.success) {
        toast.success('Password changed successfully');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(res.msg || 'Failed to change password');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating password');
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Settings"
        description="Manage your user profile, workspace preferences, and security settings."
        breadcrumbs={[{ title: 'Settings' }]}
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-full h-11">
          <TabsTrigger value="profile" className="rounded-full text-xs sm:text-sm px-4">
            <User className="h-4 w-4 mr-1.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="workspace" className="rounded-full text-xs sm:text-sm px-4">
            <Building2 className="h-4 w-4 mr-1.5" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-full text-xs sm:text-sm px-4">
            <Shield className="h-4 w-4 mr-1.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-full text-xs sm:text-sm px-4">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Settings */}
        <TabsContent value="profile">
          <Card className="shadow-xs border">
            <CardHeader>
              <CardTitle className="text-lg">Profile Details</CardTitle>
              <CardDescription className="text-xs">
                Update your personal contact details and regional timezone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
                {profileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{profileError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="prof-name" className="text-xs font-semibold">
                    Full Name
                  </Label>
                  <Input
                    id="prof-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-email" className="text-xs font-semibold">
                    Email Address
                  </Label>
                  <Input
                    id="prof-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-phone" className="text-xs font-semibold">
                    Mobile with Country Code (WhatsApp)
                  </Label>
                  <Input
                    id="prof-phone"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    placeholder="+1234567890"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-tz" className="text-xs font-semibold">
                    Timezone
                  </Label>
                  <Input
                    id="prof-tz"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                    placeholder="UTC, America/New_York, Asia/Kolkata"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={savingProfile} className="rounded-full text-xs h-9 px-5">
                    {savingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Workspace Settings */}
        <TabsContent value="workspace">
          <Card className="shadow-xs border">
            <CardHeader>
              <CardTitle className="text-lg">Workspace Overview</CardTitle>
              <CardDescription className="text-xs">
                Metadata and subscription context for your current WhatsApp tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-xl border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Workspace Name
                  </span>
                  <p className="text-sm font-semibold mt-1">
                    {workspace?.name || `${user?.name || 'My'}'s Workspace`}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Your Role
                  </span>
                  <p className="text-sm font-semibold mt-1 capitalize">
                    {role || 'User'}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Current Plan
                  </span>
                  <div className="mt-1">
                    <Badge variant="secondary">
                      {getPlanTitle(user?.plan)}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Plan Expiry
                  </span>
                  <p className="text-sm font-semibold mt-1">
                    {user?.plan_expire
                      ? new Date(user.plan_expire).toLocaleDateString()
                      : 'Never / Active'}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3.5 rounded-xl border bg-muted/10 text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Tenant UID: <code className="font-mono text-foreground font-semibold">{user?.uid}</code>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Security Settings */}
        <TabsContent value="security">
          <Card className="shadow-xs border">
            <CardHeader>
              <CardTitle className="text-lg">Security & Password</CardTitle>
              <CardDescription className="text-xs">
                Update your account password to secure your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-xl">
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="sec-new-pass" className="text-xs font-semibold">
                    New Password
                  </Label>
                  <Input
                    id="sec-new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sec-confirm-pass" className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <Input
                    id="sec-confirm-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repeat new password"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={savingPassword} className="rounded-full text-xs h-9 px-5">
                    {savingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Notifications Settings */}
        <TabsContent value="notifications">
          <Card className="shadow-xs border">
            <CardHeader>
              <CardTitle className="text-lg">Notification Preferences</CardTitle>
              <CardDescription className="text-xs">
                Configure your incoming message and broadcast alert preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border">
                  <div>
                    <p className="text-sm font-medium">Email Broadcast Reports</p>
                    <p className="text-xs text-muted-foreground">Receive deliverability summaries after campaigns.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border">
                  <div>
                    <p className="text-sm font-medium">WhatsApp Disconnect Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified immediately if a phone session disconnects.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                Webhook alert configurations will be available in the Developer Integrations phase.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
