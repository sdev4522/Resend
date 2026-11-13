// loops/qrCampaignLoop.js
const { prisma } = require("../database/prisma");
const { idParam, intOrNull, plain, str, whereStr } = require("../database/prismaHelpers");
const { getSession } = require("../helper/addon/qr/index.js");
const logger = require("../utils/logger.js");
const { isPlanActiveForUid } = require("../helper/entitlements");

// ── Replace dynamic variables ────────────────────────────────────
function replaceDynamicVars(text, contact) {
  if (!text) return text;
  return text
    .replace(/\{\{name\}\}/gi, contact.name || "")
    .replace(/\{\{mobile\}\}/gi, contact.mobile || "")
    .replace(/\{\{var1\}\}/gi, contact.var1 || "")
    .replace(/\{\{var2\}\}/gi, contact.var2 || "")
    .replace(/\{\{var3\}\}/gi, contact.var3 || "")
    .replace(/\{\{var4\}\}/gi, contact.var4 || "")
    .replace(/\{\{var5\}\}/gi, contact.var5 || "");
}

// ── Add random invisible suffix ──────────────────────────────────
function addRandomSuffix(text) {
  if (!text) return text;
  const chars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
  return `${text}${chars[Math.floor(Math.random() * chars.length)]}`;
}

// ── Random delay ─────────────────────────────────────────────────
function randomDelay(minSec, maxSec) {
  const ms = (Math.random() * (maxSec - minSec) + minSec) * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Build Baileys message ────────────────────────────────────────
function buildBaileysMessage(campaign, contact) {
  const text = replaceDynamicVars(campaign.message_text, contact);
  const caption = replaceDynamicVars(campaign.media_caption, contact);
  const finalText = campaign.random_suffix ? addRandomSuffix(text) : text;
  const finalCaption = campaign.random_suffix
    ? addRandomSuffix(caption)
    : caption;

  switch (campaign.message_type) {
    case "text":
      return { text: finalText };
    case "image":
      return {
        image: { url: campaign.media_url },
        caption: finalCaption || "",
      };
    case "video":
      return {
        video: { url: campaign.media_url },
        caption: finalCaption || "",
      };
    case "audio":
      return {
        audio: { url: campaign.media_url },
        ptt: true,
        mimetype: "audio/ogg; codecs=opus",
      };
    case "document":
      return {
        document: { url: campaign.media_url },
        caption: finalCaption || "",
        fileName: campaign.media_url?.split("/").pop() || "document",
      };
    default:
      return { text: finalText || "" };
  }
}

// ── Process one campaign tick ────────────────────────────────────
async function processCampaign(campaign) {
  try {
    if (!(await isPlanActiveForUid(campaign.uid))) {
      logger.log(`[QR Campaign] Plan inactive for ${campaign.uid}, pausing ${campaign.id}`);
      await prisma.qr_campaigns.updateMany({ where: { id: idParam(campaign.id) }, data: { status: "paused" } });
      return;
    }
    const session = getSession(campaign.instance_id);
    if (!session) {
      logger.log(`[QR Campaign] Session not found for ${campaign.id}, pausing`);
      await prisma.qr_campaigns.updateMany({ where: { id: idParam(campaign.id) }, data: { status: "paused" } });
      return;
    }

    // Get already-sent mobiles
    const sentLogs = plain(await prisma.qr_campaign_logs.findMany({ where: { campaign_id: idParam(campaign.id) }, select: { contact_mobile: true } }));
    const sentMobiles = new Set(sentLogs.map((l) => String(l.contact_mobile)));

    // Get pending contacts
    const contacts = plain(await prisma.contact.findMany({
      where: { uid: whereStr(campaign.uid), phonebook_id: whereStr(campaign.phonebook_id) },
    }));
    const pending = contacts.filter((c) => !sentMobiles.has(String(c.mobile)));

    if (pending.length === 0) {
      await prisma.qr_campaigns.updateMany({
        where: { id: idParam(campaign.id) },
        data: { status: "completed", completed_at: new Date() },
      });
      logger.log(`[QR Campaign] Campaign ${campaign.id} completed`);
      return;
    }

    const contact = pending[0];
    const jid = `${contact.mobile}@s.whatsapp.net`;
    const msgObj = buildBaileysMessage(campaign, contact);

    let status = "sent";
    let errorMsg = null;
    let messageId = null;

    try {
      // ── Send and capture the message key ──────────────────────
      const sendResult = await session.sendMessage(jid, msgObj);
      messageId = sendResult?.key?.id || null;
    } catch (sendErr) {
      status = "failed";
      errorMsg = sendErr?.message || "Send failed";
      logger.error(
        `[QR Campaign] Failed to send to ${contact.mobile}:`,
        sendErr?.message,
      );
    }

    // ── Log with message_id for delivery tracking ──────────────
    await prisma.qr_campaign_logs.create({
      data: {
        campaign_id: intOrNull(campaign.id),
        uid: str(campaign.uid),
        contact_name: str(contact.name || ""),
        contact_mobile: str(contact.mobile),
        status: str(status),
        error_msg: str(errorMsg),
        message_id: str(messageId),
        delivery_status: str(status === "sent" ? "sent" : "failed"),
      },
    });

    // ── Update counters ────────────────────────────────────────
    if (status === "sent") {
      await prisma.qr_campaigns.update({
        where: { id: campaign.id },
        data: { sent_count: { increment: 1 } },
      });
    } else {
      await prisma.qr_campaigns.update({
        where: { id: campaign.id },
        data: { failed_count: { increment: 1 } },
      });
    }

    // ── Delay before next message ──────────────────────────────
    await randomDelay(campaign.delay_min || 5, campaign.delay_max || 15);
  } catch (err) {
    logger.error(
      `[QR Campaign] Error processing campaign ${campaign.id}:`,
      err,
    );
  }
}

// ── Check scheduled campaigns ────────────────────────────────────
async function checkScheduledCampaigns() {
  try {
    const scheduled = plain(await prisma.qr_campaigns.findMany({ where: { status: "scheduled", scheduled_at: { lte: new Date() } } }));
    for (const c of scheduled) {
      await prisma.qr_campaigns.updateMany({
        where: { id: idParam(c.id) },
        data: { status: "running", started_at: new Date() },
      });
    }
  } catch (err) {
    logger.error("[QR Campaign] Scheduled check error:", err);
  }
}

// ── Main loop ────────────────────────────────────────────────────
async function qrCampaignLoop() {
  try {
    await checkScheduledCampaigns();

    const running = plain(await prisma.qr_campaigns.findMany({ where: { status: "running" }, take: 5 }));

    for (const campaign of running) {
      const [fresh] = plain(await prisma.qr_campaigns.findMany({ where: { id: idParam(campaign.id) }, select: { status: true } }));
      if (fresh?.status === "running") {
        await processCampaign(campaign);
      }
    }
  } catch (err) {
    logger.error("[QR Campaign Loop] Error:", err);
  } finally {
    setTimeout(qrCampaignLoop, 2000);
  }
}

function initQrCampaignLoop() {
  logger.log("[QR Campaign Loop] Starting...");
  setTimeout(qrCampaignLoop, 5000);
}

module.exports = { initQrCampaignLoop };
