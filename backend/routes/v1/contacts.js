const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { prisma } = require("../../database/prisma");
const logger = require("../../utils/logger");

/**
 * GET /v1/contacts
 * Paginated contacts list for the authenticated workspace
 */
router.get("/contacts", requireScope("contacts:read"), async (req, res) => {
  const requestId = req.requestId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = req.query.search ? `%${req.query.search.trim()}%` : null;
  const offset = (page - 1) * limit;

  try {
    const where = { uid: req.workspaceId };
    if (search) {
      const term = String(req.query.search).trim();
      where.OR = [{ name: { contains: term } }, { mobile: { contains: term } }];
    }

    const [total, rows] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          mobile: true,
          phonebook_name: true,
          var1: true,
          var2: true,
          var3: true,
          var4: true,
          var5: true,
          createdAt: true,
        },
        orderBy: { id: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    const contacts = rows.map((r) => ({
      id: `cnt_${r.id}`,
      name: r.name || "",
      phone_number: (r.mobile || "").replace(/\D/g, ""),
      phonebook_name: r.phonebook_name || null,
      custom_fields: {
        var1: r.var1 || null,
        var2: r.var2 || null,
        var3: r.var3 || null,
        var4: r.var4 || null,
        var5: r.var5 || null,
      },
      created_at: r.createdAt,
    }));

    return res.status(200).json({
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        has_more: offset + rows.length < total,
      },
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in GET /v1/contacts:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve contacts.",
        request_id: requestId,
      },
    });
  }
});

module.exports = router;
