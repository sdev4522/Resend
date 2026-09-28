'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, User as UserIcon } from 'lucide-react';

interface ProfileAvatarProps {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'agent';
  avatarUrl?: string;
  className?: string;
}

export function ProfileAvatar({
  name,
  email,
  role,
  avatarUrl,
  className = '',
}: ProfileAvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : role === 'admin'
    ? 'AD'
    : 'WA';

  return (
    <div className={`flex flex-col sm:flex-row items-center sm:items-start gap-4 ${className}`}>
      <Avatar className="h-20 w-20 border-2 border-border shadow-xs">
        <AvatarImage src={avatarUrl || ''} alt={name || email} />
        <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {name || (role === 'admin' ? 'Administrator' : 'User')}
          </h2>
          {role === 'admin' ? (
            <Badge variant="destructive" className="flex items-center gap-1 font-mono text-xs">
              <ShieldAlert className="h-3 w-3" />
              SUPER ADMIN
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1 font-mono text-xs">
              <UserIcon className="h-3 w-3" />
              {role.toUpperCase()}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}
