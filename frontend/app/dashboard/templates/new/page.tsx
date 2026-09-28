'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { templatesApi } from '@/lib/api/templates';
import {
  MetaTemplateCategory,
  MetaHeaderFormat,
  MetaTemplateComponent,
  CreateMetaTemplatePayload,
  MetaTemplateButton,
} from '@/types/template';
import { TemplatePreview } from '@/components/templates/template-preview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  HelpCircle,
  Upload,
  Bold,
  Italic,
  Strikethrough,
  Code,
  ArrowUp,
  ArrowDown,
  Phone,
  ExternalLink,
  MessageSquare,
  Eye,
  FileEdit,
} from 'lucide-react';
import Link from 'next/link';

const SUPPORTED_LANGUAGES = [
  { code: 'en_US', name: 'English (US)' },
  { code: 'en_GB', name: 'English (UK)' },
  { code: 'es_ES', name: 'Spanish (Spain)' },
  { code: 'es_LA', name: 'Spanish (Latin America)' },
  { code: 'pt_BR', name: 'Portuguese (Brazil)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'fr_FR', name: 'French' },
  { code: 'de_DE', name: 'German' },
  { code: 'id', name: 'Indonesian' },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Basic Details
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MetaTemplateCategory>('MARKETING');
  const [language, setLanguage] = useState('en_US');

  // Header State
  const [headerType, setHeaderType] = useState<MetaHeaderFormat | 'NONE'>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerMediaHandle, setHeaderMediaHandle] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Body State
  const [bodyText, setBodyText] = useState('');
  const [sampleVariables, setSampleVariables] = useState<Record<string, string>>({});

  // Footer State
  const [footerText, setFooterText] = useState('');

  // Button Builder State
  const [buttonType, setButtonType] = useState<'NONE' | 'QUICK_REPLY' | 'CALL_TO_ACTION'>('NONE');
  const [buttons, setButtons] = useState<MetaTemplateButton[]>([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Auto-detect {{1}}, {{2}} variables in body text
  const detectedVarIndices = React.useMemo(() => {
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/\{|\}/g, ''))));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [bodyText]);

  // Name sanitize: lowercase alphanumeric + underscore only
  const handleNameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setName(sanitized);
  };

  // Media Upload handler
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!name.trim()) {
      setErrorMessage('Please enter a template name before uploading media assets.');
      return;
    }

    try {
      setUploadingMedia(true);
      setErrorMessage(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('templet_name', name);

      const res = await templatesApi.uploadMediaAsset(formData);
      if (res && res.success) {
        setHeaderMediaUrl(res.url);
        setHeaderMediaHandle(res.hash);
      } else {
        setErrorMessage(res?.msg || 'Failed to upload header media to Meta.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading file.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Body formatting helpers
  const handleInsertFormatting = (prefix: string, suffix: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = bodyText.substring(start, end);
    const replacement = `${prefix}${selectedText || 'text'}${suffix}`;

    const newText = bodyText.substring(0, start) + replacement + bodyText.substring(end);
    setBodyText(newText);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4));
    }, 50);
  };

  const handleInsertVariable = () => {
    const textarea = bodyTextareaRef.current;
    const nextIndex = detectedVarIndices.length + 1;
    const variableTag = `{{${nextIndex}}}`;

    if (!textarea) {
      setBodyText((prev) => `${prev} ${variableTag}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = bodyText.substring(0, start) + variableTag + bodyText.substring(end);
    setBodyText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
    }, 50);
  };

  // Button Builder Handlers
  const handleAddQuickReply = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
  };

  const handleAddUrlButton = () => {
    if (buttons.length >= 2) return;
    setButtons([...buttons, { type: 'URL', text: '', url: '' }]);
  };

  const handleAddPhoneButton = () => {
    if (buttons.length >= 2) return;
    const hasPhone = buttons.some((b) => b.type === 'PHONE_NUMBER');
    if (hasPhone) return;
    setButtons([...buttons, { type: 'PHONE_NUMBER', text: '', phone_number: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleMoveButton = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= buttons.length) return;

    const updated = [...buttons];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setButtons(updated);
  };

  const handleButtonChange = (index: number, field: string, value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    setButtons(updated);
  };

  // Form Validation conforming to Meta Graph API rules
  const validateForm = (): boolean => {
    if (!name.trim()) {
      setErrorMessage('Template name is required.');
      return false;
    }

    if (!/^[a-z0-9_]+$/.test(name)) {
      setErrorMessage('Template name can only contain lowercase letters, numbers, and underscores.');
      return false;
    }

    if (!bodyText.trim()) {
      setErrorMessage('Template body text is required.');
      return false;
    }

    // Validate variable sequence (must be 1, 2, 3...)
    for (let i = 0; i < detectedVarIndices.length; i++) {
      if (Number(detectedVarIndices[i]) !== i + 1) {
        setErrorMessage(
          `Variables must be sequentially numbered starting from {{1}}. Found {{${detectedVarIndices[i]}}} without prior index.`
        );
        return false;
      }
    }

    // Validate that sample variables are provided for all detected variables
    for (const v of detectedVarIndices) {
      if (!sampleVariables[v] || !sampleVariables[v].trim()) {
        setErrorMessage(`Please provide a sample value for variable {{${v}}}. Meta requires sample values for review.`);
        return false;
      }
    }

    // Header validation
    if (headerType === 'TEXT' && !headerText.trim()) {
      setErrorMessage('Header text is required when text header format is selected.');
      return false;
    }

    // Buttons validation
    if (buttonType !== 'NONE') {
      if (buttons.length === 0) {
        setErrorMessage('Please add at least one button or set Button Category to None.');
        return false;
      }

      // Check duplicate button labels
      const buttonLabels = buttons.map((b) => b.text.trim().toLowerCase());
      const uniqueLabels = new Set(buttonLabels);
      if (uniqueLabels.size !== buttonLabels.length) {
        setErrorMessage('Meta requires all button labels within a template to be unique.');
        return false;
      }

      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        if (!btn.text.trim()) {
          setErrorMessage(`Button ${i + 1} must have a label.`);
          return false;
        }
        if (btn.text.trim().length > 25) {
          setErrorMessage(`Button ${i + 1} label "${btn.text}" exceeds the 25 character Meta limit.`);
          return false;
        }

        if (btn.type === 'URL') {
          if (!btn.url?.trim()) {
            setErrorMessage(`Button ${i + 1} (${btn.text}) requires a valid website URL.`);
            return false;
          }
          if (!btn.url.startsWith('http://') && !btn.url.startsWith('https://')) {
            setErrorMessage(`Button ${i + 1} URL must start with http:// or https://.`);
            return false;
          }
        }

        if (btn.type === 'PHONE_NUMBER') {
          if (!btn.phone_number?.trim()) {
            setErrorMessage(`Button ${i + 1} (${btn.text}) requires a valid phone number.`);
            return false;
          }
          if (!/^\+?[1-9]\d{6,14}$/.test(btn.phone_number.trim().replace(/\s+/g, ''))) {
            setErrorMessage(
              `Button ${i + 1} phone number must be in international format (e.g. +16505551234).`
            );
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setSubmitting(true);

    // Build components array conforming strictly to Meta Graph API format
    const components: MetaTemplateComponent[] = [];

    // Header component
    if (headerType !== 'NONE') {
      if (headerType === 'TEXT') {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText.trim(),
        });
      } else {
        components.push({
          type: 'HEADER',
          format: headerType,
          example: headerMediaHandle ? { header_handle: [headerMediaHandle] } : undefined,
        });
      }
    }

    // Body component with example sample values
    const bodyExampleValues = detectedVarIndices.map((idx) => sampleVariables[idx] || 'Example');
    components.push({
      type: 'BODY',
      text: bodyText.trim(),
      example:
        bodyExampleValues.length > 0
          ? {
              body_text: [bodyExampleValues],
            }
          : undefined,
    });

    // Footer component
    if (footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim(),
      });
    }

    // Buttons component
    if (buttonType !== 'NONE' && buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((btn) => ({
          type: btn.type,
          text: btn.text.trim(),
          url: btn.type === 'URL' ? btn.url?.trim() : undefined,
          phone_number: btn.type === 'PHONE_NUMBER' ? btn.phone_number?.trim() : undefined,
        })),
      });
    }

    const payload: CreateMetaTemplatePayload = {
      name: name.trim(),
      category,
      language,
      components,
    };

    try {
      const res = await templatesApi.createMetaTemplate(payload);

      if (res && res.success) {
        router.push('/dashboard/templates?created=true');
      } else {
        setErrorMessage(
          res?.msg ||
            (res as any)?.error ||
            'Failed to submit template to Meta. Please check your Meta Cloud API connection in Settings.'
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.msg ||
          err.message ||
          'A network error occurred while communicating with the server.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Preview Components construction
  const previewComponents: MetaTemplateComponent[] = [];

  if (headerType !== 'NONE') {
    previewComponents.push({
      type: 'HEADER',
      format: headerType,
      text: headerText,
    });
  }

  previewComponents.push({
    type: 'BODY',
    text: bodyText,
  });

  if (footerText) {
    previewComponents.push({
      type: 'FOOTER',
      text: footerText,
    });
  }

  if (buttonType !== 'NONE' && buttons.length > 0) {
    previewComponents.push({
      type: 'BUTTONS',
      buttons,
    });
  }

  const hasPhoneButton = buttons.some((b) => b.type === 'PHONE_NUMBER');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/templates" />}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back to Templates</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create WhatsApp Template
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure message structure and submit directly to Meta Cloud API for review.
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive" className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Validation / Submission Notice</AlertTitle>
          <AlertDescription className="text-xs mt-1">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Mobile Tab Switcher (Visible on < lg) */}
      <div className="lg:hidden flex items-center p-1 rounded-xl bg-muted/60 border">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 touch-manipulation ${
            mobileTab === 'editor'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileEdit className="h-3.5 w-3.5" />
          <span>Configure Template</span>
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
          <span>Live WhatsApp Preview</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Configuration */}
        <form onSubmit={handleSubmit} className={`lg:col-span-7 space-y-6 ${mobileTab !== 'editor' ? 'hidden lg:block' : ''}`}>
          {/* Section 1: Template Information */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1. Template Information</CardTitle>
              <CardDescription className="text-xs">
                Unique identifier, category classification, and language code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name" className="text-xs font-medium">
                  Template Name *
                </Label>
                <Input
                  id="template-name"
                  placeholder="e.g. order_status_update"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="font-mono text-sm h-9"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Lowercase letters, numbers, and underscores only. Cannot be changed once approved by Meta.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs font-medium">
                    Category *
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(val) => setCategory((val || 'MARKETING') as MetaTemplateCategory)}
                  >
                    <SelectTrigger id="category" className="h-9 text-sm">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">Marketing (Offers, Announcements)</SelectItem>
                      <SelectItem value="UTILITY">Utility (Order, Account, Alerts)</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication (OTP, Verification)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language" className="text-xs font-medium">
                    Language *
                  </Label>
                  <Select value={language} onValueChange={(val) => setLanguage(val || 'en_US')}>
                    <SelectTrigger id="language" className="h-9 text-sm">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name} ({lang.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Header (Optional) */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2. Header (Optional)</CardTitle>
              <CardDescription className="text-xs">
                Add a headline or media banner to make your message visually prominent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="header-type" className="text-xs font-medium">
                  Header Type
                </Label>
                <Select
                  value={headerType}
                  onValueChange={(val) => {
                    setHeaderType(val as any);
                    setHeaderText('');
                    setHeaderMediaUrl('');
                    setHeaderMediaHandle('');
                  }}
                >
                  <SelectTrigger id="header-type" className="h-9 text-sm">
                    <SelectValue placeholder="Header Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None (Body only)</SelectItem>
                    <SelectItem value="TEXT">Text Headline</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document (PDF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {headerType === 'TEXT' && (
                <div className="space-y-2">
                  <Label htmlFor="header-text" className="text-xs font-medium">
                    Header Text *
                  </Label>
                  <Input
                    id="header-text"
                    placeholder="e.g. Order Confirmation"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    maxLength={60}
                    className="h-9 text-sm"
                    required
                  />
                  <div className="text-right text-[11px] text-muted-foreground">
                    {headerText.length} / 60 characters
                  </div>
                </div>
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold">Meta Media Upload</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Upload sample {headerType.toLowerCase()} asset for Meta review verification.
                      </p>
                    </div>
                    {uploadingMedia && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="cursor-pointer">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-background text-xs font-medium hover:bg-muted transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Select File</span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          headerType === 'IMAGE'
                            ? 'image/*'
                            : headerType === 'VIDEO'
                            ? 'video/*'
                            : '.pdf,.doc,.docx'
                        }
                        onChange={handleMediaUpload}
                        disabled={uploadingMedia}
                      />
                    </label>

                    {headerMediaHandle && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Asset uploaded to Meta
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Body */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">3. Body Message *</CardTitle>
              <CardDescription className="text-xs">
                Main text body. Use variables like {`{{1}}`}, {`{{2}}`} for dynamic recipient values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-md bg-muted/40 border text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInsertFormatting('*', '*')}
                  className="h-7 px-2 gap-1 text-xs"
                  title="Bold (*text*)"
                >
                  <Bold className="h-3.5 w-3.5" /> Bold
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInsertFormatting('_', '_')}
                  className="h-7 px-2 gap-1 text-xs"
                  title="Italic (_text_)"
                >
                  <Italic className="h-3.5 w-3.5" /> Italic
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInsertFormatting('~', '~')}
                  className="h-7 px-2 gap-1 text-xs"
                  title="Strikethrough (~text~)"
                >
                  <Strikethrough className="h-3.5 w-3.5" /> Strike
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInsertFormatting('`', '`')}
                  className="h-7 px-2 gap-1 text-xs"
                  title="Monospace (`code`)"
                >
                  <Code className="h-3.5 w-3.5" /> Mono
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleInsertVariable}
                  className="h-7 px-2 gap-1 text-xs font-mono font-medium"
                >
                  <Plus className="h-3 w-3" /> Add {`{{${detectedVarIndices.length + 1}}}`}
                </Button>
              </div>

              <div className="space-y-2">
                <Textarea
                  ref={bodyTextareaRef}
                  placeholder="Hello {{1}}, your order {{2}} has been shipped! Delivery expected by {{3}}."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  className="text-sm font-sans leading-relaxed"
                  required
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Formatting: *bold*, _italic_, ~strike~, `mono`</span>
                  <span>{bodyText.length} / 1024 characters</span>
                </div>
              </div>

              {/* Sample Variable Inputs */}
              {detectedVarIndices.length > 0 && (
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <span>Sample Variable Values (Required for Meta Review)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedVarIndices.map((idx) => (
                      <div key={idx} className="space-y-1">
                        <Label htmlFor={`var-input-${idx}`} className="text-xs font-mono font-medium">
                          {`Variable {{${idx}}}`}
                        </Label>
                        <Input
                          id={`var-input-${idx}`}
                          placeholder={`Sample text for {{${idx}}}`}
                          value={sampleVariables[idx] || ''}
                          onChange={(e) =>
                            setSampleVariables((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Footer (Optional) */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">4. Footer (Optional)</CardTitle>
              <CardDescription className="text-xs">
                Add a short disclaimer or opt-out notice at the bottom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder="e.g. Reply STOP to unsubscribe"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={60}
                  className="h-9 text-sm"
                />
                <div className="text-right text-[11px] text-muted-foreground">
                  {footerText.length} / 60 characters
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Interactive Buttons (Dynamic Builder) */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">5. Interactive Buttons (Optional)</CardTitle>
              <CardDescription className="text-xs">
                Configure Quick Reply buttons (up to 3) or Call-to-Action buttons (URL & Phone, up to 2).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="button-type" className="text-xs font-medium">
                  Button Category
                </Label>
                <Select
                  value={buttonType}
                  onValueChange={(val) => {
                    setButtonType(val as any);
                    setButtons([]);
                  }}
                >
                  <SelectTrigger id="button-type" className="h-9 text-sm">
                    <SelectValue placeholder="Button Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None (No interactive buttons)</SelectItem>
                    <SelectItem value="QUICK_REPLY">Quick Reply (Up to 3 reply options)</SelectItem>
                    <SelectItem value="CALL_TO_ACTION">Call to Action (Website URL or Phone Number, up to 2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {buttonType !== 'NONE' && (
                <div className="space-y-3 pt-1">
                  {buttons.map((btn, i) => (
                    <div key={i} className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            Button {i + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {btn.type === 'QUICK_REPLY' && <MessageSquare className="h-3 w-3" />}
                            {btn.type === 'URL' && <ExternalLink className="h-3 w-3" />}
                            {btn.type === 'PHONE_NUMBER' && <Phone className="h-3 w-3" />}
                            <span>{btn.type.replace('_', ' ')}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Reordering */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={i === 0}
                            onClick={() => handleMoveButton(i, 'up')}
                            className="h-6 w-6"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={i === buttons.length - 1}
                            onClick={() => handleMoveButton(i, 'down')}
                            className="h-6 w-6"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveButton(i)}
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Remove Button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Button Label *</Label>
                          <span className="text-[11px] text-muted-foreground">{btn.text.length} / 25</span>
                        </div>
                        <Input
                          placeholder={
                            btn.type === 'QUICK_REPLY'
                              ? 'e.g. Track Order'
                              : btn.type === 'URL'
                              ? 'e.g. Visit Store'
                              : 'e.g. Call Support'
                          }
                          value={btn.text}
                          onChange={(e) => handleButtonChange(i, 'text', e.target.value)}
                          maxLength={25}
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {btn.type === 'URL' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Website URL (http:// or https://) *</Label>
                          <Input
                            placeholder="https://example.com/orders"
                            value={btn.url || ''}
                            onChange={(e) => handleButtonChange(i, 'url', e.target.value)}
                            className="h-8 text-xs font-mono"
                            required
                          />
                        </div>
                      )}

                      {btn.type === 'PHONE_NUMBER' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Phone Number (with Country Code) *</Label>
                          <Input
                            placeholder="+16505551234"
                            value={btn.phone_number || ''}
                            onChange={(e) => handleButtonChange(i, 'phone_number', e.target.value)}
                            className="h-8 text-xs font-mono"
                            required
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Button Controls */}
                  {buttonType === 'QUICK_REPLY' && buttons.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddQuickReply}
                      className="w-full gap-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Quick Reply Button ({buttons.length}/3)
                    </Button>
                  )}

                  {buttonType === 'CALL_TO_ACTION' && buttons.length < 2 && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddUrlButton}
                        className="flex-1 gap-1.5 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Website Link
                      </Button>
                      {!hasPhoneButton && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddPhoneButton}
                          className="flex-1 gap-1.5 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Phone Call
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              render={<Link href="/dashboard/templates" />}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2 w-full sm:w-auto">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Submit to Meta for Review</span>
            </Button>
          </div>
        </form>

        {/* Right Column: Live Sticky Simulation */}
        <div className={`lg:col-span-5 lg:sticky lg:top-20 space-y-4 ${mobileTab !== 'preview' ? 'hidden lg:block' : ''}`}>
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Live Simulation</CardTitle>
                  <CardDescription className="text-xs">
                    Real-time WhatsApp rendering preview with dynamic variable substitution.
                  </CardDescription>
                </div>
                {/* Mobile Return to Editor Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileTab('editor')}
                  className="lg:hidden text-xs gap-1 h-7"
                >
                  <FileEdit className="h-3 w-3" />
                  <span>Edit</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TemplatePreview
                components={previewComponents}
                sampleVariables={sampleVariables}
                headerMediaUrl={headerMediaUrl}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
