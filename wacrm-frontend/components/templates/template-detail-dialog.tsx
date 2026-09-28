'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { MetaTemplate } from '@/types/template';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TemplateStatusBadge } from './template-status-badge';
import { TemplatePreview } from './template-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Hash, Globe, Layers, AlertTriangle } from 'lucide-react';

interface TemplateDetailDialogProps {
  template: MetaTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDetailDialog({
  template,
  open,
  onOpenChange,
}: TemplateDetailDialogProps) {
  const [sampleVariables, setSampleVariables] = useState<Record<string, string>>({});

  if (!template) return null;

  // Extract variables from body
  const bodyComponent = template.components?.find((c) => c.type === 'BODY') as any;
  const matches = bodyComponent?.text ? bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [] : [];
  const variableIndices: string[] = Array.from(new Set(matches.map((m: string) => m.replace(/[{}]/g, ''))));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <DialogTitle className="text-lg font-bold tracking-tight">
              {template.name}
            </DialogTitle>
            <TemplateStatusBadge status={template.status} />
          </div>
          <DialogDescription className="text-xs">
            Meta Cloud API registered message template details and interactive simulation.
          </DialogDescription>
        </DialogHeader>

        {template.status === 'REJECTED' && template.rejected_reason && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Meta Rejection Reason</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {template.rejected_reason}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Left Column: Metadata & Variables */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
              <div>
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Layers className="h-3.5 w-3.5" /> Category
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {template.category}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Globe className="h-3.5 w-3.5" /> Language
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {template.language}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Hash className="h-3.5 w-3.5" /> Meta ID
                </span>
                <span className="font-mono text-foreground mt-0.5 block text-[11px] truncate">
                  {template.id || 'Pending Meta assignment'}
                </span>
              </div>
            </div>

            {/* Variable Inputs for live preview */}
            {variableIndices.length > 0 && (
              <div className="space-y-3 p-3.5 rounded-lg border">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Test Variables ({variableIndices.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Fill in sample values below to preview real message rendering.
                </p>
                <div className="space-y-2.5">
                  {variableIndices.map((v: string) => (
                    <div key={v} className="space-y-1">
                      <Label htmlFor={`var-${v}`} className="text-xs font-mono">
                        {`{{${v}}}`}
                      </Label>
                      <Input
                        id={`var-${v}`}
                        placeholder={`Sample value for {{${v}}}`}
                        className="h-8 text-xs"
                        value={sampleVariables[v] || ''}
                        onChange={(e) =>
                          setSampleVariables((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                render={<Link href={`/dashboard/templates/${encodeURIComponent(template.name)}`} />}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Full Template Page</span>
              </Button>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Preview */}
          <div className="flex flex-col items-center justify-center">
            <TemplatePreview
              components={template.components || []}
              sampleVariables={sampleVariables}
              className="w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
