'use client';

import React, { useState, useRef } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Paperclip,
  Send,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
  FileCode,
  X,
  Loader2,
  Lock,
  QrCode,
  Cloud,
} from "lucide-react";
import { TemplateModal } from "./template-modal";

export function MessageComposer() {
  const {
    selectedConversation,
    selectedAccount,
    sendTextMessage,
    sendMediaMessage,
  } = useInbox();

  const [text, setText] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCaption, setFileCaption] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedConversation) return null;

  const isQr = selectedConversation.origin === "qr" || selectedAccount?.type === "qr";

  const handleSendText = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    const sent = await sendTextMessage(text);
    if (sent) setText("");
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const openFilePicker = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || isSending) return;
    setIsSending(true);
    const ok = await sendMediaMessage(selectedFile, fileCaption);
    if (ok) {
      setSelectedFile(null);
      setFileCaption("");
    }
    setIsSending(false);
  };

  return (
    <div className="p-2.5 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t bg-card shrink-0 space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
      />

      {/* Sending Account Indicator Pill */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          <span>Sending from:</span>
          <span className="font-semibold text-foreground flex items-center gap-1">
            {isQr ? (
              <QrCode className="h-3 w-3 text-emerald-600" />
            ) : (
              <Cloud className="h-3 w-3 text-blue-600" />
            )}
            <span>{selectedAccount?.title || (isQr ? "WhatsApp Web (QR)" : "Meta API")}</span>
          </span>
        </div>

        {/* Templates Button: Enforced only for Meta accounts */}
        {isQr ? (
          <div
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono select-none"
            title="Meta WhatsApp templates are not available for QR/Baileys connections"
          >
            <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
            <span>Templates (Meta only)</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
            className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary font-medium touch-manipulation"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Templates</span>
          </Button>
        )}
      </div>

      {/* Staged File Upload Preview */}
      {selectedFile && (
        <div className="p-2.5 rounded-xl border bg-muted/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {selectedFile.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4" />
                ) : selectedFile.type.startsWith("video/") ? (
                  <Video className="h-4 w-4" />
                ) : selectedFile.type.startsWith("audio/") ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
              aria-label="Remove attached file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a caption (optional)..."
              value={fileCaption}
              onChange={(e) => setFileCaption(e.target.value)}
              className="h-8 text-xs bg-background"
            />
            <Button
              size="sm"
              disabled={isSending}
              onClick={handleSendFile}
              className="h-8 text-xs gap-1.5 px-3 font-semibold shrink-0 touch-manipulation"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Send Media</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="flex items-end gap-1.5 sm:gap-2 bg-muted/20 rounded-2xl p-1 sm:p-1.5 border focus-within:border-primary/50 focus-within:bg-background transition-colors">
        {/* Attachment Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0 touch-manipulation"
                aria-label="Attach file"
              />
            }
          >
            <Paperclip className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 p-1 rounded-xl shadow-lg">
            <DropdownMenuItem onClick={() => openFilePicker("image/*")} className="gap-2 text-xs cursor-pointer py-2">
              <ImageIcon className="h-4 w-4 text-blue-500" />
              <span>Photo / Image</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("video/*")} className="gap-2 text-xs cursor-pointer py-2">
              <Video className="h-4 w-4 text-purple-500" />
              <span>Video</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("audio/*")} className="gap-2 text-xs cursor-pointer py-2">
              <Mic className="h-4 w-4 text-amber-500" />
              <span>Audio file</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openFilePicker(".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt")}
              className="gap-2 text-xs cursor-pointer py-2"
            >
              <FileText className="h-4 w-4 text-emerald-500" />
              <span>Document</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text Area */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="min-h-[38px] max-h-32 border-0 bg-transparent resize-none p-2 text-xs focus-visible:ring-0 shadow-none leading-relaxed flex-1"
        />

        {/* Send Button */}
        <Button
          type="button"
          onClick={handleSendText}
          disabled={!text.trim() || isSending}
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0 shadow-2xs font-semibold touch-manipulation"
          aria-label="Send WhatsApp message"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Meta Template Modal */}
      <TemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
      />
    </div>
  );
}
