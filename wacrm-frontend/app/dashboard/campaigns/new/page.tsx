'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api/campaigns';
import { contactsApi } from '@/lib/api/contacts';
import { templatesApi } from '@/lib/api/templates';
import { Phonebook } from '@/types/contact';
import { MetaTemplate } from '@/types/template';
import { CreateTemplateCampaignPayload } from '@/types/campaign';
import { TemplatePreview } from '@/components/templates/template-preview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Send,
  Users,
  Calendar,
  Eye,
  FileEdit,
} from 'lucide-react';
import Link from 'next/link';

export default function NewCampaignPage() {
  const router = useRouter();

  // Reference Data
  const [phonebooks, setPhonebooks] = useState<Phonebook[]>([]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [, setLoadingData] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [selectedPhonebookId, setSelectedPhonebookId] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [variableMappings, setVariableMappings] = useState<Record<string, { type: 'field' | 'custom'; value: string }>>({});

  // Scheduling State
  const [scheduleType, setScheduleType] = useState<'NOW' | 'LATER'>('NOW');
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'wizard' | 'preview'>('wizard');

  // Fetch phonebooks and approved templates
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [pbRes, tmplRes] = await Promise.all([
          contactsApi.getPhonebooks(),
          templatesApi.getMetaTemplates(),
        ]);

        if (pbRes && pbRes.success && Array.isArray(pbRes.data)) {
          setPhonebooks(pbRes.data);
          if (pbRes.data.length > 0) {
            setSelectedPhonebookId(String(pbRes.data[0].id));
          }
        }

        if (tmplRes && tmplRes.success && Array.isArray(tmplRes.data)) {
          // Only templates that are approved by Meta can be used in campaigns
          const approved = tmplRes.data.filter((t) => t.status === 'APPROVED');
          setTemplates(approved);
          if (approved.length > 0) {
            setSelectedTemplateName(approved[0].name);
          }
        }
      } catch (err: any) {
        console.error('Failed to load campaign pre-requisites:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.name === selectedTemplateName) || null;
  }, [templates, selectedTemplateName]);

  const selectedPhonebook = useMemo(() => {
    return phonebooks.find((p) => String(p.id) === selectedPhonebookId) || null;
  }, [phonebooks, selectedPhonebookId]);

  // Extract variables from body
  const detectedVarIndices = useMemo(() => {
    if (!selectedTemplate) return [];
    const bodyComp = selectedTemplate.components?.find((c: any) => c.type === 'BODY') as any;
    if (!bodyComp?.text) return [];
    const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
    const indices = Array.from(new Set(matches.map((m: string) => m.replace(/\{|\}/g, ''))));
    return (indices as string[]).sort((a: string, b: string) => Number(a) - Number(b));
  }, [selectedTemplate]);

  // Reset variable mappings when template changes
  useEffect(() => {
    if (detectedVarIndices.length > 0) {
      const initial: Record<string, { type: 'field' | 'custom'; value: string }> = {};
      detectedVarIndices.forEach((idx, i) => {
        // Default first variable to {{{name}}} if available
        if (i === 0) {
          initial[idx] = { type: 'field', value: '{{{name}}}' };
        } else {
          initial[idx] = { type: 'field', value: `{{{var${i}}}}` };
        }
      });
      setVariableMappings(initial);
    } else {
      setVariableMappings({});
    }
  }, [detectedVarIndices]);

  // Generate Sample Preview Variables
  const previewSampleVariables = useMemo(() => {
    const samples: Record<string, string> = {};
    detectedVarIndices.forEach((idx) => {
      const mapping = variableMappings[idx];
      if (!mapping) {
        samples[idx] = `{{${idx}}}`;
      } else if (mapping.type === 'field') {
        if (mapping.value === '{{{name}}}') samples[idx] = 'Rahul Sharma';
        else if (mapping.value === '{{{mobile}}}') samples[idx] = '+919876543210';
        else if (mapping.value === '{{{var1}}}') samples[idx] = 'ORD-10291';
        else if (mapping.value === '{{{var2}}}') samples[idx] = '25 September';
        else samples[idx] = mapping.value.replace(/[{}]/g, '');
      } else {
        samples[idx] = mapping.value || `{{${idx}}}`;
      }
    });
    return samples;
  }, [detectedVarIndices, variableMappings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Campaign title is required.');
      return;
    }

    if (!selectedPhonebookId) {
      setErrorMessage('Please select a target phonebook audience.');
      return;
    }

    if (!selectedTemplate) {
      setErrorMessage('Please select an approved WhatsApp message template.');
      return;
    }

    if (scheduleType === 'LATER' && !scheduleDateTime) {
      setErrorMessage('Please select a valid scheduled date and time.');
      return;
    }

    // Build backend body_variables array
    const bodyVars: string[] = detectedVarIndices.map((idx) => {
      const mapping = variableMappings[idx];
      return mapping?.value || '';
    });

    const payload: CreateTemplateCampaignPayload = {
      campaign_title: title.trim(),
      template_name: selectedTemplate.name,
      template_language: selectedTemplate.language,
      template_type: 'STANDARD',
      phonebook_id: Number(selectedPhonebookId),
      body_variables: bodyVars,
      schedule: scheduleType === 'LATER' ? new Date(scheduleDateTime).toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    };

    try {
      setSubmitting(true);
      const res = await campaignsApi.createTemplateCampaign(payload);

      if (res && res.success) {
        router.push('/dashboard/campaigns?created=true');
      } else {
        setErrorMessage(
          res?.msg ||
            res?.error ||
            'Failed to create broadcast campaign. Please check plan entitlements.'
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.msg ||
          err.message ||
          'Failed to schedule campaign on backend processor.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/campaigns" />}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Broadcast Campaign
          </h1>
          <p className="text-sm text-muted-foreground">
            Launch a targeted bulk WhatsApp broadcast to a segmented contact phonebook.
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Campaign Submission Notice</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Mobile Tab Switcher (Visible on < lg) */}
      <div className="lg:hidden flex items-center p-1 rounded-xl bg-muted/60 border">
        <button
          type="button"
          onClick={() => setMobileTab('wizard')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 touch-manipulation ${
            mobileTab === 'wizard'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileEdit className="h-3.5 w-3.5" />
          <span>Campaign Setup</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 touch-manipulation ${
            mobileTab === 'preview'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Message Preview</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Configuration */}
        <form onSubmit={handleSubmit} className={`lg:col-span-7 space-y-6 ${mobileTab !== 'wizard' ? 'hidden lg:block' : ''}`}>
          {/* Card 1: Campaign Details & Audience */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1. Campaign Title & Audience</CardTitle>
              <CardDescription className="text-xs">
                Name your campaign and choose which contact list will receive the broadcast.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-title" className="text-xs font-medium">
                  Campaign Title *
                </Label>
                <Input
                  id="campaign-title"
                  placeholder="e.g. Festive Offer Announcement Sept 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phonebook" className="text-xs font-medium">
                  Target Audience (Phonebook Group) *
                </Label>
                <Select
                  value={selectedPhonebookId}
                  onValueChange={(val) => setSelectedPhonebookId(val || '')}
                >
                  <SelectTrigger id="phonebook" className="h-9 text-sm">
                    <SelectValue placeholder="Select Phonebook" />
                  </SelectTrigger>
                  <SelectContent>
                    {phonebooks.map((pb) => (
                      <SelectItem key={pb.id} value={String(pb.id)}>
                        {pb.name} ({pb.contactCount || 0} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPhonebook && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                    <Users className="h-3 w-3" />
                    <span>
                      Selected audience contains{' '}
                      <strong className="text-foreground">{selectedPhonebook.contactCount || 0}</strong> contacts.
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Select WhatsApp Template */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2. Select Approved WhatsApp Template</CardTitle>
              <CardDescription className="text-xs">
                Meta requires all outbound marketing broadcasts to use approved templates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 ? (
                <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No Approved Meta Templates Available</span>
                  </div>
                  <p className="text-xs">
                    You do not have any approved WhatsApp templates in your Meta Business Account yet.
                    Please create and submit a template for review first.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link href="/dashboard/templates/new" />}
                    className="text-xs"
                  >
                    Create New Template
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="template" className="text-xs font-medium">
                    Template *
                  </Label>
                  <Select
                    value={selectedTemplateName}
                    onValueChange={(val) => setSelectedTemplateName(val || '')}
                  >
                    <SelectTrigger id="template" className="h-9 text-sm">
                      <SelectValue placeholder="Select Approved Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} ({t.language}) - {t.category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Variable Mapping */}
          {detectedVarIndices.length > 0 && (
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">3. Personalization & Variables</CardTitle>
                <CardDescription className="text-xs">
                  Map dynamic variables in your template to recipient contact fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {detectedVarIndices.map((idx) => {
                    const current = variableMappings[idx] || { type: 'field', value: '{{{name}}}' };
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono font-semibold text-foreground text-sm">
                            {`{{${idx}}}`}
                          </span>
                          <p className="text-[11px] text-muted-foreground">Positional placeholder</p>
                        </div>

                        <div className="flex flex-col sm:flex-row flex-1 sm:max-w-md items-stretch sm:items-center gap-2">
                          <Select
                            value={current.type}
                            onValueChange={(typeVal) =>
                              setVariableMappings((prev) => ({
                                ...prev,
                                [idx]: {
                                  type: (typeVal || 'field') as 'field' | 'custom',
                                  value: typeVal === 'field' ? '{{{name}}}' : '',
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-full sm:w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="field">Contact Field</SelectItem>
                              <SelectItem value="custom">Custom Text</SelectItem>
                            </SelectContent>
                          </Select>

                          {current.type === 'field' ? (
                            <Select
                              value={current.value}
                              onValueChange={(fieldVal) =>
                                setVariableMappings((prev) => ({
                                  ...prev,
                                  [idx]: { type: 'field', value: fieldVal || '{{{name}}}' },
                                }))
                              }
                            >
                              <SelectTrigger className="flex-1 h-8 text-xs font-mono">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="{{{name}}}">Contact Name</SelectItem>
                                <SelectItem value="{{{mobile}}}">Mobile Number</SelectItem>
                                <SelectItem value="{{{var1}}}">Custom var1</SelectItem>
                                <SelectItem value="{{{var2}}}">Custom var2</SelectItem>
                                <SelectItem value="{{{var3}}}">Custom var3</SelectItem>
                                <SelectItem value="{{{var4}}}">Custom var4</SelectItem>
                                <SelectItem value="{{{var5}}}">Custom var5</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder="Static string"
                              value={current.value}
                              onChange={(e) =>
                                setVariableMappings((prev) => ({
                                  ...prev,
                                  [idx]: { type: 'custom', value: e.target.value },
                                }))
                              }
                              className="flex-1 h-8 text-xs font-mono"
                              required
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card 4: Schedule */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">4. Schedule Dispatch</CardTitle>
              <CardDescription className="text-xs">
                Launch your broadcast immediately or schedule for a specific date and time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleType('NOW')}
                  className={`p-3 rounded-lg border text-left text-xs font-medium transition-colors flex items-center gap-2.5 ${
                    scheduleType === 'NOW'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  <div>
                    <div>Send Immediately</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      Queue broadcast right away
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType('LATER')}
                  className={`p-3 rounded-lg border text-left text-xs font-medium transition-colors flex items-center gap-2.5 ${
                    scheduleType === 'LATER'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <div>
                    <div>Schedule for Later</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      Specify dispatch date & time
                    </div>
                  </div>
                </button>
              </div>

              {scheduleType === 'LATER' && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="schedule-time" className="text-xs font-medium">
                    Dispatch Date & Time *
                  </Label>
                  <Input
                    id="schedule-time"
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              render={<Link href="/dashboard/campaigns" />}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || templates.length === 0}
              className="gap-2 w-full sm:w-auto"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{scheduleType === 'NOW' ? 'Launch Campaign' : 'Schedule Campaign'}</span>
            </Button>
          </div>
        </form>

        {/* Right Column: Live Sticky Message Preview */}
        <div className={`lg:col-span-5 lg:sticky lg:top-20 space-y-4 ${mobileTab !== 'preview' ? 'hidden lg:block' : ''}`}>
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recipient Preview</CardTitle>
                  <CardDescription className="text-xs">
                    Simulated message rendering with personalized contact values.
                  </CardDescription>
                </div>
                {/* Mobile Return to Wizard Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileTab('wizard')}
                  className="lg:hidden text-xs gap-1 h-7"
                >
                  <FileEdit className="h-3 w-3" />
                  <span>Setup</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <TemplatePreview
                  components={selectedTemplate.components || []}
                  sampleVariables={previewSampleVariables}
                />
              ) : (
                <div className="rounded-xl border bg-muted/30 p-8 text-center text-xs text-muted-foreground">
                  Select an approved template to preview message
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audience Summary Box */}
          {selectedPhonebook && (
            <Card className="shadow-xs">
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Audience Summary</span>
                  <span className="text-primary font-mono font-bold">
                    {selectedPhonebook.contactCount || 0} Contacts
                  </span>
                </div>
                <div className="text-muted-foreground text-[11px] space-y-1">
                  <div>List: {selectedPhonebook.name}</div>
                  <div>
                    Dispatch: {scheduleType === 'NOW' ? 'Immediate' : scheduleDateTime || 'Scheduled'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
