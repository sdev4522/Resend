'use client';

import React, { useState, useEffect } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { inboxApi } from "@/lib/api/inbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function TemplateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedConversation, selectedAccount, sendMetaTemplate } = useInbox();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      inboxApi
        .getMetaTemplates()
        .then((res) => {
          if (res && res.success && Array.isArray(res.data)) {
            setTemplates(res.data);
            if (res.data.length > 0) {
              setSelectedTemplate(res.data[0]);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Extract variables like {{1}}, {{2}} from template body
  const bodyText = selectedTemplate?.components?.find((c: any) => c.type === "BODY")?.text || selectedTemplate?.body || "";
  const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  const uniqueVars: string[] = Array.from(new Set(variableMatches));

  // Compute preview with replaced variables
  let previewText = bodyText;
  uniqueVars.forEach((v) => {
    const varNum = v.replace(/[\{\}]/g, "");
    const val = variables[varNum] || ("[" + v + "]");
    previewText = previewText.split(v).join(val);
  });

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      const templateName = selectedTemplate.name || selectedTemplate.templet_name;
      const lang = selectedTemplate.language || "en";
      await sendMetaTemplate(templateName, previewText, lang);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch template");
    } finally {
      setSending(false);
    }
  };

  const isQr = selectedConversation?.origin === "qr" || selectedAccount?.type === "qr";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl gap-0 border shadow-xl">
        <DialogHeader className="p-4 px-6 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">Send WhatsApp Template</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Meta Cloud API verified templates for outbound customer engagement.
          </DialogDescription>
        </DialogHeader>

        {isQr ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-foreground">Feature Restricted</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Templates are available only for <span className="font-semibold text-foreground">Meta Cloud API</span> WhatsApp connections. This conversation is connected via WhatsApp Web (QR).
            </p>
          </div>
        ) : loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading approved templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-2">
            <p className="text-xs font-semibold text-foreground">No approved templates found</p>
            <p className="text-[11px] text-muted-foreground">
              Create and sync Meta WhatsApp templates under Dashboard &gt; Templates first.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Template Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Meta Template</Label>
              <select
                value={selectedTemplate?.name || selectedTemplate?.templet_name}
                onChange={(e) => {
                  const t = templates.find((item) => (item.name || item.templet_name) === e.target.value);
                  setSelectedTemplate(t || null);
                  setVariables({});
                }}
                className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-primary"
              >
                {templates.map((t, idx) => (
                  <option key={idx} value={t.name || t.templet_name}>
                    {t.name || t.templet_name} ({t.language || "en"})
                  </option>
                ))}
              </select>
            </div>

            {/* Variable Inputs */}
            {uniqueVars.length > 0 && (
              <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Template Variables
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {uniqueVars.map((v) => {
                    const varNum = v.replace(/[\{\}]/g, "");
                    return (
                      <div key={v} className="space-y-1">
                        <Label className="text-[11px] font-mono text-muted-foreground">Variable {v}</Label>
                        <Input
                          placeholder={"Value for " + v}
                          value={variables[varNum] || ""}
                          onChange={(e) => setVariables({ ...variables, [varNum]: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Preview Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Message Preview</Label>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {selectedTemplate?.category || "UTILITY"}
                </Badge>
              </div>
              <div className="p-3.5 rounded-xl border bg-muted/30 text-xs whitespace-pre-wrap font-sans leading-relaxed shadow-2xs">
                {previewText || "Template content preview"}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>

          {!isQr && templates.length > 0 && (
            <Button
              onClick={handleSend}
              disabled={sending || !selectedTemplate}
              size="sm"
              className="gap-1.5 text-xs font-semibold shadow-2xs"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Send Template</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
