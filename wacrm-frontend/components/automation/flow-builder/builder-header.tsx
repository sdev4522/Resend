'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Copy,
  Trash2,
  Activity,
  MoreVertical,
  QrCode,
  Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AutomationStatus, OriginObject } from '@/types/automation';

interface BuilderHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  status: AutomationStatus;
  origin?: OriginObject | null;
  onSaveDraft: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onViewRuns: () => void;
  isSaving: boolean;
  isActivating: boolean;
  hasUnsavedChanges: boolean;
}

export function BuilderHeader({
  name,
  onNameChange,
  status,
  origin,
  onSaveDraft,
  onActivate,
  onDeactivate,
  onDuplicate,
  onDelete,
  onViewRuns,
  isSaving,
  isActivating,
  hasUnsavedChanges,
}: BuilderHeaderProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs px-2 py-0.5 gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs px-2 py-0.5 font-medium">
            Paused
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
            Draft
          </Badge>
        );
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card px-2.5 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 shrink-0 select-none">
      {/* Left: Back & Flow Name */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <Link href="/dashboard/automation">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground touch-manipulation"
            aria-label="Back to Automations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-8 text-xs sm:text-sm font-bold bg-transparent border-transparent hover:border-border/80 focus:border-primary focus:bg-background px-1.5 w-[110px] xs:w-[160px] sm:w-[240px] truncate transition-colors"
            placeholder="Automation Name"
            aria-label="Automation Name"
          />

          <div className="shrink-0">{getStatusBadge()}</div>

          {hasUnsavedChanges && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 hidden lg:inline font-medium">
              (Unsaved changes)
            </span>
          )}
        </div>
      </div>

      {/* Center/Right: Origin & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {origin && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            {origin.code === 'QR' ? (
              <QrCode className="h-3.5 w-3.5 text-emerald-600" />
            ) : origin.code === 'META' ? (
              <Cloud className="h-3.5 w-3.5 text-blue-600" />
            ) : null}
            <span className="font-medium text-foreground">{origin.title}</span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 hidden sm:inline-flex touch-manipulation"
          onClick={onViewRuns}
        >
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Sessions</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs gap-1.5 touch-manipulation px-2 sm:px-3"
          onClick={onSaveDraft}
          disabled={isSaving}
          aria-label="Save Draft"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">{isSaving ? 'Saving...' : 'Save Draft'}</span>
        </Button>

        {status === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10 touch-manipulation px-2 sm:px-3"
            onClick={onDeactivate}
            disabled={isActivating}
            aria-label="Pause Bot"
          >
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Pause Bot</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation px-2 sm:px-3 font-semibold"
            onClick={onActivate}
            disabled={isActivating}
            aria-label="Activate Bot"
          >
            <Play className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">{isActivating ? 'Activating...' : 'Activate Bot'}</span>
            <span className="xs:hidden">Activate</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground touch-manipulation"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onViewRuns} className="text-xs gap-2 sm:hidden cursor-pointer">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              View Execution Sessions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} className="text-xs gap-2 cursor-pointer">
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Duplicate Flow
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" />
              Delete Flow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
