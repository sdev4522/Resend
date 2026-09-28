'use client';

import React from 'react';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserNav } from '@/components/shared/user-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebar } from './sidebar';

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-background/95 px-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden touch-manipulation" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <AdminSidebar isMobile />
          </SheetContent>
        </Sheet>

        <Badge variant="destructive" className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 shrink-0">
          <ShieldAlert className="h-3 w-3" />
          <span className="hidden sm:inline">ADMINISTRATION MODE</span>
          <span className="sm:hidden">ADMIN</span>
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
