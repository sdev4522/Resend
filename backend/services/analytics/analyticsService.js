const { query } = require("../../database/dbpromise");

/**
 * Builds SQL condition and parameters for date range filtering.
 * Supported ranges: 'today', 'yesterday', '7d', '30d', '90d', 'custom'
 *
 * @param {Object} queryParams - { range, startDate, endDate }
 * @param {string} dateColumn - Name of the date column, default 'createdAt'
 * @returns {{ conditionSql: string, params: Array<any>, range: string, startDate?: string, endDate?: string }}
 */
function buildDateRangeFilter(queryParams = {}, dateColumn = "createdAt") {
  const { range = "30d", startDate, endDate } = queryParams;
  let conditionSql = "";
  let params = [];

  if (range === "today") {
    conditionSql = `${dateColumn} >= CURDATE()`;
  } else if (range === "yesterday") {
    conditionSql = `${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${dateColumn} < CURDATE()`;
  } else if (range === "7d") {
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  } else if (range === "30d") {
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  } else if (range === "90d") {
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
  } else if (range === "custom" && startDate && endDate) {
    const cleanStart = String(startDate).slice(0, 10);
    const cleanEnd = String(endDate).slice(0, 10);
    conditionSql = `${dateColumn} >= ? AND ${dateColumn} <= ?`;
    params = [`${cleanStart} 00:00:00`, `${cleanEnd} 23:59:59`];
  } else {
    // Default fallback: 30 days
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }

  return { conditionSql, params, range, startDate, endDate };
}

/**
 * Resolves and validates WhatsApp instance ownership for tenant isolation.
 *
 * @param {string} uid - Authenticated user workspace ID
 * @param {string|number} instanceId - Selected instance identifier or 'all'
 * @returns {Promise<{ isScoped: boolean, type?: 'qr'|'meta', number?: string, uniqueId?: string, metaId?: string, error?: string }>}
 */
async function resolveInstanceScope(uid, instanceId) {
  if (!instanceId || instanceId === "all") {
    return { isScoped: false };
  }

  const isNumeric = !isNaN(instanceId) && /^\d+$/.test(String(instanceId));
  const numericId = isNumeric ? parseInt(instanceId, 10) : -1;

  // 1. Check QR instance ownership
  const [qrInst] = await query(
    `SELECT id, uniqueId, number, title, status FROM instance WHERE uid = ? AND (uniqueId = ? OR id = ? OR number = ?) LIMIT 1`,
    [uid, instanceId, numericId, instanceId]
  );

  if (qrInst) {
    return {
      isScoped: true,
      type: "qr",
      number: qrInst.number || null,
      uniqueId: qrInst.uniqueId,
      title: qrInst.title,
      status: qrInst.status,
    };
  }

  // 2. Check Meta API ownership
  const [metaInst] = await query(
    `SELECT id, business_phone_number_id, waba_id FROM meta_api WHERE uid = ? AND (business_phone_number_id = ? OR id = ? OR waba_id = ?) LIMIT 1`,
    [uid, instanceId, numericId, instanceId]
  );

  if (metaInst) {
    return {
      isScoped: true,
      type: "meta",
      metaId: metaInst.business_phone_number_id,
      wabaId: metaInst.waba_id,
      title: "Meta Cloud API",
      status: "ACTIVE",
    };
  }

  // Unauthorized instance access attempt
  const error = new Error("Unauthorized or invalid WhatsApp instance selected");
  error.statusCode = 403;
  throw error;
}

/**
 * Aggregates real user-level workspace analytics from the database.
 * Strictly scopes all queries to the authenticated uid.
 *
 * @param {string} uid - Authenticated user ID
 * @param {Object} filters - { range, startDate, endDate, instanceId }
 */
async function getUserWorkspaceAnalytics(uid, filters = {}) {
  const { conditionSql: dateSql, params: dateParams, range, startDate, endDate } = buildDateRangeFilter(filters, "createdAt");
  const instanceScope = await resolveInstanceScope(uid, filters.instanceId);

  // 1. Build message filtering conditions
  const msgConditions = ["uid = ?", dateSql];
  const msgParams = [uid, ...dateParams];

  if (instanceScope.isScoped) {
    if (instanceScope.type === "qr") {
      if (instanceScope.number) {
        const cleanNum = instanceScope.number.replace(/[^0-9]/g, "");
        msgConditions.push("(chat_id LIKE ? OR origin = 'qr')");
        msgParams.push(`${cleanNum}_%`);
      } else {
        msgConditions.push("1 = 0"); // Unpaired instance has no messages
      }
    } else if (instanceScope.type === "meta") {
      msgConditions.push("origin = 'meta'");
    }
  }

  const msgWhere = msgConditions.join(" AND ");

  // Message aggregate counts
  const [msgSummary] = await query(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incoming,
      COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoing,
      COUNT(CASE WHEN status IN ('delivered', 'read') THEN 1 END) as delivered,
      COUNT(CASE WHEN status = 'read' THEN 1 END) as readCount,
      COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) as failed
    FROM beta_conversation 
    WHERE ${msgWhere}`,
    msgParams
  );

  // Message daily time series
  const msgTimeSeries = await query(
    `SELECT 
      DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
      COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incoming,
      COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoing,
      COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) as failed,
      COUNT(*) as total
    FROM beta_conversation
    WHERE ${msgWhere}
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC`,
    msgParams
  );

  // 2. Conversations Summary
  const chatConditions = ["uid = ?"];
  const chatParams = [uid];

  if (instanceScope.isScoped) {
    if (instanceScope.type === "qr") {
      if (instanceScope.number) {
        const cleanNum = instanceScope.number.replace(/[^0-9]/g, "");
        chatConditions.push("(origin = 'qr' AND (chat_id LIKE ? OR origin_instance_id LIKE ?))");
        chatParams.push(`${cleanNum}_%`, `%"${cleanNum}%`);
      } else {
        chatConditions.push("1 = 0");
      }
    } else if (instanceScope.type === "meta") {
      const busId = instanceScope.metaId || "";
      chatConditions.push("(origin = 'meta' AND (origin_instance_id LIKE ? OR chat_id LIKE 'meta_%'))");
      chatParams.push(`%"${busId}%`);
    }
  }

  const chatWhere = chatConditions.join(" AND ");

  const [chatSummary] = await query(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN ${dateSql.replace(/createdAt/g, "updatedAt")} THEN 1 END) as activeInPeriod,
      COALESCE(SUM(unread_count), 0) as totalUnread
    FROM beta_chats
    WHERE ${chatWhere}`,
    [...chatParams, ...dateParams]
  );

  const chatsByOrigin = await query(
    `SELECT 
      COALESCE(NULLIF(origin, ''), 'other') as origin,
      COUNT(*) as count
    FROM beta_chats
    WHERE ${chatWhere}
    GROUP BY COALESCE(NULLIF(origin, ''), 'other')
    ORDER BY count DESC`,
    chatParams
  );

  // 3. Contacts Metrics
  const [contactSummary] = await query(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN ${dateSql} THEN 1 END) as newInPeriod
    FROM contact 
    WHERE uid = ?`,
    [uid, ...dateParams]
  );

  const contactsByPhonebook = await query(
    `SELECT 
      COALESCE(NULLIF(phonebook_name, ''), 'Default') as phonebook,
      COUNT(*) as count
    FROM contact 
    WHERE uid = ?
    GROUP BY COALESCE(NULLIF(phonebook_name, ''), 'Default')
    ORDER BY count DESC
    LIMIT 8`,
    [uid]
  );

  // 4. WhatsApp Connections (Available instances for user)
  const instancesList = await query(
    `SELECT id, uniqueId, title, number, status, createdAt FROM instance WHERE uid = ? ORDER BY id DESC`,
    [uid]
  );

  const [metaRow] = await query(
    `SELECT id, business_phone_number_id, waba_id, createdAt FROM meta_api WHERE uid = ? LIMIT 1`,
    [uid]
  );

  const activeQr = instancesList.filter((i) => i.status === "ACTIVE").length;
  const disconnectedQr = instancesList.filter((i) => i.status !== "ACTIVE").length;
  const metaCount = metaRow ? 1 : 0;

  // 5. Campaign Metrics
  const [campaignSummary] = await query(
    `SELECT 
      COUNT(*) as totalCampaigns,
      COALESCE(SUM(sent_count), 0) as sent,
      COALESCE(SUM(delivered_count), 0) as delivered,
      COALESCE(SUM(read_count), 0) as readCount,
      COALESCE(SUM(failed_count), 0) as failed
    FROM beta_campaign 
    WHERE uid = ? AND ${dateSql}`,
    [uid, ...dateParams]
  );

  const recentCampaigns = await query(
    `SELECT id, campaign_id, title, status, total_contacts, sent_count, delivered_count, read_count, failed_count, createdAt
    FROM beta_campaign 
    WHERE uid = ? 
    ORDER BY id DESC 
    LIMIT 5`,
    [uid]
  );

  // 6. Automations & Chatbots
  const [flowSummary] = await query(
    `SELECT COUNT(*) as totalFlows FROM beta_flows WHERE uid = ?`,
    [uid]
  );

  const [chatbotSummary] = await query(
    `SELECT 
      COUNT(*) as totalBots,
      COUNT(CASE WHEN active = 1 THEN 1 END) as activeBots,
      COUNT(CASE WHEN active = 0 THEN 1 END) as inactiveBots
    FROM beta_chatbot WHERE uid = ?`,
    [uid]
  );

  // 7. Live Subscription & Usage Limits
  const [userRow] = await query(
    `SELECT plan, plan_expire FROM user WHERE uid = ?`,
    [uid]
  );

  let planData = {};
  try {
    planData = userRow?.plan ? (typeof userRow.plan === "string" ? JSON.parse(userRow.plan) : userRow.plan) : {};
  } catch (_) {}

  const contactLimit = parseInt(planData.contact_limit, 10) || 0;
  const qrLimit = parseInt(planData.qr_account, 10) || 0;
  const chatbotAllowed = planData.allow_chatbot === 1 || planData.allow_chatbot === "1";

  return {
    range,
    startDate,
    endDate,
    selectedInstance: instanceScope.isScoped
      ? {
          id: filters.instanceId,
          type: instanceScope.type,
          title: instanceScope.title || instanceScope.number || "Selected Instance",
          number: instanceScope.number,
        }
      : null,
    availableInstances: [
      { id: "all", title: "All Instances", number: "Unified", type: "all" },
      ...instancesList.map((i) => ({
        id: i.uniqueId || String(i.id),
        title: i.title || (i.number ? `WhatsApp (${i.number})` : "QR Account"),
        number: i.number || "Unpaired",
        status: i.status,
        type: "qr",
      })),
      ...(metaRow
        ? [
            {
              id: metaRow.business_phone_number_id,
              title: "Meta Cloud API",
              number: metaRow.business_phone_number_id,
              status: "ACTIVE",
              type: "meta",
            },
          ]
        : []),
    ],
    messages: {
      total: Number(msgSummary?.total || 0),
      incoming: Number(msgSummary?.incoming || 0),
      outgoing: Number(msgSummary?.outgoing || 0),
      delivered: Number(msgSummary?.delivered || 0),
      read: Number(msgSummary?.readCount || 0),
      failed: Number(msgSummary?.failed || 0),
      timeSeries: msgTimeSeries || [],
    },
    conversations: {
      total: Number(chatSummary?.total || 0),
      activeInPeriod: Number(chatSummary?.activeInPeriod || 0),
      totalUnread: Number(chatSummary?.totalUnread || 0),
      byOrigin: chatsByOrigin || [],
    },
    contacts: {
      total: Number(contactSummary?.total || 0),
      newInPeriod: Number(contactSummary?.newInPeriod || 0),
      byPhonebook: contactsByPhonebook || [],
    },
    whatsapp: {
      total: instancesList.length + metaCount,
      qr: instancesList.length,
      meta: metaCount,
      active: activeQr + metaCount,
      disconnected: disconnectedQr,
    },
    campaigns: {
      total: Number(campaignSummary?.totalCampaigns || 0),
      sent: Number(campaignSummary?.sent || 0),
      delivered: Number(campaignSummary?.delivered || 0),
      read: Number(campaignSummary?.readCount || 0),
      failed: Number(campaignSummary?.failed || 0),
      recent: recentCampaigns || [],
    },
    automations: {
      totalFlows: Number(flowSummary?.totalFlows || 0),
      totalChatbots: Number(chatbotSummary?.totalBots || 0),
      activeChatbots: Number(chatbotSummary?.activeBots || 0),
      inactiveChatbots: Number(chatbotSummary?.inactiveBots || 0),
    },
    usage: {
      contacts: {
        used: Number(contactSummary?.total || 0),
        limit: contactLimit,
        remaining: Math.max(0, contactLimit - Number(contactSummary?.total || 0)),
      },
      qrAccounts: {
        used: instancesList.length,
        limit: qrLimit,
        remaining: Math.max(0, qrLimit - instancesList.length),
      },
      chatbot: {
        allowed: chatbotAllowed,
        activeCount: Number(chatbotSummary?.activeBots || 0),
      },
      planTitle: planData.title || "Free Tier",
      planExpire: userRow?.plan_expire || null,
    },
  };
}

/**
 * Aggregates platform-wide analytics for administrators (God-Eye mode).
 * Requires server-side admin authentication.
 *
 * @param {Object} filters - { range, startDate, endDate }
 */
async function getAdminPlatformAnalytics(filters = {}) {
  const { conditionSql: dateSql, params: dateParams, range, startDate, endDate } = buildDateRangeFilter(filters, "createdAt");

  // 1. Platform User Metrics
  const [userStats] = await query(
    `SELECT 
      COUNT(*) as totalUsers,
      COUNT(CASE WHEN is_blocked = 0 OR is_blocked IS NULL THEN 1 END) as activeUsers,
      COUNT(CASE WHEN is_blocked = 1 THEN 1 END) as blockedUsers,
      COUNT(CASE WHEN ${dateSql} THEN 1 END) as newUsersInPeriod
    FROM user`,
    dateParams
  );

  const userGrowthTimeSeries = await query(
    `SELECT 
      DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
      COUNT(*) as count
    FROM user
    WHERE ${dateSql}
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC`,
    dateParams
  );

  const planDistribution = await query(
    `SELECT 
      COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(plan, '$.title'))), ''), 'Free / Trial') as planTitle,
      COUNT(*) as count
    FROM user
    GROUP BY planTitle
    ORDER BY count DESC`
  );

  // 2. Platform Revenue & Orders (orders table)
  const [revenueStats] = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN status IN ('SUCCESS', 'PAID') THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0) as totalRevenue,
      COALESCE(SUM(CASE WHEN status IN ('SUCCESS', 'PAID') AND ${dateSql} THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0) as periodRevenue,
      COUNT(*) as totalOrders,
      COUNT(CASE WHEN status IN ('SUCCESS', 'PAID') THEN 1 END) as successfulOrders,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pendingOrders,
      COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failedOrders
    FROM orders`,
    dateParams
  );

  const revenueTimeSeries = await query(
    `SELECT 
      DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
      COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) as revenue,
      COUNT(*) as orderCount
    FROM orders
    WHERE status IN ('SUCCESS', 'PAID') AND ${dateSql}
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC`,
    dateParams
  );

  // 3. Platform WhatsApp Accounts
  const [instanceStats] = await query(
    `SELECT 
      COUNT(*) as totalInstances,
      COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeInstances,
      COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) as disconnectedInstances
    FROM instance`
  );

  const [metaStats] = await query(
    `SELECT COUNT(*) as metaCount FROM meta_api`
  );

  // 4. Platform Throughput & Activity
  const [throughputStats] = await query(
    `SELECT 
      COUNT(*) as totalMessagesInPeriod,
      COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incomingInPeriod,
      COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoingInPeriod,
      COUNT(CASE WHEN status IN ('delivered', 'read') THEN 1 END) as deliveredInPeriod,
      COUNT(CASE WHEN status = 'read' THEN 1 END) as readInPeriod,
      COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) as failedInPeriod
    FROM beta_conversation
    WHERE ${dateSql}`,
    dateParams
  );

  const throughputTimeSeries = await query(
    `SELECT 
      DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
      COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incoming,
      COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoing,
      COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) as failed,
      COUNT(*) as total
    FROM beta_conversation
    WHERE ${dateSql}
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC`,
    dateParams
  );

  const [campaignStats] = await query(
    `SELECT 
      COUNT(*) as totalCampaigns,
      COALESCE(SUM(sent_count), 0) as totalSent,
      COALESCE(SUM(delivered_count), 0) as totalDelivered,
      COALESCE(SUM(read_count), 0) as totalRead,
      COALESCE(SUM(failed_count), 0) as totalFailed
    FROM beta_campaign
    WHERE ${dateSql}`,
    dateParams
  );

  const [flowStats] = await query(
    `SELECT COUNT(*) as totalFlows FROM beta_flows`
  );

  const [chatbotStats] = await query(
    `SELECT 
      COUNT(*) as totalBots,
      COUNT(CASE WHEN active = 1 THEN 1 END) as activeBots
    FROM beta_chatbot`
  );

  // 5. Recent Admin Audit Logs
  let auditLogs = [];
  try {
    auditLogs = await query(
      `SELECT id, admin_uid, action, target_type, target_id, details, ip_address, created_at
      FROM admin_audit_logs
      ORDER BY id DESC
      LIMIT 10`
    );
  } catch (_) {}

  // 6. Top Workspaces approaching limits or highest usage
  const topWorkspaces = await query(
    `SELECT 
      u.uid, u.name, u.email,
      COUNT(c.id) as contactCount
    FROM user u
    LEFT JOIN contact c ON u.uid = c.uid
    GROUP BY u.uid, u.name, u.email
    ORDER BY contactCount DESC
    LIMIT 5`
  );

  return {
    range,
    startDate,
    endDate,
    users: {
      total: Number(userStats?.totalUsers || 0),
      active: Number(userStats?.activeUsers || 0),
      blocked: Number(userStats?.blockedUsers || 0),
      newInPeriod: Number(userStats?.newUsersInPeriod || 0),
      growthTimeSeries: userGrowthTimeSeries || [],
      planDistribution: planDistribution || [],
    },
    revenue: {
      totalRevenue: parseFloat(revenueStats?.totalRevenue || 0),
      periodRevenue: parseFloat(revenueStats?.periodRevenue || 0),
      totalOrders: Number(revenueStats?.totalOrders || 0),
      successfulOrders: Number(revenueStats?.successfulOrders || 0),
      pendingOrders: Number(revenueStats?.pendingOrders || 0),
      failedOrders: Number(revenueStats?.failedOrders || 0),
      timeSeries: revenueTimeSeries || [],
    },
    whatsapp: {
      total: Number(instanceStats?.totalInstances || 0) + Number(metaStats?.metaCount || 0),
      qr: Number(instanceStats?.totalInstances || 0),
      meta: Number(metaStats?.metaCount || 0),
      active: Number(instanceStats?.activeInstances || 0) + Number(metaStats?.metaCount || 0),
      disconnected: Number(instanceStats?.disconnectedInstances || 0),
    },
    throughput: {
      messagesInPeriod: Number(throughputStats?.totalMessagesInPeriod || 0),
      incomingInPeriod: Number(throughputStats?.incomingInPeriod || 0),
      outgoingInPeriod: Number(throughputStats?.outgoingInPeriod || 0),
      deliveredInPeriod: Number(throughputStats?.deliveredInPeriod || 0),
      readInPeriod: Number(throughputStats?.readInPeriod || 0),
      failedInPeriod: Number(throughputStats?.failedInPeriod || 0),
      campaignsInPeriod: Number(campaignStats?.totalCampaigns || 0),
      campaignDispatches: Number(campaignStats?.totalSent || 0),
      campaignDelivered: Number(campaignStats?.totalDelivered || 0),
      campaignRead: Number(campaignStats?.totalRead || 0),
      campaignFailed: Number(campaignStats?.totalFailed || 0),
      totalFlows: Number(flowStats?.totalFlows || 0),
      activeChatbots: Number(chatbotStats?.activeBots || 0),
      timeSeries: throughputTimeSeries || [],
    },
    topWorkspaces: topWorkspaces || [],
    auditLogs: auditLogs || [],
  };
}

module.exports = {
  buildDateRangeFilter,
  resolveInstanceScope,
  getUserWorkspaceAnalytics,
  getAdminPlatformAnalytics,
};
