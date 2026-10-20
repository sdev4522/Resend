import React from 'react';
import {
  MessageSquare,
  Send,
  GitFork,
  Bot,
  Users,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Multi-Agent Team Inbox',
    description:
      'One official WhatsApp number for your entire team. Assign chats to specific agents, reply in real time, and leave private internal notes without disconnecting other team members.',
  },
  {
    icon: Send,
    title: 'Template Broadcast Campaigns',
    description:
      'Send verified template broadcasts to segmented contact lists. Personalize dynamic variables and track delivery, read receipts, and replies in real time.',
  },
  {
    icon: GitFork,
    title: 'Visual Flow Automation',
    description:
      'Design conversational workflows, qualify incoming leads, and collect customer input using intuitive interactive nodes and menu buttons.',
  },
  {
    icon: Bot,
    title: '24/7 Keyword Auto-Replies',
    description:
      'Trigger instant replies to common customer inquiries with text, catalogs, documents, and interactive reply buttons.',
  },
  {
    icon: Users,
    title: 'Contact CRM & Custom Tags',
    description:
      'Organize customer lists, apply dynamic tags, save custom attributes, and target exact user segments effortlessly with bulk CSV support.',
  },
  {
    icon: Zap,
    title: 'Developer REST API & Webhooks',
    description:
      'Connect your web applications, internal tools, and CRM with our developer REST API and HMAC-SHA256 verified inbound webhooks.',
  },
];

export function MarketingFeatures() {
  return (
    <div id="features" className="w-full py-12 xs:py-20 px-6">
      <div className="max-w-screen-lg mx-auto">
        <h1 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center text-foreground">
          Everything You Need to Run WhatsApp at Scale
        </h1>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
          Consolidate customer communication, broadcast campaigns, and automated support workflows into one unified workspace.
        </p>
        <div className="w-full mt-10 sm:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col bg-card border rounded-xl py-6 px-5 transition-colors hover:border-foreground/20"
            >
              <div className="mb-3 h-10 w-10 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
