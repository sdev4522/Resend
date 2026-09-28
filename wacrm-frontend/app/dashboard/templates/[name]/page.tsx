'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { templatesApi } from '@/lib/api/templates';
import { MetaTemplate } from '@/types/template';
import { TemplatePreview } from '@/components/templates/template-preview';
import { TemplateStatusBadge } from '@/components/templates/template-status-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Trash2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function TemplateDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const templateName = decodeURIComponent(resolvedParams.name);
  const router = useRouter();

  const [template, setTemplate] = useState<MetaTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        setError(null);
        const res = await templatesApi.getMetaTemplates();

        if (res && res.success && Array.isArray(res.data)) {
          const match = res.data.find((t) => t.name === templateName);
          if (match) {
            setTemplate(match);

            // Pre-populate sample test variables if template contains {{1}}, {{2}}
            const bodyComp = match.components?.find((c: any) => c.type === 'BODY') as any;
            if (bodyComp?.text) {
              const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
              const indices: string[] = Array.from(new Set(matches.map((m: any) => m.replace(/\{|\}/g, ''))));
              const initialVars: Record<string, string> = {};
              indices.forEach((idx: string, i: number) => {
                const sampleVal = bodyComp.example?.body_text?.[0]?.[i];
                initialVars[idx] = sampleVal || `Sample ${idx}`;
              });
              setTestVariables(initialVars);
            }
          } else {
            setError(`Template "${templateName}" could not be found in your Meta Business Account.`);
          }
        } else {
          setError(res?.msg || 'Failed to load templates from Meta Cloud API.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading template details.');
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [templateName]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await templatesApi.deleteMetaTemplate(templateName);
      if (res && res.success) {
        router.push('/dashboard/templates?deleted=true');
      } else {
        setError(res?.msg || 'Failed to delete template from Meta.');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting template.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading template details from Meta Cloud API...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/templates" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Template Not Found</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Template Error</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {error || 'Unable to retrieve template information.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" render={<Link href="/dashboard/templates" />}>
          Back to Templates
        </Button>
      </div>
    );
  }

  const headerComp = template.components?.find((c) => c.type === 'HEADER') as any;
  const bodyComp = template.components?.find((c) => c.type === 'BODY') as any;
  const footerComp = template.components?.find((c) => c.type === 'FOOTER') as any;
  const buttonsComp = template.components?.find((c) => c.type === 'BUTTONS') as any;

  const detectedVarIndices = Object.keys(testVariables).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/templates" />}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {template.name}
              </h1>
              <TemplateStatusBadge status={template.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Category: <span className="font-semibold text-foreground">{template.category}</span> | Language:{' '}
              <span className="font-mono text-foreground">{template.language}</span>
              {template.id && (
                <>
                  {' '}
                  | Meta ID: <span className="font-mono text-[11px]">{template.id}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Template</span>
          </Button>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete WhatsApp Template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete template <strong className="font-mono">{template.name}</strong> from Meta Cloud API. Active campaigns utilizing this template will stop sending.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? 'Deleting...' : 'Delete from Meta'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {template.status === 'REJECTED' && template.rejected_reason && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Rejected by Meta Policy</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {template.rejected_reason}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Template Structure & Components */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Component Card */}
          {headerComp && (
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Header Component</CardTitle>
                <CardDescription className="text-xs">
                  Format: <span className="font-medium text-foreground">{headerComp.format}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {headerComp.format === 'TEXT' && (
                  <p className="text-sm font-medium">{headerComp.text}</p>
                )}
                {headerComp.format !== 'TEXT' && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Media header ({headerComp.format.toLowerCase()})</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Body Component Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Body Content</CardTitle>
              <CardDescription className="text-xs">
                Raw template string stored in Meta Graph API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded-lg bg-muted/40 border font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground">
                {bodyComp?.text || 'No body content'}
              </div>

              {/* Dynamic Variable Testing */}
              {detectedVarIndices.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Test Variable Simulation</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedVarIndices.map((idx) => (
                      <div key={idx} className="space-y-1">
                        <Label className="text-xs font-mono">{`Variable {{${idx}}}`}</Label>
                        <Input
                          value={testVariables[idx] || ''}
                          onChange={(e) =>
                            setTestVariables((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          className="h-8 text-xs font-sans"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer Component Card */}
          {footerComp?.text && (
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Footer Component</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{footerComp.text}</p>
              </CardContent>
            </Card>
          )}

          {/* Buttons Component Card */}
          {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Interactive Buttons</CardTitle>
                <CardDescription className="text-xs">
                  {buttonsComp.buttons.length} button(s) configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {buttonsComp.buttons.map((btn: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {btn.type === 'QUICK_REPLY' && <MessageSquare className="h-4 w-4 text-primary" />}
                        {btn.type === 'URL' && <ExternalLink className="h-4 w-4 text-primary" />}
                        {btn.type === 'PHONE_NUMBER' && <Phone className="h-4 w-4 text-primary" />}
                        <div>
                          <span className="font-semibold text-foreground">{btn.text}</span>
                          {btn.url && (
                            <p className="text-[11px] text-muted-foreground font-mono">{btn.url}</p>
                          )}
                          {btn.phone_number && (
                            <p className="text-[11px] text-muted-foreground font-mono">{btn.phone_number}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {btn.type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Live Sticky Simulation */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Live Simulation</CardTitle>
              <CardDescription className="text-xs">
                Real-time WhatsApp rendering with your test variables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePreview
                components={template.components || []}
                sampleVariables={testVariables}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
