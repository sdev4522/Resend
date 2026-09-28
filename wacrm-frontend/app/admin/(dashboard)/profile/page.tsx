'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { profileApi, UpdateAdminProfilePayload } from '@/lib/api/profile';
import { AdminProfileData } from '@/types/admin';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { ProfileDetails, ProfileDetailField } from '@/components/profile/profile-details';
import { ProfileForm, ProfileFormValues } from '@/components/profile/profile-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hash, Shield, Clock, ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminProfilePage() {
  const { refreshUser } = useAuth();
  const [adminData, setAdminData] = useState<AdminProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profileApi.getAdminProfile();
      if (res && res.success && res.data) {
        setAdminData(res.data);
      } else {
        setError('Failed to retrieve admin account information.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with the administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  const handleUpdate = async (values: ProfileFormValues) => {
    const payload: UpdateAdminProfilePayload = {
      email: values.email,
      newpass: values.newPassword || undefined,
    };

    const res = await profileApi.updateAdminProfile(payload);
    if (res.success) {
      await fetchAdminProfile();
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
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !adminData) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Admin Profile Unavailable</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <span>{error || 'Unable to retrieve administrative account data.'}</span>
            <Button variant="outline" size="sm" onClick={fetchAdminProfile} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const detailFields: ProfileDetailField[] = [
    {
      label: 'Admin UID',
      value: adminData.uid,
      icon: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Authorization Role',
      value: (
        <Badge variant="destructive" className="font-mono text-xs">
          SUPER ADMIN
        </Badge>
      ),
      icon: <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Registered Email',
      value: adminData.email,
      icon: <Shield className="h-3.5 w-3.5 text-muted-foreground" />,
    },
    {
      label: 'Account Created',
      value: adminData.createdAt ? new Date(adminData.createdAt).toLocaleDateString() : '—',
      icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <ProfileHeader
        title="Admin Profile"
        description="Root system administrator identity and security management."
        badge={
          <Badge variant="destructive" className="flex items-center gap-1 font-mono text-xs">
            <ShieldAlert className="h-3 w-3" />
            ROOT SECURITY
          </Badge>
        }
      />

      <ProfileAvatar
        name="System Administrator"
        email={adminData.email}
        role="admin"
      />

      <div className="grid grid-cols-1 gap-6">
        <ProfileDetails
          title="Administrative Metadata"
          description="High-privilege system identifiers registered in the database."
          details={detailFields}
        />

        <ProfileForm
          mode="admin"
          initialValues={{
            email: adminData.email,
          }}
          onSubmit={handleUpdate}
        />
      </div>
    </div>
  );
}
