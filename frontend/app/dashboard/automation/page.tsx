'use client';

import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { AutomationList } from '@/components/automation/automation-list';
import { useEntitlements } from '@/hooks/use-entitlements';
import { UpgradePrompt } from '@/components/dashboard/upgrade-prompt';

export default function AutomationPage() {
  const { hasFeature, loading: planLoading } = useEntitlements();

  const isChatbotAllowed = hasFeature('chatbot');

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Chatbot rules"
        description="Auto-replies, keyword routing and chatbot workflows."
        breadcrumbs={[{ title: 'Automation' }]}
      />

      {/* Plan Entitlement Gate */}
      {!planLoading && !isChatbotAllowed && (
        <UpgradePrompt
          title="Chatbots aren’t on your plan"
          description="Upgrade to build auto-replies, keyword routing and webhook automations."
        />
      )}

      {/* Main List */}
      <AutomationList />
    </div>
  );
}
