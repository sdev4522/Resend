'use client';

import React, { useState } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Tag,
  StickyNote,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  QrCode,
  Cloud,
} from "lucide-react";
import Link from "next/link";

export function ContactDetailPanel({ isMobileSheet = false }: { isMobileSheet?: boolean } = {}) {
  const {
    selectedConversation,
    selectedContact,
    countDownTimer,
    availableTags,
    addTagToChat,
    removeTagFromChat,
    addNoteToChat,
    deleteNoteFromChat,
    showContactPanel,
    setShowContactPanel,
  } = useInbox();

  const [newNoteText, setNewNoteText] = useState<string>("");
  const [selectedTagToAdd, setSelectedTagToAdd] = useState<string>("");

  if (!selectedConversation) return null;
  if (!isMobileSheet && !showContactPanel) return null;

  const contactName =
    selectedContact?.name ||
    (selectedConversation.sender_name && selectedConversation.sender_name !== "NA"
      ? selectedConversation.sender_name
      : selectedConversation.sender_mobile);

  const contactPhone =
    selectedContact?.mobile || selectedConversation.sender_mobile;

  const isQr = selectedConversation.origin === "qr";

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    await addNoteToChat(newNoteText);
    setNewNoteText("");
  };

  const handleAddTag = async () => {
    if (!selectedTagToAdd) return;
    await addTagToChat(selectedTagToAdd);
    setSelectedTagToAdd("");
  };

  const contactTags = selectedContact?.tags || [];
  const contactNotes = selectedContact?.notes || [];

  return (
    <div className="w-full lg:w-80 h-full border-l bg-card flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-3.5 border-b flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-primary" />
          <span>Contact Details</span>
        </h4>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowContactPanel(false)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label="Close contact details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Card */}
        <div className="text-center space-y-2 pb-4 border-b">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/25 text-primary flex items-center justify-center font-bold text-xl mx-auto shadow-2xs">
            {(contactName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{contactName}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{contactPhone}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px] font-mono flex items-center gap-1">
              {isQr ? <QrCode className="h-2.5 w-2.5 text-emerald-600" /> : <Cloud className="h-2.5 w-2.5 text-blue-600" />}
              <span>{isQr ? "WhatsApp Web (QR)" : "Meta Cloud API"}</span>
            </Badge>
          </div>
        </div>

        {/* 24-hr Session Window Indicator */}
        {countDownTimer && countDownTimer.timestamp && (
          <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Customer Care Window</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Standard freeform WhatsApp messaging is active within the 24-hour response window.
            </p>
          </div>
        )}

        {/* Meta / Profile Information */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Contact Metadata
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-foreground truncate">{contactPhone}</span>
            </div>
            {selectedContact?.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground truncate">{selectedContact.email}</span>
              </div>
            )}
            {(selectedContact?.city || selectedContact?.country) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground truncate">
                  {[selectedContact?.city, selectedContact?.state, selectedContact?.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>

          <div className="pt-1">
            <Link
              href="/dashboard/contacts"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>View in Contacts directory</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Chat Tags / Labels */}
        <div className="space-y-2.5 pt-2 border-t">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3 text-primary" /> Tags
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {contactTags.length === 0 ? (
              <span className="text-[11px] text-muted-foreground italic">No tags assigned.</span>
            ) : (
              contactTags.map((tag: any, idx: number) => {
                const title = typeof tag === "string" ? tag : tag.title;
                return (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-[10px] pl-2 pr-1 py-0.5 flex items-center gap-1 font-mono"
                  >
                    <span>{title}</span>
                    <button
                      onClick={() => removeTagFromChat(title)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })
            )}
          </div>

          {/* Add Tag Dropdown */}
          <div className="flex items-center gap-1.5 pt-1">
            <select
              value={selectedTagToAdd}
              onChange={(e) => setSelectedTagToAdd(e.target.value)}
              className="h-7 text-[11px] rounded-lg border bg-background px-2 flex-1 font-mono"
            >
              <option value="">Select a tag to add...</option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.title}>
                  {t.title}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedTagToAdd}
              onClick={handleAddTag}
              className="h-7 text-xs px-2 gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2.5 pt-2 border-t">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <StickyNote className="h-3 w-3 text-primary" /> Internal Notes
            </p>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {contactNotes.length === 0 ? (
              <span className="text-[11px] text-muted-foreground italic block">No notes yet.</span>
            ) : (
              contactNotes.map((note: any, idx: number) => {
                const noteText = typeof note === "string" ? note : note.text;
                const noteId = note.id || String(idx);
                return (
                  <div
                    key={noteId}
                    className="p-2.5 rounded-lg border bg-muted/30 text-xs space-y-1 relative group"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="whitespace-pre-wrap leading-relaxed flex-1 text-[11px]">{noteText}</p>
                      <button
                        onClick={() => deleteNoteFromChat(noteId)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-0.5"
                        title="Delete note"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {note.timestamp && (
                      <p className="text-[9px] text-muted-foreground font-mono">
                        {new Date(note.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="space-y-1.5 pt-1">
            <Input
              placeholder="Write an internal note..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newNoteText.trim()}
              className="w-full h-7 text-xs font-semibold gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Save Note</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
