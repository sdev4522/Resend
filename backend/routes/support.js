const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { plain, idParam } = require("../database/prismaHelpers");
const validateUser = require("../middlewares/user");
const adminValidator = require("../middlewares/admin");
const { authRateLimiter } = require("../middlewares/rateLimiter");
const logger = require("../utils/logger");

const VALID_CATEGORIES = [
  "technical",
  "whatsapp",
  "billing",
  "campaign",
  "automation",
  "account",
  "other",
];

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
const VALID_STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"];

// Adds message_count + last_message_at (former correlated sub-queries) to ticket rows
async function withMessageStats(tickets) {
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id);
  const stats = await prisma.support_messages.groupBy({
    by: ["ticket_id"],
    where: { ticket_id: { in: ids } },
    _count: { id: true },
    _max: { created_at: true },
  });
  const byTicket = new Map(stats.map((r) => [r.ticket_id, r]));
  return tickets.map((t) => ({
    ...plain(t),
    message_count: byTicket.get(t.id)?._count.id || 0,
    last_message_at: byTicket.get(t.id)?._max.created_at || null,
  }));
}

// Former `LEFT JOIN user u ON t.uid = u.uid` (no Prisma relation between the tables)
async function usersByUid(uids, select) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: { uid: { in: unique } },
    select: { uid: true, ...select },
  });
  return new Map(users.map((u) => [u.uid, u]));
}

async function listMessages(ticketId) {
  const messages = await prisma.support_messages.findMany({
    where: { ticket_id: ticketId },
    orderBy: { created_at: "asc" },
  });
  return messages.map((m) => {
    let parsedAttachments = [];
    if (m.attachments) {
      try {
        parsedAttachments = JSON.parse(m.attachments);
      } catch (e) {}
    }
    return {
      ...plain(m),
      attachments: parsedAttachments,
    };
  });
}

async function addMessage({ ticketId, senderType, senderId, senderName, message, attachments }) {
  return prisma.support_messages.create({
    data: {
      ticket_id: ticketId,
      sender_type: senderType,
      sender_id: String(senderId),
      sender_name: String(senderName).slice(0, 100),
      message,
      attachments,
    },
  });
}

async function notify(uid, title, message, actionUrl) {
  return prisma.in_app_notifications.create({
    data: { uid, title, message, type: "SUPPORT", action_url: actionUrl },
  });
}

// ═══════════════════════════════════════════════════════════════════
// USER SUPPORT ROUTES (Authenticated Workspace Owner)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/support/tickets
 * Get all support tickets submitted by the authenticated user's workspace
 */
router.get("/tickets", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;

    const tickets = await withMessageStats(
      await prisma.support_tickets.findMany({
        where: { uid },
        orderBy: { updated_at: "desc" },
      }),
    );

    const counts = {
      all: tickets.length,
      open: tickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    };

    res.json({
      success: true,
      tickets,
      counts,
    });
  } catch (err) {
    logger.error("[Support] Error listing user tickets:", err);
    res.status(500).json({ success: false, msg: "Failed to load support tickets" });
  }
});

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
router.post(
  "/tickets",
  validateUser,
  authRateLimiter({ limit: 10, windowSizeMs: 60000, prefix: "user_support_create" }),
  async (req, res) => {
    try {
      const uid = req.decode.uid;
      const { subject, category, priority, message, attachments } = req.body;

      const cleanSubject = (subject || "").trim().slice(0, 200);
      const cleanCategory = VALID_CATEGORIES.includes(category) ? category : "other";
      const cleanPriority = VALID_PRIORITIES.includes(priority) ? priority : "normal";
      const cleanMessage = (message || "").trim().slice(0, 5000);

      if (!cleanSubject) {
        return res.status(400).json({ success: false, msg: "Subject is required" });
      }

      if (!cleanMessage || cleanMessage.length < 10) {
        return res.status(400).json({
          success: false,
          msg: "Please provide a detailed description (minimum 10 characters)",
        });
      }

      const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      // Safe attachments serialization
      let attachmentsJson = null;
      if (Array.isArray(attachments) && attachments.length > 0) {
        const safeAttachments = attachments.slice(0, 5).map((att) => ({
          name: String(att.name || "attachment").slice(0, 100),
          url: String(att.url || "").slice(0, 500),
          size: Number(att.size || 0),
        }));
        attachmentsJson = JSON.stringify(safeAttachments);
      }

      // Insert ticket
      // Ticket + first message are created together (nested write = one transaction)
      const senderName = req.decode.userData?.name || req.decode.email || "Workspace User";
      const created = await prisma.support_tickets.create({
        data: {
          ticket_number: ticketNumber,
          uid,
          subject: cleanSubject,
          category: cleanCategory,
          priority: cleanPriority,
          status: "open",
          support_messages: {
            create: {
              sender_type: "user",
              sender_id: String(uid),
              sender_name: String(senderName).slice(0, 100),
              message: cleanMessage,
              attachments: attachmentsJson,
            },
          },
        },
        select: { id: true },
      });

      const ticketId = created.id;

      res.json({
        success: true,
        msg: "Support request created successfully",
        ticket: {
          id: ticketId,
          ticket_number: ticketNumber,
          subject: cleanSubject,
          category: cleanCategory,
          priority: cleanPriority,
          status: "open",
        },
      });
    } catch (err) {
      logger.error("[Support] Error creating ticket:", err);
      res.status(500).json({ success: false, msg: "Failed to create support request" });
    }
  }
);

/**
 * GET /api/support/tickets/:id
 * Retrieve details and conversation messages for a ticket
 */
router.get("/tickets/:id", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const ticketId = parseInt(req.params.id, 10);

    const ticket = await prisma.support_tickets.findFirst({
      where: { id: idParam(ticketId), uid },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Support ticket not found" });
    }

    const formattedMessages = await listMessages(ticket.id);

    res.json({
      success: true,
      ticket: plain(ticket),
      messages: formattedMessages,
    });
  } catch (err) {
    logger.error("[Support] Error fetching ticket detail:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch ticket details" });
  }
});

/**
 * POST /api/support/tickets/:id/reply
 * User reply to a ticket
 */
router.post(
  "/tickets/:id/reply",
  validateUser,
  authRateLimiter({ limit: 15, windowSizeMs: 60000, prefix: "user_support_reply" }),
  async (req, res) => {
    try {
      const uid = req.decode.uid;
      const ticketId = parseInt(req.params.id, 10);
      const { message, attachments } = req.body;

      const cleanMessage = (message || "").trim().slice(0, 5000);
      if (!cleanMessage) {
        return res.status(400).json({ success: false, msg: "Reply message cannot be empty" });
      }

      const ticket = await prisma.support_tickets.findFirst({
        where: { id: idParam(ticketId), uid },
      });

      if (!ticket) {
        return res.status(404).json({ success: false, msg: "Support ticket not found" });
      }

      if (ticket.status === "closed") {
        return res.status(400).json({
          success: false,
          msg: "This ticket has been closed. Please open a new request for further assistance.",
        });
      }

      let attachmentsJson = null;
      if (Array.isArray(attachments) && attachments.length > 0) {
        attachmentsJson = JSON.stringify(attachments.slice(0, 5));
      }

      const senderName = req.decode.userData?.name || req.decode.email || "Workspace User";
      await addMessage({
        ticketId: ticket.id,
        senderType: "user",
        senderId: uid,
        senderName,
        message: cleanMessage,
        attachments: attachmentsJson,
      });

      // Re-open ticket if it was resolved or waiting_user
      await prisma.support_tickets.update({
        where: { id: ticket.id },
        data: { status: "open", updated_at: new Date() },
      });

      res.json({
        success: true,
        msg: "Reply sent successfully",
      });
    } catch (err) {
      logger.error("[Support] Error sending user reply:", err);
      res.status(500).json({ success: false, msg: "Failed to send reply" });
    }
  }
);

/**
 * POST /api/support/tickets/:id/close
 * Close ticket from user side
 */
router.post("/tickets/:id/close", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const ticketId = parseInt(req.params.id, 10);

    const ticket = await prisma.support_tickets.findFirst({
      where: { id: idParam(ticketId), uid },
      select: { id: true },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Support ticket not found" });
    }

    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: { status: "closed", updated_at: new Date() },
    });

    res.json({
      success: true,
      msg: "Ticket marked as closed",
    });
  } catch (err) {
    logger.error("[Support] Error closing ticket:", err);
    res.status(500).json({ success: false, msg: "Failed to close ticket" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ADMIN SUPPORT ROUTES (Super Admin)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/support/admin/tickets
 * List tickets with search, filtering and user profile context
 */
router.get("/admin/tickets", adminValidator, async (req, res) => {
  try {
    const { search, status, category, priority, page = 1, limit = 20 } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = {};
    if (status && status !== "all") where.status = String(status);
    if (category && category !== "all") where.category = String(category);
    if (priority && priority !== "all") where.priority = String(priority);

    if (search && search.trim()) {
      const q = search.trim();
      // former `u.email LIKE ? OR u.name LIKE ?` on the joined user table
      const matchedUsers = await prisma.user.findMany({
        where: { OR: [{ email: { contains: q } }, { name: { contains: q } }] },
        select: { uid: true },
      });
      where.OR = [
        { ticket_number: { contains: q } },
        { subject: { contains: q } },
        { uid: { in: matchedUsers.map((u) => u.uid).filter(Boolean) } },
      ];
    }

    const [total, rows, statusCounts] = await Promise.all([
      prisma.support_tickets.count({ where }),
      prisma.support_tickets.findMany({
        where,
        orderBy: { updated_at: "desc" },
        take: pageLimit,
        skip: Math.max(0, offset || 0),
      }),
      // Global counts
      prisma.support_tickets.groupBy({ by: ["status"], _count: { id: true } }),
    ]);

    const userMap = await usersByUid(rows.map((t) => t.uid), { name: true, email: true });
    const tickets = (await withMessageStats(rows)).map((t) => ({
      ...t,
      user_name: userMap.get(t.uid)?.name ?? null,
      user_email: userMap.get(t.uid)?.email ?? null,
    }));

    const countsMap = { all: 0, open: 0, in_progress: 0, waiting_user: 0, resolved: 0, closed: 0 };
    for (const row of statusCounts) {
      countsMap[row.status] = row._count.id;
      countsMap.all += row._count.id;
    }

    res.json({
      success: true,
      tickets,
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      counts: countsMap,
    });
  } catch (err) {
    logger.error("[Support Admin] Error listing tickets:", err);
    res.status(500).json({ success: false, msg: "Failed to list support tickets" });
  }
});

/**
 * GET /api/support/admin/tickets/:id
 * Admin detail view for a specific ticket
 */
router.get("/admin/tickets/:id", adminValidator, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);

    const row = await prisma.support_tickets.findFirst({
      where: { id: idParam(ticketId) },
    });

    if (!row) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    const owner = (
      await usersByUid([row.uid], {
        name: true,
        email: true,
        mobile_with_country_code: true,
        createdAt: true,
      })
    ).get(row.uid);
    const ticket = {
      ...plain(row),
      user_name: owner?.name ?? null,
      user_email: owner?.email ?? null,
      user_mobile: owner?.mobile_with_country_code ?? null,
      user_created_at: owner?.createdAt ?? null,
    };

    const formattedMessages = await listMessages(row.id);

    res.json({
      success: true,
      ticket,
      messages: formattedMessages,
    });
  } catch (err) {
    logger.error("[Support Admin] Error fetching ticket detail:", err);
    res.status(500).json({ success: false, msg: "Failed to load ticket" });
  }
});

/**
 * POST /api/support/admin/tickets/:id/reply
 * Admin reply to ticket
 */
router.post("/admin/tickets/:id/reply", adminValidator, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { message, status = "in_progress", attachments } = req.body;

    const cleanMessage = (message || "").trim().slice(0, 5000);
    if (!cleanMessage) {
      return res.status(400).json({ success: false, msg: "Reply message cannot be empty" });
    }

    const ticket = await prisma.support_tickets.findFirst({
      where: { id: idParam(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    let attachmentsJson = null;
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachmentsJson = JSON.stringify(attachments.slice(0, 5));
    }

    const adminName = "Resend Support Team";
    await addMessage({
      ticketId: ticket.id,
      senderType: "admin",
      senderId: req.decode.uid || "admin",
      senderName: adminName,
      message: cleanMessage,
      attachments: attachmentsJson,
    });

    const targetStatus = VALID_STATUSES.includes(status) ? status : "in_progress";
    await prisma.support_tickets.update({
      where: { id: ticket.id },
      data: { status: targetStatus, updated_at: new Date() },
    });

    // Notify user in-app
    try {
      await notify(
        ticket.uid,
        `New reply on Support Request #${ticket.ticket_number}`,
        cleanMessage.slice(0, 150) + (cleanMessage.length > 150 ? "..." : ""),
        `/dashboard/support?ticket=${ticket.id}`,
      );
    } catch (notifErr) {
      logger.error("[Support Admin] Notification creation failed:", notifErr);
    }

    res.json({
      success: true,
      msg: "Reply sent to customer successfully",
    });
  } catch (err) {
    logger.error("[Support Admin] Error replying to ticket:", err);
    res.status(500).json({ success: false, msg: "Failed to send reply" });
  }
});

/**
 * POST /api/support/admin/tickets/:id/status
 * Admin update ticket status or priority
 */
router.post("/admin/tickets/:id/status", adminValidator, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { status, priority } = req.body;

    const ticket = await prisma.support_tickets.findFirst({
      where: { id: idParam(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    const data = {};

    if (status && VALID_STATUSES.includes(status)) {
      data.status = status;
    }

    if (priority && VALID_PRIORITIES.includes(priority)) {
      data.priority = priority;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, msg: "No valid status or priority provided" });
    }

    data.updated_at = new Date();

    await prisma.support_tickets.update({ where: { id: ticket.id }, data });

    // Notify user if ticket is marked resolved
    if (status === "resolved") {
      try {
        await notify(
          ticket.uid,
          `Support Ticket #${ticket.ticket_number} marked as Resolved`,
          `Your support request "${ticket.subject}" has been marked as resolved by our team.`,
          `/dashboard/support?ticket=${ticket.id}`,
        );
      } catch (notifErr) {
        logger.error("[Support Admin] Notification failed:", notifErr);
      }
    }

    res.json({
      success: true,
      msg: "Ticket status updated",
    });
  } catch (err) {
    logger.error("[Support Admin] Error updating status:", err);
    res.status(500).json({ success: false, msg: "Failed to update ticket status" });
  }
});

module.exports = router;
