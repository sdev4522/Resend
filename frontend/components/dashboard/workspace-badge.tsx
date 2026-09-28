'use client';

import React from 'react';
import { useAuth, useWorkspace } from '@/lib/auth/auth-context';
import { Building2, ShieldCheck, UserCheck } from 'lucide-react';

export function WorkspaceBadge() {
  const { role } = useAuth();
  const workspace = useWorkspace();

  if (!workspace) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-sidebar-accent/30 text-sidebar-foreground text-xs">
      <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      <div className="flex flex-col truncate">
        <span className="font-semibold truncate text-[11px] leading-none">
          {workspace.name}
        </span>
        <span className="text-[9px] text-muted-foreground capitalize mt-0.5 flex items-center gap-1">
          {role === 'admin' ? (
            <>
              <ShieldCheck className="h-2.5 w-2.5 text-red-500" />
              Super Admin
            </>
          ) : role === 'agent' ? (
            <>
              <UserCheck className="h-2.5 w-2.5 text-blue-500" />
              Support Agent
            </>
          ) : (
            'Workspace Owner'
          )}
        </span>
      </div>
    </div>
  );
}
