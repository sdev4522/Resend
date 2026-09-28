'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BuilderHeader } from '@/components/automation/flow-builder/builder-header';
import { RunsViewer } from '@/components/automation/runs-viewer';
import { validateFlow } from '@/components/automation/flow-builder/flow-validation';
import { Skeleton } from '@/components/ui/skeleton';

const FlowCanvas = dynamic(
  () => import('@/components/automation/flow-builder/flow-canvas').then((m) => m.FlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/20">
        <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center space-y-4">
          <Skeleton className="w-3/4 h-64 rounded-xl" />
          <p className="text-xs text-muted-foreground animate-pulse">Loading visual flow canvas...</p>
        </div>
      </div>
    ),
  }
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { QrCode, Cloud, Play, RefreshCw } from 'lucide-react';
import {
  BackendFlow,
  BackendChatbot,
  FlowData,
  AutomationStatus,
  OriginObject,
} from '@/types/automation';
import { automationApi } from '@/lib/api/automation';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FlowBuilderPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const flowId = resolvedParams.id;
  const router = useRouter();

  const [flow, setFlow] = useState<BackendFlow | null>(null);
  const [chatbot, setChatbot] = useState<BackendChatbot | null>(null);
  const [flowData, setFlowData] = useState<FlowData>({ nodes: [], edges: [] });
  const [flowName, setFlowName] = useState('');
  const [status, setStatus] = useState<AutomationStatus>('draft');
  const [origin, setOrigin] = useState<OriginObject | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'runs'>('canvas');

  // Origin activation modal
  const [isOriginModalOpen, setIsOriginModalOpen] = useState(false);
  const [availableOrigins, setAvailableOrigins] = useState<OriginObject[]>([]);
  const [selectedOriginCode, setSelectedOriginCode] = useState<string>('META');

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch flow & chatbot data
  const loadFlow = useCallback(async () => {
    try {
      setLoading(true);
      const res = await automationApi.getFlow(flowId);
      const f = res.flow;
      const b = res.chatbot;

      setFlow(f);
      setFlowName(f.name || 'Untitled Flow');

      let parsedOrigin: OriginObject | null = null;
      if (b?.origin) {
        try {
          parsedOrigin = typeof b.origin === 'string' ? JSON.parse(b.origin) : b.origin;
        } catch {
          parsedOrigin = null;
        }
      }

      setChatbot(b || null);
      setOrigin(parsedOrigin);
      setStatus(b ? (b.active === 1 ? 'active' : 'inactive') : 'draft');

      const data = f.data || { nodes: [], edges: [] };
      setFlowData(data);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load flow');
      router.push('/dashboard/automation');
    } finally {
      setLoading(false);
    }
  }, [flowId, router]);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // Fetch available origins for activation
  useEffect(() => {
    automationApi
      .getOrigins()
      .then((list) => {
        setAvailableOrigins(list);
        if (list.length > 0) {
          setSelectedOriginCode(list[0].code === 'QR' ? list[0].data?.uniqueId || list[0].code : list[0].code);
        }
      })
      .catch(() => {});
  }, []);

  const handleCanvasChange = useCallback((updatedFlowData: FlowData) => {
    setFlowData(updatedFlowData);
    setHasUnsavedChanges(true);
  }, []);

  // Save Draft
  const handleSaveDraft = async () => {
    if (!flow) return;
    try {
      setIsSaving(true);
      await automationApi.saveFlow({
        name: flowName.trim() || 'Untitled Flow',
        flow_id: flow.flow_id,
        source: flow.source,
        data: flowData,
      });

      setHasUnsavedChanges(false);
      toast.success('Flow saved successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  };

  // Activate Automation
  const handleActivate = async () => {
    if (!flow) return;

    // Validate graph
    const validation = validateFlow(flowData, origin);
    if (!validation.isValid) {
      const firstError = validation.errors[0];
      toast.error(`Validation error: ${firstError.message}`);
      return;
    }

    // Save flow first to persist latest state
    try {
      setIsActivating(true);
      await automationApi.saveFlow({
        name: flowName.trim(),
        flow_id: flow.flow_id,
        source: flow.source,
        data: flowData,
      });

      // If chatbot is already mapped, just activate it
      if (chatbot) {
        await automationApi.toggleChatbotStatus(chatbot.id, true);
        setStatus('active');
        toast.success('Automation is now active!');
      } else {
        // Prompt connection selection
        setIsOriginModalOpen(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate automation');
    } finally {
      setIsActivating(false);
    }
  };

  // Submit Origin Binding
  const handleConfirmOriginActivation = async () => {
    if (!flow) return;

    const chosenOrigin = availableOrigins.find(
      (o) => o.code === selectedOriginCode || o.data?.uniqueId === selectedOriginCode
    );

    if (!chosenOrigin) {
      toast.error('Please select an active WhatsApp connection');
      return;
    }

    // Double check compatibility
    const validation = validateFlow(flowData, chosenOrigin);
    if (!validation.isValid) {
      toast.error(validation.errors[0].message);
      return;
    }

    try {
      setIsActivating(true);
      const res = await automationApi.activateChatbot({
        title: flowName.trim(),
        origin: chosenOrigin,
        flow: {
          id: flow.id,
          flow_id: flow.flow_id,
        },
      });

      if (res?.success) {
        toast.success('Chatbot activated on selected connection!');
        setIsOriginModalOpen(false);
        loadFlow();
      } else {
        toast.error(res?.msg || 'Could not activate chatbot');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Activation failed');
    } finally {
      setIsActivating(false);
    }
  };

  // Pause / Deactivate
  const handleDeactivate = async () => {
    if (!chatbot) return;
    try {
      setIsActivating(true);
      await automationApi.toggleChatbotStatus(chatbot.id, false);
      setStatus('inactive');
      toast.success('Chatbot has been paused');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to pause chatbot');
    } finally {
      setIsActivating(false);
    }
  };

  // Duplicate Flow
  const handleDuplicate = async () => {
    if (!flow) return;
    try {
      const res = await automationApi.duplicateFlow(flow.flow_id);
      toast.success('Flow duplicated');
      if (res?.flow_id) {
        router.push(`/dashboard/automation/${res.flow_id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate flow');
    }
  };

  // Delete Flow
  const handleDelete = async () => {
    if (!flow) return;
    try {
      await automationApi.deleteFlow(flow.id, chatbot?.id);
      toast.success('Flow deleted');
      router.push('/dashboard/automation');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete flow');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-card text-xs text-muted-foreground gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        <span>Loading Flow Builder...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Header */}
      <BuilderHeader
        name={flowName}
        onNameChange={(val) => {
          setFlowName(val);
          setHasUnsavedChanges(true);
        }}
        status={status}
        origin={origin}
        onSaveDraft={handleSaveDraft}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onDuplicate={handleDuplicate}
        onDelete={() => setIsDeleteModalOpen(true)}
        onViewRuns={() => setActiveTab((prev) => (prev === 'canvas' ? 'runs' : 'canvas'))}
        isSaving={isSaving}
        isActivating={isActivating}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main Builder Body: Flow Canvas or Sessions View */}
      {activeTab === 'canvas' ? (
        <FlowCanvas
          initialData={flowData}
          onChange={handleCanvasChange}
          origin={origin}
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-muted/10">
          <RunsViewer flowId={flowId} />
        </div>
      )}

      {/* Connection Origin Selection Modal for Activation */}
      <Dialog open={isOriginModalOpen} onOpenChange={setIsOriginModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-600" />
              <span>Connect WhatsApp & Activate</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select the active WhatsApp channel that will trigger this automation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Active WhatsApp Account</Label>
              <Select
                value={selectedOriginCode}
                onValueChange={(val) => {
                  if (val) setSelectedOriginCode(val);
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  {availableOrigins.map((orig, idx) => (
                    <SelectItem
                      key={idx}
                      value={orig.code === 'QR' ? orig.data?.uniqueId || orig.title : orig.code}
                      className="text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {orig.code === 'QR' ? (
                          <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Cloud className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        <span>{orig.title}</span>
                        <span className="text-[10px] text-muted-foreground">({orig.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOriginModalOpen(false)}
              disabled={isActivating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleConfirmOriginActivation}
              disabled={isActivating}
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isActivating ? 'Activating...' : 'Activate Flow'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Delete &quot;{flowName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              This will permanently delete this flow definition and unbind any active chatbot routing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
