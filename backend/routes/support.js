const router = require("express").Router();
const { query } = require("../database/dbpromise");
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

    const tickets = await query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count,
        (SELECT m.created_at FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
       FROM support_tickets t
       WHERE t.uid = ?
       ORDER BY t.updated_at DESC`,
      [uid]
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
      const ticketResult = await query(
        `INSERT INTO support_tickets (ticket_number, uid, subject, category, priority, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
        [ticketNumber, uid, cleanSubject, cleanCategory, cleanPriority]
      );

      const ticketId = ticketResult.insertId;

      // Insert first message
      const senderName = req.decode.userData?.name || req.decode.email || "Workspace User";
      await query(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_id, sender_name, message, attachments)
         VALUES (?, 'user', ?, ?, ?, ?)`,
        [ticketId, uid, senderName, cleanMessage, attachmentsJson]
      );

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

    const [ticket] = await query(
      `SELECT * FROM support_tickets WHERE id = ? AND uid = ? LIMIT 1`,
      [ticketId, uid]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Support ticket not found" });
    }

    const messages = await query(
      `SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );

    const formattedMessages = messages.map((m) => {
      let parsedAttachments = [];
      if (m.attachments) {
        try {
          parsedAttachments = JSON.parse(m.attachments);
        } catch (e) {}
      }
      return {
        ...m,
        attachments: parsedAttachments,
      };
    });

    res.json({
      success: true,
      ticket,
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

      const [ticket] = await query(
        `SELECT * FROM support_tickets WHERE id = ? AND uid = ? LIMIT 1`,
        [ticketId, uid]
      );

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
      await query(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_id, sender_name, message, attachments)
         VALUES (?, 'user', ?, ?, ?, ?)`,
        [ticketId, uid, senderName, cleanMessage, attachmentsJson]
      );

      // Re-open ticket if it was resolved or waiting_user
      await query(
        `UPDATE support_tickets SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [ticketId]
      );

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

    const [ticket] = await query(
      `SELECT * FROM support_tickets WHERE id = ? AND uid = ? LIMIT 1`,
      [ticketId, uid]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Support ticket not found" });
    }

    await query(
      `UPDATE support_tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ticketId]
    );

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

    let sql = `
      SELECT t.*, u.name as user_name, u.email as user_email,
        (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count,
        (SELECT m.created_at FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
      FROM support_tickets t
      LEFT JOIN user u ON t.uid = u.uid
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (category && category !== "all") {
      sql += ` AND t.category = ?`;
      params.push(category);
    }

    if (priority && priority !== "all") {
      sql += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (t.ticket_number LIKE ? OR t.subject LIKE ? OR u.email LIKE ? OR u.name LIKE ?)`;
      params.push(q, q, q, q);
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRow] = await query(countSql, params);
    const total = countRow?.total || 0;

    sql += ` ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(pageLimit, offset);

    const tickets = await query(sql, params);

    // Global counts
    const statusCounts = await query(`
      SELECT status, COUNT(*) as count FROM support_tickets GROUP BY status
    `);
    const countsMap = { all: 0, open: 0, in_progress: 0, waiting_user: 0, resolved: 0, closed: 0 };
    for (const row of statusCounts) {
      countsMap[row.status] = row.count;
      countsMap.all += row.count;
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

    const [ticket] = await query(
      `SELECT t.*, u.name as user_name, u.email as user_email,
        u.mobile_with_country_code as user_mobile, u.createdAt as user_created_at
       FROM support_tickets t
       LEFT JOIN user u ON t.uid = u.uid
       WHERE t.id = ? LIMIT 1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    const messages = await query(
      `SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );

    const formattedMessages = messages.map((m) => {
      let parsedAttachments = [];
      if (m.attachments) {
        try {
          parsedAttachments = JSON.parse(m.attachments);
        } catch (e) {}
      }
      return {
        ...m,
        attachments: parsedAttachments,
      };
    });

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

    const [ticket] = await query(
      `SELECT * FROM support_tickets WHERE id = ? LIMIT 1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    let attachmentsJson = null;
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachmentsJson = JSON.stringify(attachments.slice(0, 5));
    }

    const adminName = "Resend Support Team";
    await query(
      `INSERT INTO support_messages (ticket_id, sender_type, sender_id, sender_name, message, attachments)
       VALUES (?, 'admin', ?, ?, ?, ?)`,
      [ticketId, String(req.decode.uid || "admin"), adminName, cleanMessage, attachmentsJson]
    );

    const targetStatus = VALID_STATUSES.includes(status) ? status : "in_progress";
    await query(
      `UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetStatus, ticketId]
    );

    // Notify user in-app
    try {
      await query(
        `INSERT INTO in_app_notifications (uid, title, message, type, action_url)
         VALUES (?, ?, ?, 'SUPPORT', ?)`,
        [
          ticket.uid,
          `New reply on Support Request #${ticket.ticket_number}`,
          cleanMessage.slice(0, 150) + (cleanMessage.length > 150 ? "..." : ""),
          `/dashboard/support?ticket=${ticket.id}`,
        ]
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

    const [ticket] = await query(
      `SELECT * FROM support_tickets WHERE id = ? LIMIT 1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, msg: "Ticket not found" });
    }

    const updates = [];
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      updates.push("status = ?");
      params.push(status);
    }

    if (priority && VALID_PRIORITIES.includes(priority)) {
      updates.push("priority = ?");
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, msg: "No valid status or priority provided" });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(ticketId);

    await query(`UPDATE support_tickets SET ${updates.join(", ")} WHERE id = ?`, params);

    // Notify user if ticket is marked resolved
    if (status === "resolved") {
      try {
        await query(
          `INSERT INTO in_app_notifications (uid, title, message, type, action_url)
           VALUES (?, ?, ?, 'SUPPORT', ?)`,
          [
            ticket.uid,
            `Support Ticket #${ticket.ticket_number} marked as Resolved`,
            `Your support request "${ticket.subject}" has been marked as resolved by our team.`,
            `/dashboard/support?ticket=${ticket.id}`,
          ]
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
