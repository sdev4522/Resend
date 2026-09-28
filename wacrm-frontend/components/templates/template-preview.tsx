'use client';

import React from 'react';
import Image from 'next/image';
import {
  MetaTemplateComponent,
  MetaTemplateComponentHeader,
  MetaTemplateComponentBody,
  MetaTemplateComponentFooter,
  MetaTemplateComponentButtons,
} from '@/types/template';
import {
  ImageIcon,
  Video,
  FileText,
  ExternalLink,
  Phone,
  CornerDownLeft,
  CheckCheck,
} from 'lucide-react';

interface TemplatePreviewProps {
  components: MetaTemplateComponent[];
  sampleVariables?: Record<string, string>;
  headerMediaUrl?: string;
  className?: string;
}

// Render formatted WhatsApp text with *bold*, _italic_, ~strikethrough~, and `monospace`
function renderFormattedWhatsApp(text: string) {
  if (!text) return null;

  // Split lines to preserve whitespace cleanly
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    // Tokenize text for markdown styles
    // Matches *bold*, _italic_, ~strike~, `mono`
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g;
    const parts = line.split(regex);

    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, partIdx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <strong key={partIdx} className="font-semibold text-foreground">
                {part.slice(1, -1)}
              </strong>
            );
          }
          if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
            return (
              <em key={partIdx} className="italic">
                {part.slice(1, -1)}
              </em>
            );
          }
          if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
            return (
              <span key={partIdx} className="line-through opacity-80">
                {part.slice(1, -1)}
              </span>
            );
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
              <code
                key={partIdx}
                className="font-mono text-xs px-1 py-0.5 rounded bg-muted/60"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export function TemplatePreview({
  components,
  sampleVariables = {},
  headerMediaUrl,
  className = '',
}: TemplatePreviewProps) {
  const headerComp = components.find((c) => c.type === 'HEADER') as
    | MetaTemplateComponentHeader
    | undefined;
  const bodyComp = components.find((c) => c.type === 'BODY') as
    | MetaTemplateComponentBody
    | undefined;
  const footerComp = components.find((c) => c.type === 'FOOTER') as
    | MetaTemplateComponentFooter
    | undefined;
  const buttonsComp = components.find((c) => c.type === 'BUTTONS') as
    | MetaTemplateComponentButtons
    | undefined;

  // Replace {{1}}, {{2}} with sample variables
  const interpolateText = (text: string = '') => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
      return sampleVariables[index] ? sampleVariables[index] : `{{${index}}}`;
    });
  };

  const formattedBodyText = interpolateText(bodyComp?.text || '');
  const formattedHeaderText = interpolateText(headerComp?.text || '');

  const buttons = buttonsComp?.buttons || [];
  return (
    <div
      className={`rounded-xl border bg-[#ECE5DD] dark:bg-[#0B141A] p-4 flex flex-col items-center justify-center min-h-[340px] select-none ${className}`}
    >
      {/* WhatsApp Message Bubble */}
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-[#1F2C34] text-foreground shadow-sm overflow-hidden text-sm border border-border/40 transition-all">
        {/* Header Component */}
        {headerComp && (
          <div>
            {headerComp.format === 'TEXT' && formattedHeaderText && (
              <div className="px-3.5 pt-3 pb-1 font-bold text-sm text-foreground">
                {formattedHeaderText}
              </div>
            )}

            {headerComp.format === 'IMAGE' && (
              <div className="h-40 w-full bg-muted flex items-center justify-center overflow-hidden relative">
                {headerMediaUrl ? (
                  <Image
                    src={headerMediaUrl}
                    alt="Header Preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-[11px] font-medium">Image Header</span>
                  </div>
                )}
              </div>
            )}

            {headerComp.format === 'VIDEO' && (
              <div className="h-36 w-full bg-muted flex items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-1.5">
                  <Video className="h-8 w-8" />
                  <span className="text-[11px] font-medium">Video Header</span>
                </div>
              </div>
            )}

            {headerComp.format === 'DOCUMENT' && (
              <div className="m-2 p-2.5 rounded-md bg-muted/60 border flex items-center gap-2.5">
                <FileText className="h-6 w-6 text-primary" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Document Header</span>
                  <span className="text-[10px] text-muted-foreground">PDF, DOCX, or XLSX</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body Component */}
        <div className="px-3.5 py-2.5 leading-relaxed text-sm text-foreground/90 break-words">
          {formattedBodyText ? (
            renderFormattedWhatsApp(formattedBodyText)
          ) : (
            <span className="italic text-muted-foreground text-xs">
              Template body content will appear here...
            </span>
          )}
        </div>

        {/* Footer Component */}
        {footerComp?.text && (
          <div className="px-3.5 pb-1 text-[11px] text-muted-foreground">
            {footerComp.text}
          </div>
        )}

        {/* Message Delivery Meta */}
        <div className="px-3.5 pb-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>12:00 PM</span>
          <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
        </div>

        {/* Interactive Buttons Component */}
        {buttons.length > 0 && (
          <div className="border-t border-border/50 divide-y divide-border/50 bg-muted/20">
            {buttons.map((btn, idx) => (
              <div
                key={idx}
                className="py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-muted/40 transition-colors cursor-pointer text-center"
              >
                {btn.type === 'URL' && <ExternalLink className="h-3.5 w-3.5 text-primary" />}
                {btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5 text-primary" />}
                {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                <span className="truncate">{btn.text || `Button ${idx + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground text-center">
        Live WhatsApp Message Preview
      </div>
    </div>
  );
}
