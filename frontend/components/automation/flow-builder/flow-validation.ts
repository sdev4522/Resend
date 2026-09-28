import { FlowData, FlowNode, OriginObject } from '@/types/automation';

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates the flow graph structure and node configurations.
 */
export function validateFlow(
  flowData: FlowData,
  origin?: OriginObject | null,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const nodes = flowData?.nodes || [];
  const edges = flowData?.edges || [];

  // 1. Initial trigger node check
  const initialNode = nodes.find((n) => n.id === 'initialNode' || n.type === 'INITIAL');
  if (!initialNode) {
    errors.push({
      message: 'Flow must have a Trigger (Initial) node to start.',
      severity: 'error',
    });
  }

  // 2. Minimum nodes check
  if (nodes.length < 2) {
    errors.push({
      message: 'Flow must have at least 2 connected nodes to activate.',
      severity: 'error',
    });
  }

  // 3. Edges existence check
  if (edges.length === 0 && nodes.length > 1) {
    errors.push({
      message: 'Nodes are not connected. Please connect the trigger to your steps.',
      severity: 'error',
    });
  }

  // 4. Edge reference integrity
  const nodeMap = new Map<string, FlowNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  edges.forEach((edge, idx) => {
    if (!nodeMap.has(edge.source)) {
      errors.push({
        message: `Edge #${idx + 1} connects from a deleted or missing node (${edge.source}).`,
        severity: 'error',
      });
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({
        message: `Edge #${idx + 1} connects to a deleted or missing node (${edge.target}).`,
        severity: 'error',
      });
    }
  });

  // 5. Backend Constraint: Last connected node cannot have moveToNextNode === true
  const targetNodeIds = new Set(edges.map((e) => e.target));
  const startingNodes = nodes.filter((n) => !targetNodeIds.has(n.id));

  let lastConnectedNode: FlowNode | null = null;
  const visited = new Set<string>();

  const traverse = (currentNodeId: string) => {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    if (outgoingEdges.length === 0) {
      const node = nodeMap.get(currentNodeId);
      if (node && (!lastConnectedNode || (node.position?.x ?? 0) > (lastConnectedNode.position?.x ?? 0))) {
        lastConnectedNode = node;
      }
      return;
    }

    outgoingEdges.forEach((e) => traverse(e.target));
  };

  startingNodes.forEach((n) => traverse(n.id));

  if (lastConnectedNode && (lastConnectedNode as FlowNode).data?.moveToNextNode) {
    errors.push({
      nodeId: (lastConnectedNode as FlowNode).id,
      message: `The terminal node "${(lastConnectedNode as FlowNode).type}" cannot have "Continue Automatically" enabled without a following node.`,
      severity: 'error',
    });
  }

  // 6. Individual node property validation & Provider compatibility
  const isQrOrNonMeta = origin && origin.code !== 'META';

  nodes.forEach((node) => {
    switch (node.type) {
      case 'SEND_MESSAGE': {
        const msgType = node.data?.type?.type || 'text';

        // Check QR vs Meta interactive compatibility
        if (isQrOrNonMeta && (msgType === 'button' || msgType === 'list')) {
          errors.push({
            nodeId: node.id,
            message: `Interactive ${msgType} messages are not supported on WhatsApp QR accounts. Use plain text or switch to Meta Cloud API.`,
            severity: 'error',
          });
        }

        if (msgType === 'text') {
          const body = node.data?.content?.text?.body || '';
          if (!body.trim()) {
            errors.push({
              nodeId: node.id,
              field: 'text.body',
              message: 'Text message cannot be empty.',
              severity: 'error',
            });
          }
        } else if (msgType === 'image' || msgType === 'video' || msgType === 'audio' || msgType === 'document') {
          const link = node.data?.content?.[msgType]?.link || '';
          if (!link.trim()) {
            errors.push({
              nodeId: node.id,
              field: `${msgType}.link`,
              message: `Media link or upload is required for ${msgType} node.`,
              severity: 'error',
            });
          }
        } else if (msgType === 'button') {
          const bodyText = node.data?.content?.interactive?.body?.text || '';
          const buttons = node.data?.content?.interactive?.action?.buttons || [];
          if (!bodyText.trim()) {
            errors.push({
              nodeId: node.id,
              field: 'button.body',
              message: 'Button message text cannot be empty.',
              severity: 'error',
            });
          }
          if (buttons.length === 0) {
            errors.push({
              nodeId: node.id,
              field: 'button.buttons',
              message: 'Add at least one button (up to 3).',
              severity: 'error',
            });
          }
        } else if (msgType === 'list') {
          const bodyText = node.data?.content?.interactive?.body?.text || '';
          const sections = node.data?.content?.interactive?.action?.sections || [];
          if (!bodyText.trim()) {
            errors.push({
              nodeId: node.id,
              field: 'list.body',
              message: 'List message body text cannot be empty.',
              severity: 'error',
            });
          }
          if (sections.length === 0 || sections.every((s: any) => !s.rows || s.rows.length === 0)) {
            errors.push({
              nodeId: node.id,
              field: 'list.sections',
              message: 'List must have at least one section with one row option.',
              severity: 'error',
            });
          }
        }
        break;
      }

      case 'CONDITION': {
        const conditions = node.data?.conditions || [];
        if (conditions.length === 0) {
          errors.push({
            nodeId: node.id,
            message: 'Condition node must have at least one match rule.',
            severity: 'error',
          });
        }
        break;
      }

      case 'DELAY': {
        const seconds = Number(node.data?.seconds);
        if (!seconds || seconds < 1) {
          errors.push({
            nodeId: node.id,
            field: 'seconds',
            message: 'Delay duration must be at least 1 second.',
            severity: 'error',
          });
        }
        break;
      }

      case 'MAKE_REQUEST': {
        const url = node.data?.url || '';
        if (!url.trim()) {
          errors.push({
            nodeId: node.id,
            field: 'url',
            message: 'Webhook URL is required.',
            severity: 'error',
          });
        }
        break;
      }

      case 'SEND_WA_TEMPLATE': {
        if (isQrOrNonMeta) {
          errors.push({
            nodeId: node.id,
            message: 'WhatsApp Meta Templates are only supported on Meta Cloud API accounts, not QR accounts.',
            severity: 'error',
          });
        }
        break;
      }

      default:
        break;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
