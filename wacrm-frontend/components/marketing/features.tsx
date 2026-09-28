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
    title: 'Multi-Agent Inbox',
    description:
      'One official WhatsApp number for your entire team. Assign chats, reply instantly, and track response resolution.',
  },
  {
    icon: Send,
    title: 'Bulk Broadcasts',
    description:
      'Send targeted announcements, promotions, and updates to thousands of verified contacts with high deliverability.',
  },
  {
    icon: GitFork,
    title: 'Visual Flow Automation',
    description:
      'Design conversational workflows, qualify leads, and collect customer input using intuitive interactive nodes.',
  },
  {
    icon: Bot,
    title: 'Keyword Auto-Replies',
    description:
      'Trigger instant replies to common customer inquiries with text, catalogs, documents, and reply buttons.',
  },
  {
    icon: Users,
    title: 'Contact Management',
    description:
      'Organize customer lists, apply dynamic tags, save custom attributes, and target exact user segments effortlessly.',
  },
  {
    icon: Zap,
    title: 'Developer REST API',
    description:
      'Seamlessly connect your e-commerce store, CRM, and internal tools with our webhooks and messaging API.',
  },
];

export function MarketingFeatures() {
  return (
    <div id="features" className="w-full py-12 xs:py-20 px-6">
      <div className="max-w-screen-lg mx-auto">
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
          Everything You Need for WhatsApp
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-xl mx-auto text-base">
          Consolidate customer communication, marketing campaigns, and support workflows into a single reliable platform.
        </p>
        <div className="w-full mt-10 sm:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col bg-background border rounded-xl py-6 px-5 transition-colors hover:border-foreground/20"
            >
              <div className="mb-3 h-10 w-10 flex items-center justify-center bg-muted rounded-full text-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold">{feature.title}</span>
              <p className="mt-1 text-muted-foreground text-[15px] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
