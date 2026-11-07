const { prisma } = require("../../database/prisma");
const { Prisma } = require("@prisma/client");
const { plain, whereStr } = require("../../database/prismaHelpers");

/**
 * Builds the date-range filter for analytics queries.
 * Supported ranges: 'today', 'yesterday', '7d', '30d', '90d', 'custom'
 *
 * Returns the same fields as before (conditionSql/params are kept for backward compatibility)
 * plus `range` as a Prisma filter object ({ gte, lt/lte }) used by the ORM queries, and
 * `sql(column)` producing a parameterised Prisma.sql fragment for the time-series queries.
 *
 * @param {Object} queryParams - { range, startDate, endDate }
 * @param {string} dateColumn - Name of the date column, default 'createdAt'
 */
function buildDateRangeFilter(queryParams = {}, dateColumn = "createdAt") {
  const { range = "30d", startDate, endDate } = queryParams;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  let filter;
  let conditionSql;
  let params = [];

  if (range === "today") {
    filter = { gte: startOfToday };
    conditionSql = `${dateColumn} >= CURDATE()`;
  } else if (range === "yesterday") {
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    filter = { gte: startOfYesterday, lt: startOfToday };
    conditionSql = `${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${dateColumn} < CURDATE()`;
  } else if (range === "7d") {
    filter = { gte: daysAgo(7) };
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  } else if (range === "90d") {
    filter = { gte: daysAgo(90) };
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
  } else if (range === "custom" && startDate && endDate) {
    const cleanStart = String(startDate).slice(0, 10);
    const cleanEnd = String(endDate).slice(0, 10);
    filter = {
      gte: new Date(`${cleanStart}T00:00:00`),
      lte: new Date(`${cleanEnd}T23:59:59`),
    };
    conditionSql = `${dateColumn} >= ? AND ${dateColumn} <= ?`;
    params = [`${cleanStart} 00:00:00`, `${cleanEnd} 23:59:59`];
  } else {
    // '30d' and default fallback
    filter = { gte: daysAgo(30) };
    conditionSql = `${dateColumn} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }

  if (Number.isNaN(filter.gte?.getTime?.()) || Number.isNaN(filter.lte?.getTime?.())) {
    filter = { gte: daysAgo(30) }; // invalid custom dates
  }

  // Parameterised SQL fragment for raw time-series queries (column names are fixed literals)
  const sql = (column) => {
    const col = Prisma.raw(column);
    const parts = [];
    if (filter.gte) parts.push(Prisma.sql`${col} >= ${filter.gte}`);
    if (filter.lt) parts.push(Prisma.sql`${col} < ${filter.lt}`);
    if (filter.lte) parts.push(Prisma.sql`${col} <= ${filter.lte}`);
    return parts.length ? Prisma.join(parts, " AND ") : Prisma.sql`1 = 1`;
  };

  return { conditionSql, params, range, startDate, endDate, filter, sql };
}

/** Rows from $queryRaw: COUNT/SUM come back as BigInt/Decimal -> numbers (as mysql2 returned). */
function toNumberRows(rows, numericKeys) {
  return plain(rows || []).map((row) => {
    const out = { ...row };
    for (const key of numericKeys) out[key] = Number(out[key] || 0);
    return out;
  });
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
  const qrInst = await prisma.instance.findFirst({
    where: {
      uid: whereStr(uid),
      OR: [{ uniqueId: String(instanceId) }, { id: numericId }, { number: String(instanceId) }],
    },
    select: { id: true, uniqueId: true, number: true, title: true, status: true },
  });

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
  const metaInst = await prisma.meta_api.findFirst({
    where: {
      uid: whereStr(uid),
      OR: [
        { business_phone_number_id: String(instanceId) },
        { id: numericId },
        { waba_id: String(instanceId) },
      ],
    },
    select: { id: true, business_phone_number_id: true, waba_id: true },
  });

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
  const dateRange = buildDateRangeFilter(filters, "createdAt");
  const { range, startDate, endDate, filter: period } = dateRange;
  const instanceScope = await resolveInstanceScope(uid, filters.instanceId);
  const tenant = whereStr(uid);

  // 1. Message filtering (ORM filter + equivalent SQL fragment for the time series)
  const msgAnd = [{ uid: tenant }, { createdAt: period }];
  const msgSqlParts = [Prisma.sql`uid = ${tenant}`, dateRange.sql("createdAt")];

  if (instanceScope.isScoped) {
    if (instanceScope.type === "qr") {
      if (instanceScope.number) {
        const cleanNum = instanceScope.number.replace(/[^0-9]/g, "");
        msgAnd.push({ OR: [{ chat_id: { startsWith: `${cleanNum}_` } }, { origin: "qr" }] });
        msgSqlParts.push(Prisma.sql`(chat_id LIKE ${`${cleanNum}\\_%`} OR origin = 'qr')`);
      } else {
        msgAnd.push({ id: -1 }); // Unpaired instance has no messages
        msgSqlParts.push(Prisma.sql`1 = 0`);
      }
    } else if (instanceScope.type === "meta") {
      msgAnd.push({ origin: "meta" });
      msgSqlParts.push(Prisma.sql`origin = 'meta'`);
    }
  }

  const msgWhere = { AND: msgAnd };
  const failedFilter = { OR: [{ status: "failed" }, { err: { not: null } }] };

  // Message aggregate counts (former COUNT(CASE ...) columns)
  const [msgTotal, msgIncoming, msgOutgoing, msgDelivered, msgRead, msgFailed] = await Promise.all([
    prisma.beta_conversation.count({ where: msgWhere }),
    prisma.beta_conversation.count({ where: { AND: [...msgAnd, { route: "INCOMING" }] } }),
    prisma.beta_conversation.count({ where: { AND: [...msgAnd, { route: "OUTGOING" }] } }),
    prisma.beta_conversation.count({ where: { AND: [...msgAnd, { status: { in: ["delivered", "read"] } }] } }),
    prisma.beta_conversation.count({ where: { AND: [...msgAnd, { status: "read" }] } }),
    prisma.beta_conversation.count({ where: { AND: [...msgAnd, failedFilter] } }),
  ]);
  const msgSummary = {
    total: msgTotal,
    incoming: msgIncoming,
    outgoing: msgOutgoing,
    delivered: msgDelivered,
    readCount: msgRead,
    failed: msgFailed,
  };

  // Message daily time series (date bucketing needs SQL; filters are parameterised)
  const msgTimeSeries = toNumberRows(
    await prisma.$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m-%d') AS date,
        COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) AS incoming,
        COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) AS outgoing,
        COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) AS failed,
        COUNT(*) AS total
      FROM beta_conversation
      WHERE ${Prisma.join(msgSqlParts, " AND ")}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC`,
    ["incoming", "outgoing", "failed", "total"],
  );

  // 2. Conversations Summary
  const chatAnd = [{ uid: tenant }];

  if (instanceScope.isScoped) {
    if (instanceScope.type === "qr") {
      if (instanceScope.number) {
        const cleanNum = instanceScope.number.replace(/[^0-9]/g, "");
        chatAnd.push({
          origin: "qr",
          OR: [
            { chat_id: { startsWith: `${cleanNum}_` } },
            { origin_instance_id: { contains: `"${cleanNum}` } },
          ],
        });
      } else {
        chatAnd.push({ id: -1 });
      }
    } else if (instanceScope.type === "meta") {
      const busId = instanceScope.metaId || "";
      chatAnd.push({
        origin: "meta",
        OR: [
          { origin_instance_id: { contains: `"${busId}` } },
          { chat_id: { startsWith: "meta_" } },
        ],
      });
    }
  }

  const chatWhere = { AND: chatAnd };

  const [chatTotal, chatActive, chatUnread, originGroups] = await Promise.all([
    prisma.beta_chats.count({ where: chatWhere }),
    prisma.beta_chats.count({ where: { AND: [...chatAnd, { updatedAt: period }] } }),
    prisma.beta_chats.aggregate({ where: chatWhere, _sum: { unread_count: true } }),
    prisma.beta_chats.groupBy({ by: ["origin"], where: chatWhere, _count: { _all: true } }),
  ]);
  const chatSummary = {
    total: chatTotal,
    activeInPeriod: chatActive,
    totalUnread: Number(chatUnread._sum.unread_count || 0),
  };

  // former COALESCE(NULLIF(origin, ''), 'other') grouping
  const chatsByOrigin = mergeGroups(originGroups, "origin", "other").map(([origin, count]) => ({
    origin,
    count,
  }));

  // 3. Contacts Metrics
  const [contactTotal, contactNew, phonebookGroups] = await Promise.all([
    prisma.contact.count({ where: { uid: tenant } }),
    prisma.contact.count({ where: { uid: tenant, createdAt: period } }),
    prisma.contact.groupBy({ by: ["phonebook_name"], where: { uid: tenant }, _count: { _all: true } }),
  ]);
  const contactSummary = { total: contactTotal, newInPeriod: contactNew };

  // former COALESCE(NULLIF(phonebook_name, ''), 'Default') grouping, top 8
  const contactsByPhonebook = mergeGroups(phonebookGroups, "phonebook_name", "Default")
    .slice(0, 8)
    .map(([phonebook, count]) => ({ phonebook, count }));

  // 4. WhatsApp Connections (Available instances for user)
  const instancesList = plain(await prisma.instance.findMany({
    where: { uid: whereStr(uid) },
    select: {
      id: true,
      uniqueId: true,
      title: true,
      number: true,
      status: true,
      createdAt: true,
    },
    orderBy: { id: "desc" },
  }));

  const [metaRow] = plain(await prisma.meta_api.findMany({
    where: { uid: whereStr(uid) },
    select: { id: true, business_phone_number_id: true, waba_id: true, createdAt: true },
    take: 1,
  }));

  const activeQr = instancesList.filter((i) => i.status === "ACTIVE").length;
  const disconnectedQr = instancesList.filter((i) => i.status !== "ACTIVE").length;
  const metaCount = metaRow ? 1 : 0;

  // 5. Campaign Metrics
  const campaignAgg = await prisma.beta_campaign.aggregate({
    where: { uid: tenant, createdAt: period },
    _count: { _all: true },
    _sum: { sent_count: true, delivered_count: true, read_count: true, failed_count: true },
  });
  const campaignSummary = {
    totalCampaigns: campaignAgg._count._all,
    sent: campaignAgg._sum.sent_count || 0,
    delivered: campaignAgg._sum.delivered_count || 0,
    readCount: campaignAgg._sum.read_count || 0,
    failed: campaignAgg._sum.failed_count || 0,
  };

  const recentCampaigns = plain(await prisma.beta_campaign.findMany({
    where: { uid: whereStr(uid) },
    select: {
      id: true,
      campaign_id: true,
      title: true,
      status: true,
      total_contacts: true,
      sent_count: true,
      delivered_count: true,
      read_count: true,
      failed_count: true,
      createdAt: true,
    },
    orderBy: { id: "desc" },
    take: 5,
  }));

  // 6. Automations & Chatbots
  const [flowSummary] = [{ totalFlows: await prisma.beta_flows.count({ where: { uid: whereStr(uid) } }) }];

  const [totalBots, activeBots, inactiveBots] = await Promise.all([
    prisma.beta_chatbot.count({ where: { uid: tenant } }),
    prisma.beta_chatbot.count({ where: { uid: tenant, active: 1 } }),
    prisma.beta_chatbot.count({ where: { uid: tenant, active: 0 } }),
  ]);
  const chatbotSummary = { totalBots, activeBots, inactiveBots };

  // 7. Live Subscription & Usage Limits
  const [userRow] = plain(await prisma.user.findMany({ where: { uid: whereStr(uid) }, select: { plan: true, plan_expire: true } }));

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
  const dateRange = buildDateRangeFilter(filters, "createdAt");
  const { range, startDate, endDate, filter: period } = dateRange;
  const periodSql = dateRange.sql("createdAt");

  // 1. Platform User Metrics
  const [totalUsers, activeUsers, blockedUsers, newUsersInPeriod] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { is_blocked: false } }),
    prisma.user.count({ where: { is_blocked: true } }),
    prisma.user.count({ where: { createdAt: period } }),
  ]);
  const userStats = { totalUsers, activeUsers, blockedUsers, newUsersInPeriod };

  const userGrowthTimeSeries = toNumberRows(
    await prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM user
      WHERE ${periodSql}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC`,
    ["count"],
  );

  // plan is a JSON text column; title extraction needs JSON_EXTRACT
  const planDistribution = toNumberRows(
    await prisma.$queryRaw`
      SELECT
        COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(plan, '$.title'))), ''), 'Free / Trial') AS planTitle,
        COUNT(*) AS count
      FROM user
      GROUP BY planTitle
      ORDER BY count DESC`,
    ["count"],
  );

  // 2. Platform Revenue & Orders (amount is VARCHAR, so sums need CAST in SQL)
  const [revenueRow] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('SUCCESS', 'PAID') THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN status IN ('SUCCESS', 'PAID') AND ${periodSql} THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0) AS periodRevenue,
      COUNT(*) AS totalOrders,
      COUNT(CASE WHEN status IN ('SUCCESS', 'PAID') THEN 1 END) AS successfulOrders,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pendingOrders,
      COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failedOrders
    FROM orders`;
  const revenueStats = plain(revenueRow || {});

  const revenueTimeSeries = toNumberRows(
    await prisma.$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m-%d') AS date,
        COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS revenue,
        COUNT(*) AS orderCount
      FROM orders
      WHERE status IN ('SUCCESS', 'PAID') AND ${periodSql}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC`,
    ["revenue", "orderCount"],
  );

  // 3. Platform WhatsApp Accounts
  const [totalInstances, activeInstances, disconnectedInstances] = await Promise.all([
    prisma.instance.count(),
    prisma.instance.count({ where: { status: "ACTIVE" } }),
    prisma.instance.count({ where: { status: { not: "ACTIVE" } } }),
  ]);
  const instanceStats = { totalInstances, activeInstances, disconnectedInstances };

  const [metaStats] = [{ metaCount: await prisma.meta_api.count() }];

  // 4. Platform Throughput & Activity
  const inPeriod = { createdAt: period };
  const [msgTotal, msgIn, msgOut, msgDelivered, msgRead, msgFailed] = await Promise.all([
    prisma.beta_conversation.count({ where: inPeriod }),
    prisma.beta_conversation.count({ where: { ...inPeriod, route: "INCOMING" } }),
    prisma.beta_conversation.count({ where: { ...inPeriod, route: "OUTGOING" } }),
    prisma.beta_conversation.count({ where: { ...inPeriod, status: { in: ["delivered", "read"] } } }),
    prisma.beta_conversation.count({ where: { ...inPeriod, status: "read" } }),
    prisma.beta_conversation.count({
      where: { ...inPeriod, OR: [{ status: "failed" }, { err: { not: null } }] },
    }),
  ]);
  const throughputStats = {
    totalMessagesInPeriod: msgTotal,
    incomingInPeriod: msgIn,
    outgoingInPeriod: msgOut,
    deliveredInPeriod: msgDelivered,
    readInPeriod: msgRead,
    failedInPeriod: msgFailed,
  };

  const throughputTimeSeries = toNumberRows(
    await prisma.$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m-%d') AS date,
        COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) AS incoming,
        COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) AS outgoing,
        COUNT(CASE WHEN status = 'failed' OR err IS NOT NULL THEN 1 END) AS failed,
        COUNT(*) AS total
      FROM beta_conversation
      WHERE ${periodSql}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC`,
    ["incoming", "outgoing", "failed", "total"],
  );

  const campaignAgg = await prisma.beta_campaign.aggregate({
    where: inPeriod,
    _count: { _all: true },
    _sum: { sent_count: true, delivered_count: true, read_count: true, failed_count: true },
  });
  const campaignStats = {
    totalCampaigns: campaignAgg._count._all,
    totalSent: campaignAgg._sum.sent_count || 0,
    totalDelivered: campaignAgg._sum.delivered_count || 0,
    totalRead: campaignAgg._sum.read_count || 0,
    totalFailed: campaignAgg._sum.failed_count || 0,
  };

  const [flowStats] = [{ totalFlows: await prisma.beta_flows.count() }];

  const [chatbotTotal, chatbotActive] = await Promise.all([
    prisma.beta_chatbot.count(),
    prisma.beta_chatbot.count({ where: { active: 1 } }),
  ]);
  const chatbotStats = { totalBots: chatbotTotal, activeBots: chatbotActive };

  // 5. Recent Admin Audit Logs
  let auditLogs = [];
  try {
    auditLogs = plain(await prisma.admin_audit_logs.findMany({
      select: {
        id: true,
        admin_uid: true,
        action: true,
        target_type: true,
        target_id: true,
        details: true,
        ip_address: true,
        created_at: true,
      },
      orderBy: { id: "desc" },
      take: 10,
    }));
  } catch (_) {}

  // 6. Top Workspaces approaching limits or highest usage
  // former `user LEFT JOIN contact ... ORDER BY contactCount DESC LIMIT 5`
  const contactCounts = await prisma.contact.groupBy({
    by: ["uid"],
    where: { uid: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 50, // headroom for contacts whose uid has no user row
  });
  const countUsers = await prisma.user.findMany({
    where: { uid: { in: contactCounts.map((c) => c.uid) } },
    select: { uid: true, name: true, email: true },
  });
  const userByUid = new Map(countUsers.map((u) => [u.uid, u]));
  const topWorkspaces = contactCounts
    .filter((c) => userByUid.has(c.uid))
    .slice(0, 5)
    .map((c) => ({ ...userByUid.get(c.uid), contactCount: c._count.id }));
  if (topWorkspaces.length < 5) {
    // LEFT JOIN also listed users with zero contacts
    const zeroContactUsers = await prisma.user.findMany({
      where: { uid: { notIn: topWorkspaces.map((w) => w.uid) } },
      select: { uid: true, name: true, email: true },
      take: 5 - topWorkspaces.length,
    });
    zeroContactUsers.forEach((u) => topWorkspaces.push({ ...u, contactCount: 0 }));
  }

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

/** Merge groupBy rows whose key is NULL or '' into `fallback`, sorted by count desc. */
function mergeGroups(groups, key, fallback) {
  const counts = new Map();
  for (const g of groups) {
    const k = g[key] === null || g[key] === undefined || g[key] === "" ? fallback : g[key];
    counts.set(k, (counts.get(k) || 0) + g._count._all);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

module.exports = {
  buildDateRangeFilter,
  resolveInstanceScope,
  getUserWorkspaceAnalytics,
  getAdminPlatformAnalytics,
};
