'use client'

import { AnimatePresence, motion, type PanInfo, type Variants, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUp, Check, ChevronDown, Crown, Database, HelpCircle, Mail, MapPin, MessageCircle, MessageSquare, Phone, Play, Plus, Rocket, Settings, Sparkles, Star, Webhook, X, Zap } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'



// Glassmorphism Hero
function GlassmorphismHeroBlock() {
    return (
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-32">
            {/* Animated background gradient orbs */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute left-1/4 top-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-foreground/[0.03] blur-3xl" />
                <div
                    className="absolute bottom-1/4 right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-foreground/[0.03] blur-3xl"
                    style={{ animationDelay: "1s" }}
                />
            </div>

            <div className="mx-auto max-w-7xl space-y-10 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 text-sm font-medium text-foreground/70 backdrop-blur-xl transition-all duration-300 hover:border-border">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Introducing our new platform</span>
                </div>

                <h1 className="text-6xl font-bold leading-[0.9] tracking-tight md:text-8xl lg:text-9xl">
                    <span className="block">Build amazing</span>
                    <span className="mt-4 block">products</span>
                </h1>

                <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                    The complete platform for building modern applications. Fast, secure,
                    and scalable by default.
                </p>

                <div className="flex flex-col justify-center gap-4 pt-8 sm:flex-row">
                    <Button size="lg" className="group h-12 rounded-full px-8 text-base">
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="h-12 rounded-full px-8 text-base hover:bg-foreground/5"
                    >
                        View Demo
                    </Button>
                </div>
            </div>
        </section>
    );
}

// Feature Comparison Table
type PlanKey = "free" | "pro" | "enterprise";

const plans = [
    {
        key: "free" as PlanKey,
        name: "Free",
        popular: false,
        price: "$0",
        period: "/month",
        description: "Perfect for getting started",
        icon: Rocket,
        features: ["5 projects", "Basic components", "Community support"],
        cta: "Choose plan",
    },
    {
        key: "pro" as PlanKey,
        name: "Pro",
        popular: true,
        price: "$29",
        period: "/month",
        description: "Most popular for professionals",
        icon: Star,
        features: [
            "Unlimited projects",
            "Advanced animations",
            "Priority support",
            "API access",
        ],
        cta: "Get started",
    },
    {
        key: "enterprise" as PlanKey,
        name: "Enterprise",
        popular: false,
        price: "$99",
        period: "/month",
        description: "For large teams and organizations",
        icon: Crown,
        features: [
            "Everything in Pro",
            "Custom integrations",
            "Dedicated manager",
            "SLA support",
        ],
        cta: "Contact sales",
    },
];

const features: {
    category: string;
    items: { name: string; free: boolean; pro: boolean; enterprise: boolean }[];
}[] = [
        {
            category: "Core features",
            items: [
                { name: "Basic components", free: true, pro: true, enterprise: true },
                { name: "Advanced animations", free: false, pro: true, enterprise: true },
                { name: "Custom themes", free: false, pro: true, enterprise: true },
                { name: "Priority support", free: false, pro: false, enterprise: true },
            ],
        },
        {
            category: "Integrations",
            items: [
                { name: "API access", free: false, pro: true, enterprise: true },
                { name: "Webhooks", free: false, pro: false, enterprise: true },
                { name: "Custom integrations", free: false, pro: false, enterprise: true },
            ],
        },
        {
            category: "Support and limits",
            items: [
                { name: "5 projects", free: true, pro: false, enterprise: false },
                { name: "Unlimited projects", free: false, pro: true, enterprise: true },
                { name: "Team collaboration", free: false, pro: true, enterprise: true },
                { name: "Dedicated manager", free: false, pro: false, enterprise: true },
            ],
        },
    ];

/**
 * Availability is carried by an icon plus text, never by the icon alone — the
 * whole table is unreadable otherwise once you cannot see the glyph shapes.
 */
function Availability({ included }: { included: boolean }) {
    return (
        <>
            {included ? (
                <Check className="mx-auto size-5 text-foreground" aria-hidden />
            ) : (
                <X className="mx-auto size-5 text-muted-foreground" aria-hidden />
            )}
            <span className="sr-only">{included ? "Included" : "Not included"}</span>
        </>
    );
}

function FeatureComparisonBlock() {
    const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);
    const shouldReduceMotion = useReducedMotion();
    const tableId = useId();

    const reveal = (delay: number) =>
        shouldReduceMotion
            ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
            : {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.5, delay },
            };

    return (
        <section className="w-full bg-background px-4 py-16">
            <div className="mx-auto max-w-7xl">
                <motion.div {...reveal(0)} className="mb-12 text-center">
                    <Badge className="mb-4" variant="secondary">
                        <Zap className="mr-1 size-3" aria-hidden />
                        Compare plans
                    </Badge>
                    <h2 className="mb-4 text-balance text-4xl font-bold tracking-tight">
                        Choose the right plan for you
                    </h2>
                    <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
                        Compare features across all our plans and find the perfect fit for
                        your needs.
                    </p>
                </motion.div>

                {/* Pricing cards */}
                <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {plans.map((plan, index) => {
                        const Icon = plan.icon;
                        const isHovered = hoveredPlan === index;

                        return (
                            <motion.div
                                key={plan.name}
                                {...reveal(0.1 * index)}
                                onHoverStart={() => setHoveredPlan(index)}
                                onHoverEnd={() => setHoveredPlan(null)}
                                className="relative flex"
                            >
                                <Card
                                    className={cn(
                                        "group relative flex w-full flex-col overflow-hidden bg-card p-6 md:p-8",
                                        "transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                                        "motion-reduce:transition-none",
                                        plan.popular
                                            ? "border-foreground shadow-lg"
                                            : "border-border hover:border-foreground/40 hover:shadow-md"
                                    )}
                                >
                                    {plan.popular && (
                                        <div className="absolute right-0 top-0">
                                            <Badge className="gap-1 rounded-bl-lg rounded-tr-xl px-3 py-1">
                                                <Sparkles className="size-3" aria-hidden />
                                                Most popular
                                            </Badge>
                                        </div>
                                    )}

                                    <div className="mb-4 flex justify-center">
                                        <div className="rounded-2xl bg-muted p-3 text-foreground">
                                            <Icon className="size-8" strokeWidth={1.5} aria-hidden />
                                        </div>
                                    </div>

                                    <div className="mb-6 text-center">
                                        <h3 className="mb-2 text-2xl font-bold tracking-tight">
                                            {plan.name}
                                        </h3>
                                        <p className="text-pretty text-sm text-muted-foreground">
                                            {plan.description}
                                        </p>
                                    </div>

                                    <div className="mb-6 text-center">
                                        <span className="text-5xl font-bold tracking-tight tabular-nums">
                                            {plan.price}
                                        </span>
                                        <span className="ml-1 text-base text-muted-foreground">
                                            {plan.period}
                                        </span>
                                    </div>

                                    <ul className="mb-6 space-y-3">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2">
                                                <Check
                                                    className="mt-0.5 size-5 shrink-0 text-foreground"
                                                    aria-hidden
                                                />
                                                <span className="text-sm text-foreground">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        className="mt-auto w-full gap-2"
                                        variant={plan.popular ? "default" : "outline"}
                                        size="lg"
                                    >
                                        {plan.cta}
                                        <ArrowRight
                                            className={cn(
                                                "size-4 transition-transform duration-200",
                                                isHovered && "translate-x-0.5",
                                                "motion-reduce:transition-none motion-reduce:translate-x-0"
                                            )}
                                            aria-hidden
                                        />
                                    </Button>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/*
          A real table: without column headers the ticks below are three
          anonymous columns, and screen readers announce the row with no way to
          tell which plan each mark belongs to. The wrapper is focusable so the
          horizontal scroll is reachable by keyboard.
        */}
                <div
                    role="region"
                    aria-labelledby={`${tableId}-caption`}
                    tabIndex={0}
                    className="overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <table className="w-full min-w-[560px] border-collapse text-sm">
                        <caption id={`${tableId}-caption`} className="sr-only">
                            Feature availability across the Free, Pro and Enterprise plans
                        </caption>
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th
                                    scope="col"
                                    className="sticky left-0 z-10 bg-muted/50 p-4 text-left font-semibold"
                                >
                                    Feature
                                </th>
                                {plans.map((plan) => (
                                    <th
                                        key={plan.key}
                                        scope="col"
                                        className="p-4 text-center font-semibold"
                                    >
                                        {plan.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((category) => (
                                <Fragment key={category.category}>
                                    <tr className="border-b border-border">
                                        <th
                                            scope="colgroup"
                                            colSpan={plans.length + 1}
                                            className="bg-background p-4 text-left text-base font-semibold"
                                        >
                                            {category.category}
                                        </th>
                                    </tr>
                                    {category.items.map((item) => (
                                        <tr
                                            key={item.name}
                                            className="border-b border-border last:border-b-0"
                                        >
                                            <th
                                                scope="row"
                                                className="sticky left-0 z-10 bg-card p-4 text-left font-medium"
                                            >
                                                {item.name}
                                            </th>
                                            {plans.map((plan) => (
                                                <td key={plan.key} className="p-4 text-center">
                                                    <Availability included={item[plan.key]} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Kept outside the scroll container, so it is never pushed off-screen */}
                <motion.div {...reveal(0.4)} className="mt-12 text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                        Need a custom plan?
                    </p>
                    <Button variant="outline" size="lg">
                        Contact sales
                    </Button>
                </motion.div>
            </div>
        </section>
    );
}

// N8N Workflow Block
interface WorkflowNode {
    id: string;
    type: "trigger" | "action" | "condition";
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    position: { x: number; y: number };
}

interface WorkflowConnection {
    from: string;
    to: string;
}

// Constants
const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

const nodeTemplates: Omit<WorkflowNode, "id" | "position">[] = [
    {
        type: "trigger",
        title: "Webhook",
        description: "Receive data from external service",
        icon: Webhook,
        color: "emerald",
    },
    {
        type: "action",
        title: "Database Query",
        description: "Fetch user records",
        icon: Database,
        color: "blue",
    },
    {
        type: "condition",
        title: "Condition",
        description: "Check user status",
        icon: Settings,
        color: "amber",
    },
    {
        type: "action",
        title: "Send Email",
        description: "Notify user",
        icon: Mail,
        color: "purple",
    },
    {
        type: "action",
        title: "Log Event",
        description: "Record activity",
        icon: Zap,
        color: "indigo",
    },
];

const initialNodes: WorkflowNode[] = [
    {
        id: "node-1",
        type: "trigger",
        title: "Webhook",
        description: "Receive data from external service",
        icon: Webhook,
        color: "emerald",
        position: { x: 50, y: 100 },
    },
    {
        id: "node-2",
        type: "action",
        title: "Database Query",
        description: "Fetch user records",
        icon: Database,
        color: "blue",
        position: { x: 300, y: 100 },
    },
    {
        id: "node-3",
        type: "condition",
        title: "Condition",
        description: "Check user status",
        icon: Settings,
        color: "amber",
        position: { x: 550, y: 100 },
    },
];

const initialConnections: WorkflowConnection[] = [
    { from: "node-1", to: "node-2" },
    { from: "node-2", to: "node-3" },
];

const colorClasses: Record<string, string> = {
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
    blue: "border-blue-400/40 bg-blue-400/10 text-blue-400",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    purple: "border-purple-400/40 bg-purple-400/10 text-purple-400",
    indigo: "border-indigo-400/40 bg-indigo-400/10 text-indigo-400",
};

// Connection Line Component
function WorkflowConnectionLine({
    from,
    to,
    nodes,
}: {
    from: string;
    to: string;
    nodes: WorkflowNode[];
}) {
    const fromNode = nodes.find((n) => n.id === from);
    const toNode = nodes.find((n) => n.id === to);
    if (!fromNode || !toNode) return null;

    const startX = fromNode.position.x + NODE_WIDTH;
    const startY = fromNode.position.y + NODE_HEIGHT / 2;
    const endX = toNode.position.x;
    const endY = toNode.position.y + NODE_HEIGHT / 2;

    const cp1X = startX + (endX - startX) * 0.5;
    const cp2X = endX - (endX - startX) * 0.5;

    const path = `M${startX},${startY} C${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;

    return (
        <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="8,6"
            strokeLinecap="round"
            opacity={0.35}
            className="text-foreground"
        />
    );
}

// Main Component
function N8nWorkflowBlock() {
    const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
    const [connections, setConnections] =
        useState<WorkflowConnection[]>(initialConnections);
    const canvasRef = useRef<HTMLDivElement>(null);
    const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [contentSize, setContentSize] = useState(() => {
        const maxX = Math.max(
            ...initialNodes.map((n) => n.position.x + NODE_WIDTH)
        );
        const maxY = Math.max(
            ...initialNodes.map((n) => n.position.y + NODE_HEIGHT)
        );
        return { width: maxX + 50, height: maxY + 50 };
    });

    // Drag Handlers
    const handleDragStart = (nodeId: string) => {
        setDraggingNodeId(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
            dragStartPosition.current = { x: node.position.x, y: node.position.y };
        }
    };

    const handleDrag = (nodeId: string, { offset }: PanInfo) => {
        if (draggingNodeId !== nodeId || !dragStartPosition.current) return;

        const newX = dragStartPosition.current.x + offset.x;
        const newY = dragStartPosition.current.y + offset.y;

        const constrainedX = Math.max(0, newX);
        const constrainedY = Math.max(0, newY);

        flushSync(() => {
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === nodeId
                        ? { ...node, position: { x: constrainedX, y: constrainedY } }
                        : node
                )
            );
        });

        setContentSize((prev) => ({
            width: Math.max(prev.width, constrainedX + NODE_WIDTH + 50),
            height: Math.max(prev.height, constrainedY + NODE_HEIGHT + 50),
        }));
    };

    const handleDragEnd = () => {
        setDraggingNodeId(null);
        dragStartPosition.current = null;
    };

    // Add Node Handler
    const addNode = () => {
        const template =
            nodeTemplates[Math.floor(Math.random() * nodeTemplates.length)];
        const lastNode = nodes[nodes.length - 1];
        const newPosition = lastNode
            ? { x: lastNode.position.x + 250, y: lastNode.position.y }
            : { x: 50, y: 100 };

        const newNode: WorkflowNode = {
            id: `node-${Date.now()}`,
            ...template,
            position: newPosition,
        };

        flushSync(() => {
            setNodes((prev) => [...prev, newNode]);
            if (lastNode) {
                setConnections((prev) => [
                    ...prev,
                    { from: lastNode.id, to: newNode.id },
                ]);
            }
        });

        setContentSize((prev) => ({
            width: Math.max(prev.width, newPosition.x + NODE_WIDTH + 50),
            height: Math.max(prev.height, newPosition.y + NODE_HEIGHT + 50),
        }));

        // Scroll to new node
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.scrollTo({
                left: newPosition.x + NODE_WIDTH - canvas.clientWidth + 100,
                behavior: "smooth",
            });
        }
    };

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-background/60 backdrop-blur p-4 sm:p-6">
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className="rounded-full border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400"
                    >
                        Active
                    </Badge>
                    <span className="text-xs sm:text-sm uppercase tracking-[0.25em] text-foreground/50">
                        Workflow Builder
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addNode}
                    className="h-8 gap-2 rounded-lg text-xs uppercase tracking-[0.2em] text-foreground/70 hover:text-foreground"
                    aria-label="Add new node"
                >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Add Node</span>
                </Button>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className="relative h-[400px] w-full overflow-auto rounded-xl border border-border/30 bg-background/40 sm:h-[500px] md:h-[600px]"
                style={{ minHeight: "400px" }}
                role="region"
                aria-label="Workflow canvas"
                tabIndex={0}
            >
                {/* Content Wrapper */}
                <div
                    className="relative"
                    style={{
                        minWidth: contentSize.width,
                        minHeight: contentSize.height,
                    }}
                >
                    {/* SVG Connections */}
                    <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        width={contentSize.width}
                        height={contentSize.height}
                        style={{ overflow: "visible" }}
                        aria-hidden="true"
                    >
                        {connections.map((c) => (
                            <WorkflowConnectionLine
                                key={`${c.from}-${c.to}`}
                                from={c.from}
                                to={c.to}
                                nodes={nodes}
                            />
                        ))}
                    </svg>

                    {/* Nodes */}
                    {nodes.map((node) => {
                        const Icon = node.icon;
                        const isDragging = draggingNodeId === node.id;

                        return (
                            <motion.div
                                key={node.id}
                                drag
                                dragMomentum={false}
                                dragConstraints={{
                                    left: 0,
                                    top: 0,
                                    right: 100000,
                                    bottom: 100000,
                                }}
                                onDragStart={() => handleDragStart(node.id)}
                                onDrag={(_, info) => handleDrag(node.id, info)}
                                onDragEnd={handleDragEnd}
                                style={{
                                    x: node.position.x,
                                    y: node.position.y,
                                    width: NODE_WIDTH,
                                    transformOrigin: "0 0",
                                }}
                                className="absolute cursor-grab"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                whileHover={{ scale: 1.02 }}
                                whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                                aria-grabbed={isDragging}
                            >
                                <Card
                                    className={`group/node relative w-full overflow-hidden rounded-xl border ${colorClasses[node.color]} bg-background/70 p-3 backdrop-blur transition-all hover:shadow-lg ${isDragging ? "shadow-xl ring-2 ring-primary/50" : ""}`}
                                    role="article"
                                    aria-label={`${node.type} node: ${node.title}`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

                                    <div className="relative space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colorClasses[node.color]} bg-background/80 backdrop-blur`}
                                                aria-hidden="true"
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <Badge
                                                    variant="outline"
                                                    className="mb-0.5 rounded-full border-border/40 bg-background/80 px-1.5 py-0 text-[9px] uppercase tracking-[0.15em] text-foreground/60"
                                                >
                                                    {node.type}
                                                </Badge>
                                                <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">
                                                    {node.title}
                                                </h3>
                                            </div>
                                        </div>
                                        <p className="line-clamp-2 text-[10px] leading-relaxed text-foreground/70">
                                            {node.description}
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[10px] text-foreground/50">
                                            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                                            <span className="uppercase tracking-[0.1em]">
                                                Connected
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Stats */}
            <div
                className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/30 bg-background/40 px-4 py-2.5 backdrop-blur-sm"
                role="status"
                aria-live="polite"
            >
                <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/60">
                    <div className="flex items-center gap-2">
                        <div
                            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                            aria-hidden="true"
                        />
                        <span className="uppercase tracking-[0.15em]">
                            {nodes.length} {nodes.length === 1 ? "Node" : "Nodes"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                            aria-hidden="true"
                        />
                        <span className="uppercase tracking-[0.15em]">
                            {connections.length}{" "}
                            {connections.length === 1 ? "Connection" : "Connections"}
                        </span>
                    </div>
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                    Drag nodes to reposition
                </p>
            </div>
        </div>
    );
}

// New Hero Section
function NewHeroSection() {
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.3,
            },
        },
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" },
        },
    };

    const floatingVariants: Variants = {
        animate: {
            y: [0, -10, 0],
            transition: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
            },
        },
    };

    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 px-4 py-20 md:py-32 w-full">
            <div className="mx-auto max-w-7xl">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative z-10 text-center"
                >
                    <motion.div variants={itemVariants} className="mb-6">
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                            <Sparkles className="h-4 w-4" />
                            Welcome to the Future
                        </span>
                    </motion.div>

                    <motion.h1
                        variants={itemVariants}
                        className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl"
                    >
                        Transform Your Business
                        <br />
                        <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            With Innovation
                        </span>
                    </motion.h1>

                    <motion.p
                        variants={itemVariants}
                        className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl"
                    >
                        We help businesses grow faster with cutting-edge solutions and
                        exceptional service. Join thousands of satisfied customers.
                    </motion.p>

                    <motion.div
                        variants={itemVariants}
                        className="flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                        <Button size="lg" className="group gap-2">
                            Get Started
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                        <Button size="lg" variant="outline" className="group gap-2">
                            <Play className="h-4 w-4" />
                            Watch Demo
                        </Button>
                    </motion.div>

                    <motion.div
                        variants={floatingVariants}
                        animate="animate"
                        className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground"
                    >
                        <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">10K+</div>
                            <div>Happy Customers</div>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">500+</div>
                            <div>Projects Completed</div>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">99%</div>
                            <div>Satisfaction Rate</div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}

// Glowy Waves Hero
type Point = {
    x: number;
    y: number;
};

interface WaveConfig {
    offset: number;
    amplitude: number;
    frequency: number;
    color: string;
    opacity: number;
}

const highlightPills = [
    "Immersive visuals",
    "Responsive motion",
    "GPU friendly",
] as const;

const heroStats: { label: string; value: string }[] = [
    { label: "Live installations", value: "320+" },
    { label: "Latency", value: "8ms" },
    { label: "Teams onboarded", value: "120+" },
];

const containerVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, staggerChildren: 0.12 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" },
    },
};

const statsVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.08 },
    },
};

function GlowyWavesHero() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mouseRef = useRef<Point>({ x: 0, y: 0 });
    const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        let animationId: number;
        let time = 0;

        const computeThemeColors = () => {
            const rootStyles = getComputedStyle(document.documentElement);

            // Helper to convert any CSS color to a Canvas-compatible format
            const resolveColor = (variables: string[], alpha = 1) => {
                // Create a temporary element to get computed color
                const tempEl = document.createElement("div");
                tempEl.style.position = "absolute";
                tempEl.style.visibility = "hidden";
                tempEl.style.width = "1px";
                tempEl.style.height = "1px";
                document.body.appendChild(tempEl);

                let color = `rgba(255, 255, 255, ${alpha})`;

                for (const variable of variables) {
                    const value = rootStyles.getPropertyValue(variable).trim();
                    if (value) {
                        // Try to set the background color using the CSS variable
                        tempEl.style.backgroundColor = `var(${variable})`;
                        const computedColor = getComputedStyle(tempEl).backgroundColor;

                        if (computedColor && computedColor !== "rgba(0, 0, 0, 0)") {
                            // Convert RGB to RGBA with alpha if needed
                            if (alpha < 1) {
                                const rgbMatch = computedColor.match(
                                    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
                                );
                                if (rgbMatch) {
                                    color = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
                                } else {
                                    color = computedColor;
                                }
                            } else {
                                color = computedColor;
                            }
                            break;
                        }
                    }
                }

                document.body.removeChild(tempEl);
                return color;
            };

            return {
                backgroundTop: resolveColor(["--background"], 1),
                backgroundBottom: resolveColor(["--muted", "--background"], 0.95),
                wavePalette: [
                    {
                        offset: 0,
                        amplitude: 70,
                        frequency: 0.003,
                        color: resolveColor(["--primary"], 0.8),
                        opacity: 0.45,
                    },
                    {
                        offset: Math.PI / 2,
                        amplitude: 90,
                        frequency: 0.0026,
                        color: resolveColor(["--accent", "--primary"], 0.7),
                        opacity: 0.35,
                    },
                    {
                        offset: Math.PI,
                        amplitude: 60,
                        frequency: 0.0034,
                        color: resolveColor(["--secondary", "--foreground"], 0.65),
                        opacity: 0.3,
                    },
                    {
                        offset: Math.PI * 1.5,
                        amplitude: 80,
                        frequency: 0.0022,
                        color: resolveColor(["--primary-foreground", "--foreground"], 0.25),
                        opacity: 0.25,
                    },
                    {
                        offset: Math.PI * 2,
                        amplitude: 55,
                        frequency: 0.004,
                        color: resolveColor(["--foreground"], 0.2),
                        opacity: 0.2,
                    },
                ] satisfies WaveConfig[],
            };
        };

        let themeColors = computeThemeColors();

        const handleThemeMutation = () => {
            themeColors = computeThemeColors();
        };

        const observer = new MutationObserver(handleThemeMutation);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "data-theme"],
        });

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        const mouseInfluence = prefersReducedMotion ? 10 : 70;
        const influenceRadius = prefersReducedMotion ? 160 : 320;
        const smoothing = prefersReducedMotion ? 0.04 : 0.1;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const recenterMouse = () => {
            const centerPoint = { x: canvas.width / 2, y: canvas.height / 2 };
            mouseRef.current = centerPoint;
            targetMouseRef.current = centerPoint;
        };

        const handleResize = () => {
            resizeCanvas();
            recenterMouse();
        };

        const handleMouseMove = (event: MouseEvent) => {
            targetMouseRef.current = { x: event.clientX, y: event.clientY };
        };

        const handleMouseLeave = () => {
            recenterMouse();
        };

        resizeCanvas();
        recenterMouse();

        window.addEventListener("resize", handleResize);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseleave", handleMouseLeave);

        const drawWave = (wave: WaveConfig) => {
            ctx.save();
            ctx.beginPath();

            for (let x = 0; x <= canvas.width; x += 4) {
                const dx = x - mouseRef.current.x;
                const dy = canvas.height / 2 - mouseRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const influence = Math.max(0, 1 - distance / influenceRadius);
                const mouseEffect =
                    influence *
                    mouseInfluence *
                    Math.sin(time * 0.001 + x * 0.01 + wave.offset);

                const y =
                    canvas.height / 2 +
                    Math.sin(x * wave.frequency + time * 0.002 + wave.offset) *
                    wave.amplitude +
                    Math.sin(x * wave.frequency * 0.4 + time * 0.003) *
                    (wave.amplitude * 0.45) +
                    mouseEffect;

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.lineWidth = 2.5;
            ctx.strokeStyle = wave.color;
            ctx.globalAlpha = wave.opacity;
            ctx.shadowBlur = 35;
            ctx.shadowColor = wave.color;
            ctx.stroke();

            ctx.restore();
        };

        const animate = () => {
            time += 1;

            mouseRef.current.x +=
                (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
            mouseRef.current.y +=
                (targetMouseRef.current.y - mouseRef.current.y) * smoothing;

            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, themeColors.backgroundTop);
            gradient.addColorStop(1, themeColors.backgroundBottom);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            themeColors.wavePalette.forEach(drawWave);

            animationId = window.requestAnimationFrame(animate);
        };

        animationId = window.requestAnimationFrame(animate);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseleave", handleMouseLeave);
            cancelAnimationFrame(animationId);
            observer.disconnect();
        };
    }, []);

    return (
        <section
            className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden bg-background"
            role="region"
            aria-label="Glowing waves hero section"
        >
            <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
            />

            <div className="absolute inset-0 -z-10 pointer-events-none">
                <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[140px] dark:bg-foreground/[0.06]" />
                <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-foreground/[0.025] blur-[120px] dark:bg-foreground/[0.05]" />
                <div className="absolute top-1/2 left-1/4 h-[400px] w-[400px] rounded-full bg-primary/[0.02] blur-[150px] dark:bg-primary/[0.05]" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center md:px-8 lg:px-12">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-full"
                >
                    <motion.div
                        variants={itemVariants}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-foreground/70 dark:border-border/60 dark:bg-background/70 dark:text-foreground/80"
                    >
                        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                        Reactive canvas hero
                    </motion.div>

                    <motion.h1
                        variants={itemVariants}
                        className="mb-6 text-4xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl"
                    >
                        Welcome to immersive{" "}
                        <span className="bg-gradient-to-r from-primary via-primary/60 to-foreground/80 bg-clip-text text-transparent">
                            realtime playgrounds
                        </span>
                    </motion.h1>

                    <motion.p
                        variants={itemVariants}
                        className="mx-auto mb-10 max-w-3xl text-lg text-foreground/70 md:text-2xl"
                    >
                        Build living surfaces that respond to every interaction. Craft
                        cinematic hero moments, responsive canvases, and luminous gradients
                        without leaving your design system.
                    </motion.p>

                    <motion.div
                        variants={itemVariants}
                        className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                        <Button
                            size="lg"
                            className="group gap-2 rounded-full px-8 text-base uppercase tracking-[0.2em]"
                        >
                            Launch Studio
                            <ArrowRight
                                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                                aria-hidden="true"
                            />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="rounded-full border-border/40 bg-background/60 px-8 text-base text-foreground/80 backdrop-blur transition-all hover:border-border/60 hover:bg-background/70 dark:border-border/50 dark:bg-background/40 dark:text-foreground/70 dark:hover:border-border/70 dark:hover:bg-background/50"
                        >
                            Explore stories
                        </Button>
                    </motion.div>

                    <motion.ul
                        variants={itemVariants}
                        className="mb-12 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-foreground/70 dark:text-foreground/80"
                    >
                        {highlightPills.map((pill) => (
                            <li
                                key={pill}
                                className="rounded-full border border-border/40 bg-background/60 px-4 py-2 backdrop-blur dark:border-border/60 dark:bg-background/70"
                            >
                                {pill}
                            </li>
                        ))}
                    </motion.ul>

                    <motion.div
                        variants={statsVariants}
                        className="grid gap-4 rounded-2xl border border-border/30 bg-background/60 p-6 backdrop-blur-sm dark:border-border/60 dark:bg-background/70 sm:grid-cols-3"
                    >
                        {heroStats.map((stat) => (
                            <motion.div
                                key={stat.label}
                                variants={itemVariants}
                                className="space-y-1"
                            >
                                <div className="text-xs uppercase tracking-[0.3em] text-foreground/50 dark:text-foreground/60">
                                    {stat.label}
                                </div>
                                <div className="text-3xl font-semibold text-foreground">
                                    {stat.value}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}

// CTA Block
function CTABlock() {
    return (
        <section>
            <div className="mx-auto max-w-5xl">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <Card className="relative overflow-hidden border-border bg-card">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

                        <div className="relative z-10 p-8 text-center md:p-12 lg:p-16">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                            >
                                <h2 className="mb-6 text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
                                    Ready to Start Your Project?
                                </h2>

                                <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
                                    Let&apos;s turn your ideas into reality. Get in touch today and
                                    let&apos;s discuss how we can work together to build something
                                    amazing.
                                </p>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.4, duration: 0.6 }}
                                    className="flex flex-col justify-center gap-4 sm:flex-row"
                                >
                                    <Button size="lg" className="group w-full gap-2 sm:w-auto">
                                        Start a Conversation
                                        <MessageSquare className="h-4 w-4 transition-transform group-hover:scale-110" />
                                    </Button>

                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="group w-full gap-2 sm:w-auto"
                                    >
                                        View My Work
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.6, duration: 0.6 }}
                                    className="mt-8 flex flex-col items-center justify-center gap-4 text-sm text-muted-foreground sm:flex-row sm:gap-8"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                                        <span>Available for new projects</span>
                                    </div>
                                    <div>
                                        <span>Response time: &lt;24 hours</span>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </section>
    );
}


// FAQ Accordion
const faqs = [
    {
        question: "What is included in the free plan?",
        answer:
            "The free plan includes access to basic components, up to 5 projects, community support, and regular updates. It's perfect for individuals and small projects to get started.",
    },
    {
        question: "Can I upgrade or downgrade my plan at any time?",
        answer:
            "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly. No hassle, no hidden fees.",
    },
    {
        question: "What payment methods do you accept?",
        answer:
            "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise accounts. All payments are processed securely through Stripe.",
    },
    {
        question: "Is there a setup fee or contract required?",
        answer:
            "No setup fees and no long-term contracts required. You can cancel anytime. For enterprise plans, we offer flexible terms based on your needs.",
    },
    {
        question: "Do you offer refunds?",
        answer:
            "Yes, we offer a 30-day money-back guarantee. If you're not satisfied with our service within the first 30 days, we'll provide a full refund, no questions asked.",
    },
    {
        question: "How does customer support work?",
        answer:
            "Free plans get community support through our forum. Pro plans include email support with 24-hour response time. Enterprise plans get priority support with dedicated account managers and SLA guarantees.",
    },
];

function FAQAccordionBlock() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section className="w-full bg-gradient-to-b from-background to-muted/30 px-4 py-16 md:py-24">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-12 text-center md:mb-16"
                >
                    <Badge className="mb-4" variant="secondary">
                        <HelpCircle className="mr-1 h-3 w-3" />
                        FAQ
                    </Badge>
                    <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                        Frequently Asked Questions
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
                        Have a question? We&apos;ve got answers. If you don&apos;t find what you&apos;re
                        looking for, feel free to contact us.
                    </p>
                </motion.div>

                {/* FAQ Accordion */}
                <div className="space-y-4">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1, duration: 0.4 }}
                            >
                                <Card className="overflow-hidden border-border/50 bg-card transition-all hover:border-primary/50 hover:shadow-md">
                                    <motion.button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className="flex w-full items-center justify-between p-4 text-left md:p-6"
                                        whileHover={{
                                            backgroundColor: "rgba(var(--primary), 0.03)",
                                        }}
                                    >
                                        <span className="pr-4 text-base font-semibold md:text-lg">
                                            {faq.question}
                                        </span>
                                        <motion.div
                                            animate={{ rotate: isOpen ? 180 : 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="flex-shrink-0"
                                        >
                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        </motion.div>
                                    </motion.button>

                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="border-t border-border/50 p-4 md:p-6">
                                                    <motion.p
                                                        initial={{ y: -10 }}
                                                        animate={{ y: 0 }}
                                                        className="text-sm text-muted-foreground md:text-base"
                                                    >
                                                        {faq.answer}
                                                    </motion.p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 text-center md:mt-16"
                >
                    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/30 p-6 md:p-8">
                        <MessageCircle className="mx-auto mb-4 h-12 w-12 text-primary" />
                        <h3 className="mb-2 text-xl font-bold md:text-2xl">
                            Still have questions?
                        </h3>
                        <p className="mb-6 text-sm text-muted-foreground md:text-base">
                            Our team is here to help. Get in touch and we&apos;ll respond as soon
                            as possible.
                        </p>
                        <div className="flex flex-col justify-center gap-3 sm:flex-row">
                            <Button size="lg">Contact Support</Button>
                            <Button size="lg" variant="outline">
                                View Documentation
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </section>
    );
}

// Footer Block
const footerLinks = [
    {
        title: "Product",
        links: ["Features", "Pricing", "Documentation", "API Reference"],
    },
    {
        title: "Company",
        links: ["About Us", "Careers", "Blog", "Press Kit"],
    },
    {
        title: "Resources",
        links: ["Community", "Help Center", "Partners", "Status"],
    },
    {
        title: "Legal",
        links: ["Privacy", "Terms", "Cookie Policy", "Licenses"],
    },
];


function FooterBlock() {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const shouldReduceMotion = useReducedMotion();

    return (
        <footer
            aria-labelledby="footer-heading"
            className="relative w-full overflow-hidden border-t border-border bg-card/90 backdrop-blur-xl"
        >
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <motion.div
                    className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-[160px]"
                    animate={
                        shouldReduceMotion
                            ? undefined
                            : { opacity: [0.2, 0.45, 0.2], scale: [0.9, 1.05, 0.95] }
                    }
                    transition={
                        shouldReduceMotion
                            ? undefined
                            : { duration: 12, repeat: Infinity, ease: "easeInOut" }
                    }
                />
                <motion.div
                    className="absolute -bottom-36 right-0 h-96 w-96 rounded-full bg-[hsl(var(--primary)_/_0.18)] blur-[200px]"
                    animate={
                        shouldReduceMotion
                            ? undefined
                            : { opacity: [0.18, 0.4, 0.18], rotate: [0, 25, 0] }
                    }
                    transition={
                        shouldReduceMotion
                            ? undefined
                            : { duration: 16, repeat: Infinity, ease: "linear" }
                    }
                />
            </div>
            <h2 id="footer-heading" className="sr-only">
                Site footer
            </h2>
            {/* Main Footer Content */}
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-6">
                    {/* Brand & Newsletter */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="lg:col-span-2"
                    >
                        <motion.div
                            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                            transition={{ duration: 0.2 }}
                            className="mb-4 inline-flex items-center gap-3"
                        >
                            <Card className="rounded-2xl border border-border/60 bg-card/80 px-3 py-1 text-xs uppercase tracking-[0.32em] text-muted-foreground shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)]">
                                Brand
                            </Card>
                            <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                            >
                                Since 2018
                            </Badge>
                        </motion.div>
                        <p className="mb-4 max-w-md text-sm text-muted-foreground">
                            Building amazing products with modern technologies. Join us on our
                            journey to create better user experiences.
                        </p>

                        {/* Newsletter */}
                        <div className="mb-4">
                            <p className="mb-2 text-sm font-medium text-foreground">
                                Subscribe to our newsletter
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="h-10 rounded-xl border-border/60 bg-background/60 backdrop-blur placeholder:text-muted-foreground"
                                />
                                <Button
                                    size="sm"
                                    className="h-10 rounded-xl border border-border/60 bg-primary/90 px-4 text-primary-foreground shadow-[0_12px_35px_-20px_rgba(15,23,42,0.7)] hover:bg-primary"
                                    aria-label="Subscribe"
                                >
                                    <Mail className="h-4 w-4" aria-hidden />
                                </Button>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <motion.div
                                whileHover={shouldReduceMotion ? undefined : { x: 5 }}
                                className="flex items-center gap-2"
                            >
                                <MapPin className="h-4 w-4" aria-hidden />
                                <span>123 Business St, City 12345</span>
                            </motion.div>
                            <motion.div
                                whileHover={shouldReduceMotion ? undefined : { x: 5 }}
                                className="flex items-center gap-2"
                            >
                                <Phone className="h-4 w-4" aria-hidden />
                                <span>+1 (555) 123-4567</span>
                            </motion.div>
                            <motion.div
                                whileHover={shouldReduceMotion ? undefined : { x: 5 }}
                                className="flex items-center gap-2"
                            >
                                <Mail className="h-4 w-4" aria-hidden />
                                <span>hello@example.com</span>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Footer Links */}
                    {footerLinks.map((section, sectionIndex) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: sectionIndex * 0.1 }}
                        >
                            <h4 className="mb-4 text-sm font-semibold text-foreground/90">
                                {section.title}
                            </h4>
                            <ul className="space-y-2">
                                {section.links.map((link, linkIndex) => (
                                    <motion.li
                                        key={link}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: linkIndex * 0.05 }}
                                    >
                                        <motion.a
                                            href="#"
                                            whileHover={
                                                shouldReduceMotion
                                                    ? undefined
                                                    : { x: 5, color: "hsl(var(--primary))" }
                                            }
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {link}
                                        </motion.a>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                {/* Divider */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="my-10 h-px bg-border/70"
                />

                {/* Bottom Bar */}
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                    {/* Social Links */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-2"
                    >
                        {/* {socialLinks.map((social, index) => (
                            <motion.div
                                key={social.label}
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                    delay: 0.6 + index * 0.05,
                                }}
                            >
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full border border-border/60 bg-white/5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                    aria-label={social.label}
                                >
                                    <motion.div
                                        transition={{ duration: shouldReduceMotion ? 0.25 : 0.3 }}
                                    >
                                        <social.icon className="h-4 w-4" aria-hidden />
                                    </motion.div>
                                </Button>
                            </motion.div>
                        ))} */}
                    </motion.div>

                    {/* Copyright */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                        <span>© 2024 Brand. All rights reserved.</span>
                        <Badge variant="outline" className="text-xs">
                            v1.0.0
                        </Badge>
                    </motion.div>

                    {/* Scroll to Top */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.7 }}
                    >
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-full border-border/60"
                            onClick={scrollToTop}
                        >
                            <motion.div
                                animate={shouldReduceMotion ? undefined : { y: [0, -3, 0] }}
                                transition={
                                    shouldReduceMotion
                                        ? undefined
                                        : { repeat: Infinity, duration: 1.5 }
                                }
                            >
                                <ArrowUp className="h-4 w-4" aria-hidden />
                            </motion.div>
                        </Button>
                    </motion.div>
                </div>
            </div>
        </footer>
    );
}

export default function LandingPage() {
    return (
        <div className="container mx-auto px-4 py-12 md:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-12">
                {/* Glassmorphism Hero */}
                <section>
                    <GlassmorphismHeroBlock />
                </section>

                {/* Feature Comparison Table */}
                <section>
                    <FeatureComparisonBlock />
                </section>

                {/* N8N Workflow Block */}
                <section>
                    <N8nWorkflowBlock />
                </section>

                {/* New Hero Section */}
                <section>
                    <NewHeroSection />
                </section>

                {/* Glowy Waves Hero */}
                <section>
                    <GlowyWavesHero />
                </section>

                {/* CTA Block */}
                <section>
                    <CTABlock />
                </section>

                {/* Glassmorphism Hero */}
                <section>
                    <GlassmorphismHeroBlock />
                </section>

                {/* FAQ Accordion */}
                <section>
                    <FAQAccordionBlock />
                </section>

                {/* Footer Block */}
                <section>
                    <FooterBlock />
                </section>
            </div>
        </div>
    )
}
