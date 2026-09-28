'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { InitialNode } from './custom-nodes/initial-node';
import { MessageNode } from './custom-nodes/message-node';
import { ConditionNode } from './custom-nodes/condition-node';
import { DelayNode } from './custom-nodes/delay-node';
import { WebhookNode } from './custom-nodes/webhook-node';
import { AiNode } from './custom-nodes/ai-node';
import { GenericActionNode } from './custom-nodes/generic-action-node';
import { NodePalette, PaletteItem } from './node-palette';
import { NodeConfigSheet } from './node-config-sheet';
import { FlowData, FlowNode, FlowEdge, OriginObject } from '@/types/automation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ListFilter,
  Network,
  Plus,
  Settings2,
  Trash2,
  Copy,
} from 'lucide-react';

interface FlowCanvasProps {
  initialData: FlowData;
  onChange: (flowData: FlowData) => void;
  origin?: OriginObject | null;
}

export function FlowCanvas({ initialData, onChange, origin }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Registered custom node components
  const nodeTypes = useMemo(
    () => ({
      INITIAL: InitialNode,
      SEND_MESSAGE: MessageNode,
      CONDITION: ConditionNode,
      DELAY: DelayNode,
      MAKE_REQUEST: WebhookNode,
      AI_TRANSFER: AiNode,
      RESPONSE_SAVER: GenericActionNode,
      SET_CHAT_LABEL: GenericActionNode,
      PHONEBOOK_MANAGER: GenericActionNode,
      DISABLE_AUTOREPLY: GenericActionNode,
      RESET: GenericActionNode,
      SEND_WA_TEMPLATE: GenericActionNode,
      SEND_WA_FORM: GenericActionNode,
    }),
    []
  );

  const [nodes, setNodes] = useState<Node[]>(() => {
    const list = initialData?.nodes || [];
    // Ensure initialNode exists if empty
    if (list.length === 0) {
      return [
        {
          id: 'initialNode',
          type: 'INITIAL',
          position: { x: 100, y: 300 },
          data: {
            whPhonePath: '',
            sourceSlug: origin?.code || 'wa_chatbot',
            sourceTitle: 'Customer sends WhatsApp message',
          },
        },
      ];
    }
    return list as Node[];
  });

  const [edges, setEdges] = useState<Edge[]>(() => {
    return (initialData?.edges || []).map((e) => ({
      ...e,
      type: e.type || 'smoothstep',
      animated: e.animated ?? false,
    })) as Edge[];
  });

  // Keep refs to always have access to latest state in callbacks without stale closures
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Selected node for configuration sheet
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<'steps' | 'canvas'>('steps');
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const getNodeMeta = useCallback((type?: string) => {
    switch (type) {
      case 'INITIAL':
        return { label: 'Initial Trigger', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      case 'SEND_MESSAGE':
        return { label: 'Send Message', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
      case 'CONDITION':
        return { label: 'Branch Condition', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'DELAY':
        return { label: 'Delay Timer', badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' };
      case 'MAKE_REQUEST':
        return { label: 'Webhook Request', badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
      case 'AI_TRANSFER':
        return { label: 'AI Agent Transfer', badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
      default:
        return { label: type?.replace(/_/g, ' ') || 'Action Node', badgeClass: 'bg-muted text-muted-foreground border-border' };
    }
  }, []);

  // Sync state to parent on explicit user modifications
  const notifyChange = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      onChange({
        nodes: newNodes as FlowNode[],
        edges: newEdges as FlowEdge[],
      });
    },
    [onChange]
  );

  // Internal React Flow changes (selection, dragging position, dimensions measurement)
  // MUST NOT trigger parent setState or call side effects during render
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // When node drag finishes, notify parent of new layout position
  const onNodeDragStop = useCallback(() => {
    notifyChange(nodesRef.current, edgesRef.current);
  }, [notifyChange]);

  // When nodes are deleted via canvas (e.g. keyboard delete)
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const remainingNodes = nodesRef.current.filter((n) => !deleted.some((d) => d.id === n.id));
      const remainingEdges = edgesRef.current.filter(
        (e) => !deleted.some((d) => d.id === e.source || d.id === e.target)
      );
      setNodes(remainingNodes);
      setEdges(remainingEdges);
      notifyChange(remainingNodes, remainingEdges);
      if (selectedNode && deleted.some((d) => d.id === selectedNode.id)) {
        setIsConfigOpen(false);
        setSelectedNode(null);
      }
    },
    [selectedNode, notifyChange]
  );

  // When edges are deleted via canvas
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const remainingEdges = edgesRef.current.filter((e) => !deleted.some((d) => d.id === e.id));
      setEdges(remainingEdges);
      notifyChange(nodesRef.current, remainingEdges);
    },
    [notifyChange]
  );

  // Connect handle to handle
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
      };
      const updatedEdges = addEdge(newEdge, edgesRef.current);
      setEdges(updatedEdges);
      notifyChange(nodesRef.current, updatedEdges);
    },
    [notifyChange]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as FlowNode);
    setIsConfigOpen(true);
  }, []);

  // Update node data from sheet
  const handleUpdateNode = useCallback(
    (nodeId: string, updatedData: Record<string, any>) => {
      const updatedNodes = nodesRef.current.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: updatedData,
          };
        }
        return n;
      });
      setNodes(updatedNodes);
      notifyChange(updatedNodes, edgesRef.current);
      setSelectedNode((prev) => (prev?.id === nodeId ? ({ ...prev, data: updatedData } as FlowNode) : prev));
    },
    [notifyChange]
  );

  // Delete node explicitly
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const updatedNodes = nodesRef.current.filter((n) => n.id !== nodeId);
      const updatedEdges = edgesRef.current.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      notifyChange(updatedNodes, updatedEdges);
      setIsConfigOpen(false);
      setSelectedNode(null);
    },
    [notifyChange]
  );

  // Duplicate node
  const handleDuplicateNode = useCallback(
    (nodeToDup: FlowNode) => {
      const newId = `${nodeToDup.type.toLowerCase()}_${Date.now()}`;
      const newNode: Node = {
        id: newId,
        type: nodeToDup.type,
        position: {
          x: (nodeToDup.position?.x ?? 200) + 50,
          y: (nodeToDup.position?.y ?? 200) + 50,
        },
        data: JSON.parse(JSON.stringify(nodeToDup.data || {})),
      };

      const updatedNodes = [...nodesRef.current, newNode];
      setNodes(updatedNodes);
      notifyChange(updatedNodes, edgesRef.current);
      setSelectedNode(newNode as FlowNode);
      setIsConfigOpen(true);
    },
    [notifyChange]
  );

  // Add node from Palette
  const handleAddNodeFromPalette = useCallback(
    (item: PaletteItem, position?: { x: number; y: number }) => {
      const newId = `${item.type.toLowerCase()}_${Date.now()}`;
      const defaultPos = position || {
        x: 400 + Math.random() * 80,
        y: 250 + Math.random() * 80,
      };

      const newNode: Node = {
        id: newId,
        type: item.type,
        position: defaultPos,
        data: JSON.parse(JSON.stringify(item.defaultData)),
      };

      const updatedNodes = [...nodesRef.current, newNode];
      setNodes(updatedNodes);
      notifyChange(updatedNodes, edgesRef.current);
      setSelectedNode(newNode as FlowNode);
      setIsConfigOpen(true);
      setMobilePaletteOpen(false);
    },
    [notifyChange]
  );

  // Handle Drag & Drop over canvas
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow-item');
      if (!raw) return;

      try {
        const item: PaletteItem = JSON.parse(raw);
        if (!reactFlowWrapper.current) return;

        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = {
          x: e.clientX - bounds.left - 100,
          y: e.clientY - bounds.top - 40,
        };

        handleAddNodeFromPalette(item, position);
      } catch (err) {
        console.error('Failed to parse dropped palette item:', err);
      }
    },
    [handleAddNodeFromPalette]
  );

  const isQrConnection = origin?.code === 'QR';

  return (
    <div className="flex-1 flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden relative">
      {/* Mobile Mode Switcher (< md) */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 border-b bg-card shrink-0 gap-2">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMobileTab('steps')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors touch-manipulation ${
              mobileTab === 'steps'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Steps ({nodes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('canvas')}
            className={`py-1 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors touch-manipulation ${
              mobileTab === 'canvas'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Canvas</span>
          </button>
        </div>

        <Button
          size="sm"
          onClick={() => setMobilePaletteOpen(true)}
          className="h-8 text-xs gap-1.5 px-3 touch-manipulation font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Step</span>
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Step List Mode (< md) */}
        {mobileTab === 'steps' && (
          <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Automation Flow Steps</h3>
                <p className="text-xs text-muted-foreground">
                  Tap any step to edit its WhatsApp message content, conditions, and parameters.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {nodes.map((node, index) => {
                const meta = getNodeMeta(node.type);
                const outEdges = edges.filter((e) => e.source === node.id);
                const isInitial = node.type === 'INITIAL';

                return (
                  <div
                    key={node.id}
                    className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-2.5"
                  >
                    {(() => {
                      const d = (node.data || {}) as Record<string, any>;
                      const nodeTitle = String(d.title || d.name || (isInitial ? 'Trigger: Incoming WhatsApp' : node.type));
                      const nodeBody = d.body ? String(d.body) : null;
                      return (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                                {index + 1}
                              </span>
                              <div>
                                <Badge variant="outline" className={`text-[10px] font-medium ${meta.badgeClass}`}>
                                  {meta.label}
                                </Badge>
                                <h4 className="text-xs font-semibold text-foreground mt-0.5">
                                  {nodeTitle}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDuplicateNode(node as FlowNode)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
                                title="Duplicate step"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {!isInitial && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteNode(node.id)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 touch-manipulation"
                                  title="Delete step"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Preview of step content if available */}
                          {Boolean(nodeBody) && (
                            <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg line-clamp-2 font-mono">
                              {nodeBody}
                            </p>
                          )}
                        </>
                      );
                    })()}

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                      <span>{outEdges.length} next {outEdges.length === 1 ? 'branch' : 'branches'}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedNode(node as FlowNode);
                          setIsConfigOpen(true);
                        }}
                        className="h-7 text-xs gap-1 text-primary hover:text-primary font-semibold touch-manipulation"
                      >
                        <Settings2 className="h-3 w-3" />
                        <span>Configure Step</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setMobilePaletteOpen(true)}
              className="w-full h-10 border-dashed text-xs gap-2 text-primary font-medium touch-manipulation mt-4"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Step to Flow</span>
            </Button>
          </div>
        )}

        {/* Visual Graph Canvas (Hidden on mobile when in 'steps' tab, always visible on md+) */}
        <div
          ref={reactFlowWrapper}
          className={`flex-1 h-full w-full relative bg-muted/10 ${
            mobileTab === 'steps' ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Collapsible Left Palette (Desktop only) */}
          <div
            className={`hidden md:block absolute left-0 top-0 bottom-0 transition-all duration-300 ease-in-out z-10 ${
              isPaletteOpen ? 'w-64 md:w-72' : 'w-0'
            } overflow-hidden`}
          >
            <NodePalette onAddNode={handleAddNodeFromPalette} isQrConnection={isQrConnection} />
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            className="bg-dot-grid"
          >
            <Background color="var(--border)" gap={16} size={1} />
            <Controls className="!bg-card !border-border !shadow-sm !rounded-lg" />
            <MiniMap
              className="!bg-card !border-border !shadow-sm !rounded-lg !hidden sm:!block"
              nodeColor={(n) => {
                if (n.type === 'INITIAL') return '#10b981';
                if (n.type === 'CONDITION') return '#f59e0b';
                if (n.type === 'AI_TRANSFER') return '#8b5cf6';
                if (n.type === 'DELAY') return '#f97316';
                return '#3b82f6';
              }}
            />

            {/* Toggle Palette Button (Desktop) */}
            <Panel position="top-left" className="m-2 hidden md:block">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 shadow-xs bg-card"
                onClick={() => setIsPaletteOpen((prev) => !prev)}
              >
                {isPaletteOpen ? (
                  <>
                    <PanelLeftClose className="h-3.5 w-3.5" />
                    <span className="text-xs">Hide Palette</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                    <span className="text-xs">Show Palette</span>
                  </>
                )}
              </Button>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Mobile Palette Bottom Sheet */}
      <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <SheetContent side="bottom" className="p-0 max-h-[80vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-sm font-bold">Add Step to Automation</SheetTitle>
          </SheetHeader>
          <div className="p-2">
            <NodePalette
              onAddNode={(item) => {
                handleAddNodeFromPalette(item);
                setMobilePaletteOpen(false);
              }}
              isQrConnection={isQrConnection}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Side Node Config Sheet */}
      <NodeConfigSheet
        node={selectedNode}
        isOpen={isConfigOpen}
        onClose={() => {
          setIsConfigOpen(false);
          setSelectedNode(null);
        }}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onDuplicateNode={handleDuplicateNode}
        isQrConnection={isQrConnection}
      />
    </div>
  );
}
