// routes/qrCampaign.js
const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { plain, idParam, str, whereStr } = require("../database/prismaHelpers");

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function findOwnedCampaign(id, uid, select) {
  return prisma.qr_campaigns.findFirst({ where: { id: idParam(id), uid }, select });
}
const validateUser = require("../middlewares/user.js");
const { checkPlan } = require("../middlewares/plan.js");
const logger = require("../utils/logger.js");
const { getSession } = require("../helper/addon/qr/index.js");

// ── Tiny inline CSV serializer (replaces json2csv, no extra deps) ──
function toCSV(rows, fields) {
  if (!rows || rows.length === 0) return fields.join(",") + "\n";

  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = fields.join(",");
  const csvRows = rows.map((row) =>
    fields.map((f) => escape(row[f])).join(","),
  );

  return [header, ...csvRows].join("\n");
}

// ── Create Campaign ──────────────────────────────────────────────
router.post("/create", validateUser, checkPlan, async (req, res) => {
  try {
    const {
      title,
      instance_id,
      phonebook_id,
      message_type,
      message_text,
      media_url,
      media_caption,
      delay_min,
      delay_max,
      random_suffix,
      scheduled_at,
    } = req.body;

    if (!title || !instance_id || !phonebook_id || !message_type) {
      return res.json({
        success: false,
        msg: "Please fill all required fields",
      });
    }

    // Validate instance belongs to user
    const instance = await prisma.instance.findFirst({
      where: { uniqueId: whereStr(instance_id), uid: req.decode.uid },
      select: { id: true },
    });
    if (!instance) {
      return res.json({ success: false, msg: "Invalid instance selected" });
    }

    // Count contacts in phonebook
    const total = await prisma.contact.count({
      where: { uid: req.decode.uid, phonebook_id: whereStr(phonebook_id) },
    });

    if (total === 0) {
      return res.json({
        success: false,
        msg: "Selected phonebook has no contacts",
      });
    }

    await prisma.qr_campaigns.create({
      data: {
        uid: req.decode.uid,
        title: str(title),
        instance_id: str(instance_id),
        phonebook_id: str(phonebook_id),
        message_type: str(message_type),
        message_text: message_text ? str(message_text) : null,
        media_url: media_url ? str(media_url) : null,
        media_caption: media_caption ? str(media_caption) : null,
        delay_min: parseInt(delay_min) || 5,
        delay_max: parseInt(delay_max) || 15,
        random_suffix: random_suffix ? 1 : 0,
        status: scheduled_at ? "scheduled" : "pending",
        total_contacts: total,
        scheduled_at: toDateOrNull(scheduled_at),
      },
    });

    res.json({ success: true, msg: "Campaign created successfully" });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Get All Campaigns ────────────────────────────────────────────
router.get("/get_all", validateUser, async (req, res) => {
  try {
    const rows = await prisma.qr_campaigns.findMany({
      where: { uid: req.decode.uid },
      orderBy: { createdAt: "desc" },
    });
    // former `LEFT JOIN instance i ON i.uniqueId = c.instance_id`
    const instanceIds = [...new Set(rows.map((c) => c.instance_id).filter(Boolean))];
    const instances = instanceIds.length
      ? await prisma.instance.findMany({
          where: { uniqueId: { in: instanceIds } },
          select: { uniqueId: true, title: true, number: true },
        })
      : [];
    const byUniqueId = new Map(instances.map((i) => [i.uniqueId, i]));
    const campaigns = rows.map((c) => ({
      ...plain(c),
      instance_title: byUniqueId.get(c.instance_id)?.title ?? null,
      instance_number: byUniqueId.get(c.instance_id)?.number ?? null,
    }));
    res.json({ success: true, data: campaigns });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Get Single Campaign ──────────────────────────────────────────
router.get("/get_one/:id", validateUser, async (req, res) => {
  try {
    const campaign = await findOwnedCampaign(req.params.id, req.decode.uid);
    if (!campaign)
      return res.json({ success: false, msg: "Campaign not found" });
    res.json({ success: true, data: plain(campaign) });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Pause / Resume Campaign ──────────────────────────────────────
router.post("/toggle_status", validateUser, async (req, res) => {
  try {
    const { id, action } = req.body;
    const allowedActions = ["pause", "resume", "stop"];
    if (!allowedActions.includes(action)) {
      return res.json({ success: false, msg: "Invalid action" });
    }

    const campaign = await findOwnedCampaign(id, req.decode.uid, { id: true });
    if (!campaign)
      return res.json({ success: false, msg: "Campaign not found" });

    let newStatus;
    if (action === "pause") newStatus = "paused";
    else if (action === "resume") newStatus = "running";
    else if (action === "stop") newStatus = "stopped";

    await prisma.qr_campaigns.updateMany({
      where: { id: campaign.id, uid: req.decode.uid },
      data: { status: newStatus },
    });

    res.json({ success: true, msg: `Campaign ${action}d successfully` });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Start Campaign ───────────────────────────────────────────────
router.post("/start", validateUser, checkPlan, async (req, res) => {
  try {
    const { id } = req.body;

    const campaign = await findOwnedCampaign(id, req.decode.uid);
    if (!campaign)
      return res.json({ success: false, msg: "Campaign not found" });

    if (["running", "completed"].includes(campaign.status)) {
      return res.json({
        success: false,
        msg: `Campaign is already ${campaign.status}`,
      });
    }

    // Validate session is active
    const session = getSession(campaign.instance_id);
    if (!session) {
      return res.json({
        success: false,
        msg: "WhatsApp instance is not connected. Please connect it first.",
      });
    }

    await prisma.qr_campaigns.updateMany({
      where: { id: campaign.id, uid: req.decode.uid },
      data: { status: "running", started_at: new Date() },
    });

    res.json({ success: true, msg: "Campaign started successfully" });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Delete Campaign ──────────────────────────────────────────────
router.post("/delete", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    const campaignId = idParam(id);
    await prisma.$transaction([
      prisma.qr_campaigns.deleteMany({ where: { id: campaignId, uid: req.decode.uid } }),
      prisma.qr_campaign_logs.deleteMany({
        where: { campaign_id: campaignId, uid: req.decode.uid },
      }),
    ]);
    res.json({ success: true, msg: "Campaign deleted" });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Get Campaign Logs with delivery stats ────────────────────────
router.get("/get_logs/:campaign_id", validateUser, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const take = Math.max(1, parseInt(limit) || 50);
    const offset = Math.max(0, ((parseInt(page) || 1) - 1) * take);
    const where = { campaign_id: idParam(req.params.campaign_id), uid: req.decode.uid };

    const [total, logs, byStatus, byDelivery] = await Promise.all([
      prisma.qr_campaign_logs.count({ where }),
      prisma.qr_campaign_logs.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip: offset,
      }),
      // ── Delivery summary stats (former SUM(CASE ...) aggregate) ──
      prisma.qr_campaign_logs.groupBy({ by: ["status"], where, _count: { id: true } }),
      prisma.qr_campaign_logs.groupBy({ by: ["delivery_status"], where, _count: { id: true } }),
    ]);
    const countOf = (rows, key, values) =>
      rows
        .filter((r) => values.includes(r[key]))
        .reduce((sum, r) => sum + r._count.id, 0);
    const deliveryStats = {
      total,
      sent: countOf(byStatus, "status", ["sent"]),
      failed: countOf(byStatus, "status", ["failed"]),
      delivered: countOf(byDelivery, "delivery_status", ["delivered"]),
      read: countOf(byDelivery, "delivery_status", ["read", "played"]),
      pending: countOf(byDelivery, "delivery_status", ["pending"]),
    };

    res.json({
      success: true,
      data: plain(logs),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      deliveryStats: deliveryStats || {},
    });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

router.get("/download_report/:campaign_id", validateUser, async (req, res) => {
  try {
    const campaignId = idParam(req.params.campaign_id);
    const [logs, campaign] = await Promise.all([
      prisma.qr_campaign_logs.findMany({
        where: { campaign_id: campaignId, uid: req.decode.uid },
        select: {
          contact_name: true,
          contact_mobile: true,
          status: true,
          delivery_status: true,
          error_msg: true,
          sent_at: true,
          delivered_at: true,
          read_at: true,
        },
        orderBy: { sent_at: "asc" },
      }),
      findOwnedCampaign(campaignId, req.decode.uid, { title: true }),
    ]);

    const fields = [
      "contact_name",
      "contact_mobile",
      "status",
      "delivery_status",
      "error_msg",
      "sent_at",
      "delivered_at",
      "read_at",
    ];

    const header = fields.join(",");
    const rows = logs.map((row) =>
      fields
        .map((f) => `"${(row[f] ?? "").toString().replace(/"/g, '""')}"`)
        .join(","),
    );

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="campaign_${campaign?.title || req.params.campaign_id}_report.csv"`,
    );
    res.send(csv);
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// ── Get Phonebooks for Campaign (with contact count) ─────────────
router.get("/get_phonebooks", validateUser, async (req, res) => {
  try {
    const [phonebooks, counts] = await Promise.all([
      prisma.phonebook.findMany({ where: { uid: req.decode.uid } }),
      prisma.contact.groupBy({
        by: ["phonebook_id"],
        where: { uid: req.decode.uid },
        _count: { id: true },
      }),
    ]);
    // one grouped count instead of one COUNT query per phonebook
    const countByPhonebook = new Map(counts.map((c) => [String(c.phonebook_id), c._count.id]));
    const data = phonebooks.map((x) => ({
      ...plain(x),
      contactCount: countByPhonebook.get(String(x.id)) || 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

module.exports = router;
