'use client';

import React, { useEffect, useState } from 'react';
import { mailApi } from '@/lib/api/mail';
import { MailTemplateItem } from '@/types/notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Plus,
  Edit,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export default function AdminMailTemplatesPage() {
  const [templates, setTemplates] = useState<MailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editor Dialog State
  const [editingTemplate, setEditingTemplate] = useState<MailTemplateItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Preview Dialog State
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Delete Dialog State
  const [deletingTemplate, setDeletingTemplate] = useState<MailTemplateItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mailApi.getTemplates();
      if (Array.isArray(res)) {
        setTemplates(res);
      } else {
        setError('Failed to fetch mail templates.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const showBanner = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const openCreateModal = () => {
    setIsNew(true);
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBody(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f4f7; padding: 20px; }
    .container { background: #ffffff; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .title { color: #111827; font-size: 20px; font-weight: 700; margin-bottom: 16px; }
    .content { color: #4b5563; font-size: 15px; line-height: 1.6; }
    .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">Hello {{name}},</div>
    <div class="content">
      <p>Thank you for using {{app_name}}.</p>
      <p>Your subscription tier is <strong>{{plan}}</strong>.</p>
    </div>
    <div class="footer">
      Sent with ❤️ by {{app_name}}
    </div>
  </div>
</body>
</html>`);
    setEditorError(null);
  };

  const openEditModal = (tpl: MailTemplateItem) => {
    setIsNew(false);
    setEditingTemplate(tpl);
    setName(tpl.name);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setEditorError(null);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setEditorError('Template identifier, subject, and HTML body are all required.');
      return;
    }

    setEditorLoading(true);
    setEditorError(null);

    try {
      const res = await mailApi.saveTemplate({
        id: isNew ? undefined : editingTemplate?.id,
        name: name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        subject: subject.trim(),
        body: body.trim(),
      });

      if (res && res.success) {
        setEditingTemplate(null);
        setIsNew(false);
        showBanner(`Template "${name}" saved successfully.`);
        await fetchTemplates();
      } else {
        setEditorError(res?.msg || 'Failed to save template.');
      }
    } catch (err: any) {
      setEditorError(err.message || 'Error occurred while saving template.');
    } finally {
      setEditorLoading(false);
    }
  };

  const handlePreview = async (tplOrFormBody: string, tplSubject: string) => {
    try {
      const res = await mailApi.previewTemplate(tplSubject, tplOrFormBody);
      setPreviewHtml(res.renderedBody);
      setPreviewSubject(res.renderedSubject);
      setShowPreviewModal(true);
    } catch (err: any) {
      alert(err.message || 'Error generating preview.');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setDeleteLoading(true);
    try {
      const res = await mailApi.deleteTemplate(deletingTemplate.id);
      if (res && res.success) {
        setDeletingTemplate(null);
        showBanner(`Template "${deletingTemplate.name}" deleted.`);
        await fetchTemplates();
      } else {
        alert(res?.msg || 'Failed to delete template.');
      }
    } catch (err: any) {
      alert(err.message || 'Server error.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const insertVariable = (token: string) => {
    setBody((prev) => prev + ` {{${token}}}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Email Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design, edit, and preview transactional HTML templates for welcome emails, billing alerts, and system notices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateModal} size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
          <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {successMsg && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">{successMsg}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Templates</AlertTitle>
          <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
        </Alert>
      )}

      {/* Templates Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Configured Templates</CardTitle>
            <CardDescription className="text-xs">
              System transactional email schemas with variable token interpolation
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {templates.length} templates
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No email templates found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create standard templates for notifications, welcome emails, or invoice receipts.
              </p>
              <Button onClick={openCreateModal} size="sm" className="mt-2 gap-1.5">
                <Plus className="h-4 w-4" /> Create First Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[180px]">Slug / Key</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {tpl.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground max-w-xs truncate">
                      {tpl.subject}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(tpl.body, tpl.subject)}
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(tpl)}
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTemplate(tpl)}
                          className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Editor Modal */}
      <Dialog
        open={isNew || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setIsNew(false);
            setEditingTemplate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveTemplate}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                {isNew ? 'Create Email Template' : `Edit Template: ${editingTemplate?.name}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure HTML structure and dynamic merge tags.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {editorError && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{editorError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name" className="text-xs font-medium">
                    Template Identifier (slug)
                  </Label>
                  <Input
                    id="tpl-name"
                    placeholder="e.g. welcome_email"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={!isNew}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-subject" className="text-xs font-medium">
                    Email Subject Line
                  </Label>
                  <Input
                    id="tpl-subject"
                    placeholder="e.g. Welcome to {{app_name}}, {{name}}!"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Tokens Helper Bar */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Insert Merge Tags
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {['name', 'email', 'plan', 'app_name', 'login_url'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertVariable(tok)}
                      className="px-2 py-0.5 rounded border bg-muted/50 hover:bg-muted text-[11px] font-mono transition-colors"
                    >
                      &#123;&#123;{tok}&#125;&#125;
                    </button>
                  ))}
                </div>
              </div>

              {/* HTML Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-body" className="text-xs font-medium">
                    HTML Email Body
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(body, subject)}
                    className="h-6 text-[11px] px-2 gap-1 text-primary"
                  >
                    <Eye className="h-3 w-3" /> Live Render
                  </Button>
                </div>
                <textarea
                  id="tpl-body"
                  rows={14}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-muted/20 p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNew(false);
                  setEditingTemplate(null);
                }}
                disabled={editorLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editorLoading} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                {editorLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Template Preview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Subject: <strong className="text-foreground">{previewSubject}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 border rounded-lg overflow-hidden bg-white min-h-[350px] p-2 mt-2">
            <iframe
              title="Mail Preview"
              srcDoc={previewHtml || ''}
              className="w-full h-full min-h-[350px] border-0"
              sandbox="allow-same-origin"
            />
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={() => setShowPreviewModal(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Email Template
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete template{' '}
              <strong>&quot;{deletingTemplate?.name}&quot;</strong>? Transactional emails using this template slug will fallback to basic text.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeletingTemplate(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTemplate}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
