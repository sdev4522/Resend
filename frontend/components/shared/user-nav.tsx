'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Settings, CreditCard, LogOut, Shield, LayoutDashboard } from 'lucide-react';

interface UserNavProps {
  forceMode?: 'admin' | 'user';
}

export function UserNav({ forceMode }: UserNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdminView = forceMode === 'admin' || (user?.role === 'admin' && pathname.startsWith('/admin'));

  const initials = user?.name
    ? user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : user?.role === 'admin'
      ? 'AD'
      : 'WA';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}
      >
        <Avatar className="h-9 w-9 border">
          <AvatarImage src={user?.avatar || ''} alt={user?.name || (isAdminView ? 'Admin' : 'User')} />
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {isAdminView ? 'System Administrator' : (user?.name || 'User Account')}
              </p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email || 'admin@admin.com'}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {isAdminView ? (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Admin Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>System Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Admin Console</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/billing')}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing & Plan</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            {user?.role === 'admin' && (
              <DropdownMenuItem
                onClick={() => router.push('/admin')}
                className="text-primary font-medium"
              >
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Console</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}