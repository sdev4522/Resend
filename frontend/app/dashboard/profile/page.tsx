'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { profileApi, UserProfileData, UpdateUserProfilePayload } from '@/lib/api/profile';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { ProfileDetails, ProfileDetailField } from '@/components/profile/profile-details';
import { ProfileForm, ProfileFormValues } from '@/components/profile/profile-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Hash, Shield, Clock, Globe, CreditCard, RefreshCw, AlertTriangle } from 'lucide-react';

export default function UserProfilePage() {
  const { refreshUser } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profileApi.getUserProfile();
      if (res && res.success && res.data) {
        setProfileData(res.data);
      } else {
        setError('Failed to load profile data from the server.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (values: ProfileFormValues) => {
    const payload: UpdateUserProfilePayload = {
      name: values.name || '',
      email: values.email,
      mobile_with_country_code: values.mobile_with_country_code || '',
      timezone: values.timezone || 'Asia/Kolkata',
      newPassword: values.newPassword || undefined,
    };

    const res = await profileApi.updateUserProfile(payload);
    if (res.success) {
      await fetchProfile();
      if (refreshUser) {
        await refreshUser();
      }
    }
    return res;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-4 py-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile Unavailable</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <span>{error || 'Unable to retrieve user information from the backend.'}</span>
            <Button variant="outline" size="sm" onClick={fetchProfile} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Parse plan if JSON string or object
  let planName = 'Free / No Plan';
  if (profileData.plan) {
    try {
      const parsed = typeof profileData.plan === 'string' ? JSON.parse(profileData.plan) : profileData.plan;
      planName = parsed.title || 'Subscribed Plan';
    } catch {
      planName = 'Active Plan';
    }
  }

  const detailFields: ProfileDetailField[] = [
    {
      label: 'Tenant UID',
      value: profileData.uid,
      icon: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Account Role',
      value: (profileData.role || 'user').toUpperCase(),
      icon: <Shield className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Timezone',
      value: profileData.timezone || 'UTC',
      icon: <Globe className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Subscription Tier',
      value: planName,
      icon: <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Account Created',
      value: profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : '—',
      icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <ProfileHeader
        title="User Profile"
        description="View your authenticated tenant profile and manage personal credentials."
      />

      <ProfileAvatar
        name={profileData.name}
        email={profileData.email}
        role={profileData.role || 'user'}
      />

      <div className="grid grid-cols-1 gap-6">
        <ProfileDetails
          title="Account Metadata"
          description="Verified tenant identifiers and system configuration."
          details={detailFields}
        />

        <ProfileForm
          mode="user"
          initialValues={{
            name: profileData.name,
            email: profileData.email,
            mobile_with_country_code: profileData.mobile_with_country_code,
            timezone: profileData.timezone,
          }}
          onSubmit={handleUpdate}
        />
      </div>
    </div>
  );
}
