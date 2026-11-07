const router = require("express").Router();
const { prisma } = require("../database/prisma");
const {
  plain,
  idParam,
  intOrNull,
  dayRange,
  dateBetween,
  lastDays,
  thisMonth,
} = require("../database/prismaHelpers");
const validateUser = require("../middlewares/user.js");
const { checkPlan } = require("../middlewares/plan.js");
const logger = require("../utils/logger.js");

// ── Move card ─────────────────────────────────────────────────────────────────
router.post("/move_card", validateUser, checkPlan, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { chatId, newLabelId, kanban_order } = req.body;

    if (!chatId) return res.json({ success: false, msg: "chatId is required" });

    const chat = await prisma.beta_chats.findFirst({
      where: { id: idParam(chatId), uid },
      select: { id: true, chat_label: true },
    });
    if (!chat) return res.json({ success: false, msg: "Chat not found" });

    const order = intOrNull(kanban_order) ?? 0;

    if (!newLabelId) {
      await prisma.beta_chats.updateMany({
        where: { id: chat.id, uid },
        data: { chat_label: JSON.stringify([]), kanban_order: order },
      });
      return res.json({ success: true });
    }

    const labelRow = await prisma.chat_tags.findFirst({
      where: { id: idParam(newLabelId), uid },
    });
    if (!labelRow) return res.json({ success: false, msg: "Label not found" });
    const newLabel = plain(labelRow);

    let existingLabels = [];
    try {
      const parsed = JSON.parse(chat.chat_label || "[]");
      existingLabels = Array.isArray(parsed) ? parsed : [parsed];
    } catch {}

    const updatedLabels = [newLabel, ...existingLabels.slice(1)];

    await prisma.beta_chats.updateMany({
      where: { id: chat.id, uid },
      data: { chat_label: JSON.stringify(updatedLabels), kanban_order: order },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Update show_on_kanban for a tag ───────────────────────────────────────────
router.post("/update_tag_kanban_visibility", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { labelId, show_on_kanban } = req.body;

    if (!labelId)
      return res.json({ success: false, msg: "labelId is required" });

    await prisma.chat_tags.updateMany({
      where: { id: idParam(labelId), uid },
      data: { show_on_kanban: Boolean(show_on_kanban) },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Get board ─────────────────────────────────────────────────────────────────
router.post("/get_board", validateUser, checkPlan, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const {
      search = "",
      limit = 20,
      offset = 0,
      dateFilter = "lifetime", // today | yesterday | last7 | last30 | thisMonth | lifetime | custom
      dateFrom = null,
      dateTo = null,
    } = req.body;

    // Only fetch labels that are shown on kanban
    const labels = plain(
      await prisma.chat_tags.findMany({
        where: { uid, show_on_kanban: true },
        orderBy: { id: "asc" },
      }),
    );

    const where = { uid };

    // ── Date filter (local server time, same as the previous MySQL NOW()/DATE()) ──
    if (dateFilter === "today") {
      where.updatedAt = dayRange(new Date());
    } else if (dateFilter === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      where.updatedAt = dayRange(yest);
    } else if (dateFilter === "last7") {
      where.updatedAt = lastDays(7);
    } else if (dateFilter === "last30") {
      where.updatedAt = lastDays(30);
    } else if (dateFilter === "thisMonth") {
      where.updatedAt = thisMonth();
    } else if (dateFilter === "custom" && dateFrom && dateTo) {
      where.updatedAt = dateBetween(dateFrom, dateTo);
    }
    // lifetime → no date filter

    if (search) {
      const term = String(search);
      where.OR = [
        { sender_name: { contains: term } },
        { sender_mobile: { contains: term } },
        { last_message: { contains: term } },
        // label titles live inside the JSON chat_label column
        { AND: [{ chat_label: { contains: '"title":"' } }, { chat_label: { contains: term } }] },
      ];
    }

    const take = Math.max(0, parseInt(limit, 10) || 20);
    const skip = Math.max(0, parseInt(offset, 10) || 0);

    const [total, chatRows] = await Promise.all([
      prisma.beta_chats.count({ where }),
      prisma.beta_chats.findMany({
        where,
        select: {
          id: true,
          chat_id: true,
          sender_name: true,
          sender_mobile: true,
          last_message: true,
          origin: true,
          unread_count: true,
          assigned_agent: true,
          chat_label: true,
          kanban_order: true,
          updatedAt: true,
        },
        orderBy: [{ kanban_order: "asc" }, { updatedAt: "desc" }],
        take,
        skip,
      }),
    ]);
    const chats = plain(chatRows);

    const parsedChats = chats.map((chat) => {
      try {
        chat.last_message = JSON.parse(chat.last_message);
      } catch {}
      return chat;
    });

    const grouped = {};
    labels.forEach((l) => (grouped[l.id] = []));
    grouped["unlabeled"] = [];

    parsedChats.forEach((chat) => {
      let firstLabel = null;
      try {
        const arr = JSON.parse(
          typeof chat.chat_label === "string" ? chat.chat_label : "[]",
        );
        firstLabel = (Array.isArray(arr) ? arr : [arr])[0] || null;
      } catch {}

      if (firstLabel && grouped[firstLabel.id] !== undefined) {
        grouped[firstLabel.id].push({ ...chat, kanbanLabel: firstLabel });
      } else {
        grouped["unlabeled"].push({ ...chat, kanbanLabel: null });
      }
    });

    res.json({ success: true, labels, grouped, total, offset, limit });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

module.exports = router;
