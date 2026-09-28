'use client';

import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { AutomationList } from '@/components/automation/automation-list';
import { useEntitlements } from '@/hooks/use-entitlements';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function FlowsPage() {
  const { hasFeature, loading: planLoading } = useEntitlements();
  const isChatbotAllowed = hasFeature('chatbot');

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Visual Flow Builder"
        description="Design visual conversational trees, interactive routing, and keyword automations."
        breadcrumbs={[{ title: 'Flows' }]}
      />

      {!planLoading && !isChatbotAllowed && (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-bold">Flow Builder Not Included</AlertTitle>
          <AlertDescription className="text-xs mt-1 flex items-center justify-between gap-4">
            <span>
              Your current plan does not include the visual flow builder. Upgrade to create automated conversational flows.
            </span>
            <Link href="/dashboard/billing">
              <Button size="sm" variant="outline" className="shrink-0 bg-background text-foreground">
                Upgrade Plan
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <AutomationList />
    </div>
  );
}
