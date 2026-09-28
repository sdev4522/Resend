const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { query } = require("../../database/dbpromise");
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
    let countSql = `SELECT COUNT(*) as total FROM contact WHERE uid = ?`;
    let querySql = `SELECT id, name, mobile, phonebook_name, var1, var2, var3, var4, var5, createdAt 
                    FROM contact WHERE uid = ?`;
    const countParams = [req.workspaceId];
    const queryParams = [req.workspaceId];

    if (search) {
      countSql += ` AND (name LIKE ? OR mobile LIKE ?)`;
      countParams.push(search, search);
      querySql += ` AND (name LIKE ? OR mobile LIKE ?)`;
      queryParams.push(search, search);
    }

    querySql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const countRows = await query(countSql, countParams);
    const total = countRows[0]?.total || 0;

    const rows = await query(querySql, queryParams);

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
