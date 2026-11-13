'use client';

import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { AutomationList } from '@/components/automation/automation-list';
import { useEntitlements } from '@/hooks/use-entitlements';
import { UpgradePrompt } from '@/components/dashboard/upgrade-prompt';

export default function FlowsPage() {
  const { hasFeature, loading: planLoading } = useEntitlements();
  const isChatbotAllowed = hasFeature('chatbot');

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Flow builder"
        description="Design visual conversation flows for WhatsApp."
        breadcrumbs={[{ title: 'Flows' }]}
      />

      {!planLoading && !isChatbotAllowed && (
        <UpgradePrompt
          title="Flow builder isn’t on your plan"
          description="Upgrade to design visual conversation flows with buttons, lists and routing."
        />
      )}

      <AutomationList />
    </div>
  );
}
