'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, ExternalLink, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { InAppNotification } from '@/types/notifications';
import Link from 'next/link';

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getUserNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 45 seconds
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markRead(undefined, true);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleMarkOneRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-3.5 border-b bg-muted/20">
          <DropdownMenuGroup className="flex items-center gap-2">
            <DropdownMenuLabel className="p-0 font-semibold text-xs">
              Notifications
            </DropdownMenuLabel>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {unreadCount} unread
              </Badge>
            )}
          </DropdownMenuGroup>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <CheckCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-foreground">You are all caught up!</span>
              <p className="text-[11px] text-muted-foreground">
                No active notifications or alerts for your workspace.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.is_read && handleMarkOneRead(item.id)}
                className={`p-3.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                  !item.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.type === 'ALERT' || item.type === 'WARNING' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : item.type === 'SUCCESS' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Info className="h-4 w-4 text-blue-500" />
                  )}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {item.message}
                  </p>

                  {item.action_url && (
                    <Link
                      href={item.action_url}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-1"
                    >
                      <span>View details</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 text-center bg-muted/10">
          <Link
            href="/dashboard/settings"
            className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer block py-1"
          >
            Manage notification preferences
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
