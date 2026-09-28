'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysTable } from '@/components/dashboard/developer/api-keys-table';
import { CreateApiKeyDialog } from '@/components/dashboard/developer/create-api-key-dialog';
import { SecretRevealModal } from '@/components/dashboard/developer/secret-reveal-modal';
import { ConnectionsCard } from '@/components/dashboard/developer/connections-card';
import { LimitsCard } from '@/components/dashboard/developer/limits-card';
import { UsageCard } from '@/components/dashboard/developer/usage-card';
import { DocumentationView } from '@/components/dashboard/developer/documentation-view';
import { developerApi } from '@/lib/api/developer';
import {
  ApiKey,
  ApiKeyCreatedResult,
  DeveloperConnection,
  DeveloperLimits,
  DeveloperStats,
} from '@/types/developer';
import { toast } from 'sonner';
import { Key, Radio, Gauge, BookOpen, Loader2 } from 'lucide-react';

export default function DeveloperPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [connections, setConnections] = useState<DeveloperConnection[]>([]);
  const [limits, setLimits] = useState<DeveloperLimits | null>(null);
  const [stats, setStats] = useState<DeveloperStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<ApiKeyCreatedResult | null>(null);

  const loadDeveloperData = useCallback(async () => {
    try {
      const [keysRes, connsRes, limitsRes, statsRes] = await Promise.allSettled([
        developerApi.getKeys(),
        developerApi.getConnections(),
        developerApi.getLimits(),
        developerApi.getStats(),
      ]);

      if (keysRes.status === 'fulfilled' && keysRes.value.success) {
        setKeys(keysRes.value.data || []);
      }
      if (connsRes.status === 'fulfilled' && connsRes.value.success) {
        setConnections(connsRes.value.data || []);
      }
      if (limitsRes.status === 'fulfilled' && limitsRes.value.success) {
        setLimits(limitsRes.value.data || null);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        setStats(statsRes.value.data || null);
      }
    } catch {
      toast.error('Failed to load developer data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeveloperData();
  }, [loadDeveloperData]);

  const handleKeyCreated = (result: ApiKeyCreatedResult) => {
    setCreatedSecret(result);
    loadDeveloperData();
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Developer API"
        description="Generate API keys, manage WhatsApp connections, monitor rate limits, and integrate via REST."
      />

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Loading developer platform...</p>
        </div>
      ) : (
        <Tabs defaultValue="keys" className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="keys" className="gap-1.5 text-xs">
              <Key className="h-3.5 w-3.5" />
              <span>API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-1.5 text-xs">
              <Radio className="h-3.5 w-3.5" />
              <span>Connections</span>
            </TabsTrigger>
            <TabsTrigger value="limits" className="gap-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5" />
              <span>Limits & Usage</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Docs</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: API Keys */}
          <TabsContent value="keys" className="space-y-4">
            <ApiKeysTable
              keys={keys}
              connections={connections}
              onRefresh={loadDeveloperData}
              onCreateOpen={() => setCreateDialogOpen(true)}
            />
          </TabsContent>

          {/* Tab: Connections */}
          <TabsContent value="connections" className="space-y-4">
            <ConnectionsCard connections={connections} />
          </TabsContent>

          {/* Tab: Limits & Usage */}
          <TabsContent value="limits" className="space-y-6">
            <LimitsCard limits={limits} stats={stats} />
            <UsageCard stats={stats} />
          </TabsContent>

          {/* Tab: Documentation */}
          <TabsContent value="docs" className="space-y-4">
            <DocumentationView />
          </TabsContent>
        </Tabs>
      )}

      {/* Creation Modal */}
      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        connections={connections}
        onKeyCreated={handleKeyCreated}
      />

      {/* One-Time Secret Reveal Modal */}
      {createdSecret && (
        <SecretRevealModal
          open={!!createdSecret}
          onOpenChange={(open) => !open && setCreatedSecret(null)}
          keyName={createdSecret.name}
          secret={createdSecret.secret}
        />
      )}
    </div>
  );
}
