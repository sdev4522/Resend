'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth, useWorkspace } from '@/lib/auth/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, Check, Building2, Settings } from 'lucide-react';
import { getPlanTitle } from '@/lib/utils';

export function WorkspaceSwitcher() {
  const { user, role } = useAuth();
  const workspace = useWorkspace();

  const workspaceName = workspace?.name || `${user?.name || 'My'}'s Workspace`;
  const isOwner = role === 'user';
  const roleLabel = isOwner ? 'Owner' : role === 'admin' ? 'Super Admin' : 'Agent';
  const planName = getPlanTitle(user?.plan);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-2.5 text-left text-sm transition-all hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-xs">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-semibold text-foreground text-xs leading-tight">
              {workspaceName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted-foreground capitalize">
                {roleLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">•</span>
              <Badge variant="secondary" className="px-1 py-0 text-[9px] font-medium h-3.5">
                {planName}
              </Badge>
            </div>
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="start" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Active Workspace
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem className="flex items-center justify-between py-2 cursor-pointer font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate text-xs">{workspaceName}</span>
          </div>
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer text-xs" />}
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Workspace Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
