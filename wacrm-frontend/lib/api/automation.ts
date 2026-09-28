import { api } from './client';
import {
  AutomationItem,
  BackendFlow,
  BackendChatbot,
  FlowData,
  FlowSession,
  OriginObject,
} from '@/types/automation';

export const automationApi = {
  /**
   * Fetches unified list of automations by merging beta_flows and beta_chatbot records
   */
  async getAutomations(): Promise<AutomationItem[]> {
    try {
      const [flowsRes, chatbotsRes] = await Promise.all([
        api.get<{ success: boolean; data: BackendFlow[] }>('/chat_flow/get_flows_beta?type=all'),
        api.get<{ success: boolean; data: BackendChatbot[] }>('/chatbot/get_beta_chatbots?type=all'),
      ]);

      const flows: BackendFlow[] = (flowsRes?.success && Array.isArray(flowsRes?.data)) ? flowsRes.data : [];
      const chatbots: BackendChatbot[] = (chatbotsRes?.success && Array.isArray(chatbotsRes?.data)) ? chatbotsRes.data : [];

      // Map chatbots by flow_id
      const chatbotMap = new Map<string, BackendChatbot>();
      for (const bot of chatbots) {
        if (bot.flow_id) {
          chatbotMap.set(bot.flow_id, bot);
        }
      }

      const automations: AutomationItem[] = flows.map((flow) => {
        const associatedBot = chatbotMap.get(flow.flow_id);
        let origin: OriginObject | undefined = undefined;

        if (associatedBot?.origin) {
          try {
            origin = typeof associatedBot.origin === 'string'
              ? JSON.parse(associatedBot.origin)
              : associatedBot.origin;
          } catch {
            origin = undefined;
          }
        }

        let status: AutomationItem['status'] = 'draft';
        if (associatedBot) {
          status = associatedBot.active === 1 ? 'active' : 'inactive';
        }

        return {
          id: flow.id,
          flow_id: flow.flow_id,
          name: flow.name,
          source: flow.source,
          flowData: flow.data || { nodes: [], edges: [] },
          status,
          chatbotId: associatedBot?.id,
          origin,
          originId: associatedBot?.origin_id,
          createdAt: flow.createdAt,
        };
      });

      return automations;
    } catch (error) {
      console.error('Failed to get automations:', error);
      throw error;
    }
  },

  /**
   * Fetch single flow by flow_id
   */
  async getFlow(flowId: string): Promise<{ flow: BackendFlow; chatbot?: BackendChatbot }> {
    const [flowRes, botRes] = await Promise.all([
      api.get<{ success: boolean; data: BackendFlow; msg?: string }>(`/chat_flow/get_flow_beta?flow_id=${flowId}`),
      api.get<{ success: boolean; data: BackendChatbot[]; msg?: string }>(`/chatbot/get_beta_chatbots?flow_id=${flowId}`).catch(() => null),
    ]);

    if (!flowRes?.success || !flowRes.data) {
      throw new Error(flowRes?.msg || 'Flow not found');
    }

    const chatbot = (botRes?.success && Array.isArray(botRes.data) && botRes.data.length > 0)
      ? botRes.data[0]
      : undefined;

    return {
      flow: flowRes.data,
      chatbot,
    };
  },

  /**
   * Save or update flow definition
   */
  async saveFlow(payload: {
    name: string;
    flow_id: string;
    data: FlowData;
    source: string;
  }): Promise<{ success: boolean; msg: string; flow_id: string }> {
    const res = await api.post<{ success?: boolean; msg?: string; flow_id?: string }>(
      '/chat_flow/insert_flow_beta',
      payload
    );
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to save flow');
    }
    return res as { success: boolean; msg: string; flow_id: string };
  },

  /**
   * Delete flow from database
   */
  async deleteFlow(id: number, chatbotId?: number): Promise<{ success: boolean; msg: string }> {
    if (chatbotId) {
      try {
        await api.post('/chatbot/del_beta_chatbot', { id: chatbotId });
      } catch (e) {
        console.warn('Failed to delete associated chatbot record:', e);
      }
    }
    return api.post('/chat_flow/del_flow_beta', { id });
  },

  /**
   * Duplicate existing flow
   */
  async duplicateFlow(flowId: string): Promise<{ success: boolean; msg: string; flow_id: string }> {
    return api.post('/chat_flow/duplicate_flow_beta', { flow_id: flowId });
  },

  /**
   * Fetch available origins (Meta Cloud API, QR active instances, etc.)
   */
  async getOrigins(): Promise<OriginObject[]> {
    const res = await api.get<{ success: boolean; data: OriginObject[] }>('/chat_flow/get_origians');
    return (res?.success && Array.isArray(res.data)) ? res.data : [];
  },

  /**
   * Activate automation by binding flow to origin via beta_chatbot
   */
  async activateChatbot(payload: {
    title: string;
    origin: OriginObject;
    flow: { id: number; flow_id: string };
  }): Promise<{ success: boolean; msg: string }> {
    return api.post('/chatbot/add_beta_chatbot', payload);
  },

  /**
   * Toggle active status of a chatbot
   */
  async toggleChatbotStatus(id: number, status: boolean): Promise<{ success: boolean; msg: string }> {
    return api.post('/chatbot/change_beta_bot_status', { id, status });
  },

  /**
   * Delete chatbot binding
   */
  async deleteChatbot(id: number): Promise<{ success: boolean; msg: string }> {
    return api.post('/chatbot/del_beta_chatbot', { id });
  },

  /**
   * Fetch active runtime sessions for a flow
   */
  async getFlowSessions(flowId: string): Promise<FlowSession[]> {
    const res = await api.post<{ success: boolean; data: FlowSession[] }>('/chat_flow/get_beta_flow_sessions', {
      flow_id: flowId,
    });
    return (res?.success && Array.isArray(res.data)) ? res.data : [];
  },

  /**
   * Delete a runtime session
   */
  async deleteFlowSession(id: number): Promise<{ success: boolean; msg: string }> {
    return api.post('/chat_flow/del_flow_sess', { id });
  },

  /**
   * Reset disableChat status on a session
   */
  async resetDisableChat(id: number): Promise<{ success: boolean; msg: string }> {
    return api.post('/chat_flow/reset_dc_sess', { id });
  },

  /**
   * Upload media file for image/video/audio/document nodes
   */
  async uploadMedia(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/proxy/user/return_media_url', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!data.success || !data.url) {
      throw new Error(data.msg || 'Media upload failed');
    }
    return data.url;
  },
};
