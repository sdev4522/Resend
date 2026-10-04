'use client';

import React from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Sparkles,
  List,
  GitFork,
  Clock,
  Globe,
  Bot,
  Bookmark,
  Tag,
  BookUser,
  ShieldBan,
  RotateCcw,
  FileCheck,
  FormInput,
  Plus,
} from 'lucide-react';
import { FlowNodeType, MessageSubtype } from '@/types/automation';

export interface PaletteItem {
  type: FlowNodeType;
  subtype?: MessageSubtype;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultData: Record<string, any>;
  category: 'messages' | 'logic' | 'integrations' | 'ai' | 'advanced' | 'whatsapp';
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Messages
  {
    type: 'SEND_MESSAGE',
    subtype: 'text',
    label: 'Send Text',
    description: 'Plain text with dynamic {{variables}}',
    icon: MessageSquare,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'text', title: 'Simple Text' },
      content: { type: 'text', text: { body: 'Hello! How can we assist you today?', preview_url: true } },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'image',
    label: 'Send Image',
    description: 'JPG, PNG, or WebP photo with caption',
    icon: ImageIcon,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'image', title: 'Image' },
      content: { type: 'image', image: { link: '', caption: '' } },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'video',
    label: 'Send Video',
    description: 'MP4 video message with caption',
    icon: Video,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'video', title: 'Video' },
      content: { type: 'video', video: { link: '', caption: '' } },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'audio',
    label: 'Send Audio',
    description: 'Voice note or MP3/OGG recording',
    icon: Mic,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'audio', title: 'Audio' },
      content: { type: 'audio', audio: { link: '' } },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'document',
    label: 'Send Document',
    description: 'PDF, catalogue, or file attachment',
    icon: FileText,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'document', title: 'Document' },
      content: { type: 'document', document: { link: '', caption: '', filename: 'document.pdf' } },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'button',
    label: 'Reply Buttons',
    description: 'Up to 3 quick clickable buttons (Meta)',
    icon: Sparkles,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'button', title: 'Button Message' },
      content: {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Please select an option below:' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_1', title: 'Option 1' } },
              { type: 'reply', reply: { id: 'btn_2', title: 'Option 2' } },
            ],
          },
        },
      },
    },
  },
  {
    type: 'SEND_MESSAGE',
    subtype: 'list',
    label: 'List Menu',
    description: 'Interactive popup selection menu (Meta)',
    icon: List,
    category: 'messages',
    defaultData: {
      moveToNextNode: false,
      type: { type: 'list', title: 'List Message' },
      content: {
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Select Service' },
          body: { text: 'Choose one of our offerings from the list:' },
          footer: { text: 'Powered by Resend' },
          action: {
            button: 'View Options',
            sections: [
              {
                title: 'Main Services',
                rows: [
                  { id: 'srv_1', title: 'Sales Inquiry', description: 'Talk to sales' },
                  { id: 'srv_2', title: 'Customer Support', description: 'Get technical help' },
                ],
              },
            ],
          },
        },
      },
    },
  },

  // Logic
  {
    type: 'CONDITION',
    label: 'Condition Router',
    description: 'Branch flow based on user keywords or input',
    icon: GitFork,
    category: 'logic',
    defaultData: {
      moveToNextNode: true,
      conditions: [
        {
          name: 'Sales Keyword',
          type: 'text_contains',
          value: 'sales',
          targetNodeId: 'cond_sales',
          caseSensitive: false,
        },
      ],
      variable: { message: '', active: false },
    },
  },
  {
    type: 'DELAY',
    label: 'Delay Timer',
    description: 'Pause flow for a specified number of seconds',
    icon: Clock,
    category: 'logic',
    defaultData: {
      moveToNextNode: true,
      seconds: 5,
    },
  },

  // Integrations
  {
    type: 'MAKE_REQUEST',
    label: 'Webhook Request',
    description: 'Trigger external HTTP API and capture data',
    icon: Globe,
    category: 'integrations',
    defaultData: {
      moveToNextNode: true,
      method: 'POST',
      url: 'https://api.example.com/endpoint',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      contentType: 'application/json',
      bodyInputMode: 'visual',
      bodyData: { json: [{ key: 'sender', value: '{{{senderMobile}}}' }] },
      variables: [],
    },
  },

  // AI
  {
    type: 'AI_TRANSFER',
    label: 'AI Agent Reply',
    description: 'Generate context-aware reply using LLM',
    icon: Bot,
    category: 'ai',
    defaultData: {
      moveToNextNode: false,
      assignedToAi: false,
      messageReferenceCount: 10,
      instruction: 'You are a helpful customer support representative for our company. Answer questions accurately and politely.',
      model: 'gpt-4o',
    },
  },

  // Advanced / CRM
  {
    type: 'RESPONSE_SAVER',
    label: 'Save Response',
    description: 'Store incoming message into custom variable',
    icon: Bookmark,
    category: 'advanced',
    defaultData: {
      moveToNextNode: true,
      variables: [{ varName: 'userAnswer', responsePath: 'message.senderMessage' }],
    },
  },
  {
    type: 'SET_CHAT_LABEL',
    label: 'Apply Tag',
    description: 'Attach a CRM label to the conversation',
    icon: Tag,
    category: 'advanced',
    defaultData: {
      moveToNextNode: true,
      labelsToAdd: [],
    },
  },
  {
    type: 'PHONEBOOK_MANAGER',
    label: 'Contact Book',
    description: 'Add or remove customer to phonebook',
    icon: BookUser,
    category: 'advanced',
    defaultData: {
      moveToNextNode: true,
      action: 'add',
      phonebook_id: 0,
      phonebook_name: '',
    },
  },
  {
    type: 'DISABLE_AUTOREPLY',
    label: 'Disable Auto-Reply',
    description: 'Handoff conversation to human agent',
    icon: ShieldBan,
    category: 'advanced',
    defaultData: {
      moveToNextNode: false,
    },
  },
  {
    type: 'RESET',
    label: 'Reset Session',
    description: 'Restart conversation state from beginning',
    icon: RotateCcw,
    category: 'advanced',
    defaultData: {
      moveToNextNode: false,
    },
  },

  // WhatsApp Specific
  {
    type: 'SEND_WA_TEMPLATE',
    label: 'Meta Template',
    description: 'Send pre-approved Meta WhatsApp template',
    icon: FileCheck,
    category: 'whatsapp',
    defaultData: {
      moveToNextNode: false,
      template: {},
    },
  },
  {
    type: 'SEND_WA_FORM',
    label: 'WhatsApp Flow / Form',
    description: 'Interactive native in-chat form (Meta Cloud)',
    icon: FormInput,
    category: 'whatsapp',
    defaultData: {
      moveToNextNode: true,
      waForm: {},
      headerText: 'Customer Information',
      bodyText: 'Please fill out this form to proceed.',
      footerText: 'Powered by Resend',
      ctaText: 'Open Form',
    },
  },
];

interface NodePaletteProps {
  onAddNode: (item: PaletteItem) => void;
  isQrConnection?: boolean;
}

export function NodePalette({ onAddNode, isQrConnection = false }: NodePaletteProps) {
  const categories = [
    { id: 'messages', label: 'Messages' },
    { id: 'logic', label: 'Logic & Routing' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'ai', label: 'AI & Bot' },
    { id: 'advanced', label: 'CRM & State' },
    { id: 'whatsapp', label: 'WhatsApp Forms' },
  ];

  const handleDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData('application/reactflow-item', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border select-none">
      <div className="p-3 border-b border-border/80">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Node Palette
        </h3>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
          Click or drag onto canvas to build flow
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {categories.map((cat) => {
          const items = PALETTE_ITEMS.filter((i) => i.category === cat.id);
          if (items.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
                {cat.label}
              </span>

              <div className="space-y-1">
                {items.map((item, idx) => {
                  const Icon = item.icon;
                  const isUnsupportedOnQr =
                    isQrConnection &&
                    (item.subtype === 'button' ||
                      item.subtype === 'list' ||
                      item.type === 'SEND_WA_TEMPLATE' ||
                      item.type === 'SEND_WA_FORM');

                  return (
                    <div
                      key={idx}
                      draggable={!isUnsupportedOnQr}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onClick={() => !isUnsupportedOnQr && onAddNode(item)}
                      className={`group flex items-start gap-2.5 p-2 rounded-lg border transition-all text-left ${
                        isUnsupportedOnQr
                          ? 'opacity-40 border-dashed border-border cursor-not-allowed bg-muted/20'
                          : 'cursor-grab active:cursor-grabbing border-border/60 hover:border-primary/40 hover:bg-muted/40 hover:shadow-2xs'
                      }`}
                      title={
                        isUnsupportedOnQr
                          ? 'Not supported on QR accounts. Requires Meta Cloud API.'
                          : undefined
                      }
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.label}
                          </span>
                          {!isUnsupportedOnQr && (
                            <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
