'use client';

import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DocumentationView } from '@/components/dashboard/developer/documentation-view';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

export default function DeveloperDocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardPageHeader
          title="API Documentation"
          description="Complete developer reference, guides, and SDK examples for WACRM REST API."
        />
        <Button variant="outline" size="sm" render={<Link href="/dashboard/developer" />} className="gap-1.5 shrink-0">
          <Key className="h-3.5 w-3.5" />
          <span>Manage API Keys</span>
        </Button>
      </div>

      <DocumentationView />
    </div>
  );
}
