const crypto = require("crypto");
const { query } = require("../../database/dbpromise");
const logger = require("../../utils/logger");
const { sendAPIMessage } = require("../../functions/function");

/**
 * Generate a public message ID with msg_ prefix
 */
function generatePublicMessageId() {
  return `msg_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Normalize recipient phone number
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

/**
 * Build Baileys message object from standardized public API format
 */
function buildQrMessagePayload(type, payload) {
  switch (type) {
    case "text":
      return { text: payload.text?.body || "" };

    case "image":
      return {
        image: { url: payload.image?.link || payload.image?.url },
        caption: payload.image?.caption || "",
      };

    case "video":
      return {
        video: { url: payload.video?.link || payload.video?.url },
        caption: payload.video?.caption || "",
      };

    case "audio":
      return {
        audio: { url: payload.audio?.link || payload.audio?.url },
        ptt: !!payload.audio?.voice,
        mimetype: "audio/mp4",
      };

    case "document":
      return {
        document: { url: payload.document?.link || payload.document?.url },
        caption: payload.document?.caption || "",
        fileName: payload.document?.filename || "document.pdf",
      };

    default:
      throw new Error(`Unsupported message type for QR connection: ${type}`);
  }
}

/**
 * Build Meta Cloud API message object from standardized public API format
 */
function buildMetaMessagePayload(type, to, payload) {
  const base = {
    to,
    type,
  };

  switch (type) {
    case "text":
      return {
        ...base,
        text: {
          preview_url: false,
          body: payload.text?.body || "",
        },
      };

    case "image":
      return {
        ...base,
        image: {
          link: payload.image?.link || payload.image?.url,
          caption: payload.image?.caption || "",
        },
      };

    case "video":
      return {
        ...base,
        video: {
          link: payload.video?.link || payload.video?.url,
          caption: payload.video?.caption || "",
        },
      };

    case "audio":
      return {
        ...base,
        audio: {
          link: payload.audio?.link || payload.audio?.url,
        },
      };

    case "document":
      return {
        ...base,
        document: {
          link: payload.document?.link || payload.document?.url,
          caption: payload.document?.caption || "",
          filename: payload.document?.filename || "document.pdf",
        },
      };

    default:
      throw new Error(`Unsupported message type for Meta Cloud connection: ${type}`);
  }
}

/**
 * Dispatch a message through QR or Meta provider
 */
async function dispatchPublicMessage({
  uid,
  apiKey,
  resolvedConn,
  recipient,
  type,
  messagePayload,
}) {
  const publicMsgId = generatePublicMessageId();
  const normalizedTo = normalizePhoneNumber(recipient);

  if (!normalizedTo) {
    return {
      success: false,
      error: "INVALID_PHONE_NUMBER",
      message: "The provided recipient phone number is invalid.",
      statusCode: 400,
    };
  }

  const { provider, connection, instanceRecord, metaRecord } = resolvedConn;
  let providerMsgId = null;
  let initialStatus = "accepted";

  if (provider === "qr") {
    // Baileys QR dispatch
    const { getSession, isExists } = require("../../helper/addon/qr");
    const session = getSession(instanceRecord.uniqueId);

    if (!session) {
      return {
        success: false,
        error: "CONNECTION_DISCONNECTED",
        message: "The WhatsApp QR session is not currently running. Please verify your connection status.",
        statusCode: 400,
      };
    }

    const jid = `${normalizedTo}@s.whatsapp.net`;

    // Verify recipient WhatsApp availability
    try {
      const exists = await isExists(session, jid, false);
      if (!exists) {
        return {
          success: false,
          error: "INVALID_PHONE_NUMBER",
          message: "The recipient number is not registered on WhatsApp.",
          statusCode: 400,
        };
      }
    } catch (err) {
      logger.warn("isExists check skipped or failed:", err.message);
    }

    const qrContent = buildQrMessagePayload(type, messagePayload);
    const sendResult = await session.sendMessage(jid, qrContent);

    providerMsgId = sendResult?.key?.id || null;
    initialStatus = "sent";
  } else if (provider === "meta") {
    // Meta Cloud API dispatch
    const waToken = metaRecord.access_token;
    const waNumId = metaRecord.business_phone_number_id;

    const metaObj = buildMetaMessagePayload(type, normalizedTo, messagePayload);
    const metaResponse = await sendAPIMessage(metaObj, waNumId, waToken);

    if (!metaResponse?.success && !metaResponse?.data?.id) {
      return {
        success: false,
        error: "PROVIDER_ERROR",
        message: metaResponse?.message || "Failed to deliver message via Meta Cloud API.",
        statusCode: 502,
      };
    }

    providerMsgId = metaResponse?.data?.id || null;
    initialStatus = "sent";
  }

  // Persist message record to beta_api_logs and beta_conversation
  try {
    await query(
      `INSERT INTO beta_api_logs (uid, msg_id, request, response, status) VALUES (?, ?, ?, ?, ?)`,
      [
        uid,
        publicMsgId,
        JSON.stringify({
          to: normalizedTo,
          type,
          connection_id: connection.public_id,
          provider_msg_id: providerMsgId,
        }),
        JSON.stringify({ status: initialStatus, providerMsgId }),
        initialStatus,
      ]
    );

    // Also store reference in beta_conversation for inbox traceability
    const chatId = `${connection.phone_number || "api"}_${normalizedTo}_${uid}`;
    await query(
      `INSERT INTO beta_conversation 
       (chat_id, uid, type, status, metaChatId, senderMobile, route, origin, msgContext, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, 'OUTGOING', ?, ?, ?)`,
      [
        chatId,
        uid,
        type,
        initialStatus,
        publicMsgId,
        normalizedTo,
        provider,
        JSON.stringify(messagePayload),
        Math.floor(Date.now() / 1000).toString(),
      ]
    );
  } catch (logErr) {
    logger.error("Failed to log public message send:", logErr);
  }

  return {
    success: true,
    data: {
      id: publicMsgId,
      status: initialStatus,
      connection_id: connection.public_id,
      to: normalizedTo,
      provider: provider,
      created_at: new Date().toISOString(),
    },
    statusCode: 202,
  };
}

/**
 * Dispatch Meta Template Message
 * Strict restriction: QR connections CANNOT send Meta templates!
 */
async function dispatchPublicTemplateMessage({
  uid,
  apiKey,
  resolvedConn,
  recipient,
  templateName,
  languageCode = "en_US",
  components = [],
}) {
  const { provider, connection, metaRecord } = resolvedConn;

  // Strict Rule 20, Rule 47, Rule 107: QR connections cannot send Meta templates
  if (provider === "qr") {
    return {
      success: false,
      error: "TEMPLATE_NOT_SUPPORTED_BY_CONNECTION",
      message: "Meta WhatsApp templates are only supported by Meta Cloud API connections.",
      statusCode: 400,
    };
  }

  const normalizedTo = normalizePhoneNumber(recipient);
  if (!normalizedTo) {
    return {
      success: false,
      error: "INVALID_PHONE_NUMBER",
      message: "The provided recipient phone number is invalid.",
      statusCode: 400,
    };
  }

  const publicMsgId = generatePublicMessageId();
  const waToken = metaRecord.access_token;
  const waNumId = metaRecord.business_phone_number_id;

  const templatePayload = {
    to: normalizedTo,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: Array.isArray(components) ? components : [],
    },
  };

  const metaResponse = await sendAPIMessage(templatePayload, waNumId, waToken);

  if (!metaResponse?.success && !metaResponse?.data?.id) {
    return {
      success: false,
      error: "PROVIDER_ERROR",
      message: metaResponse?.message || "Failed to send template message via Meta Cloud API.",
      statusCode: 502,
    };
  }

  const providerMsgId = metaResponse?.data?.id || null;
  const initialStatus = "sent";

  try {
    await query(
      `INSERT INTO beta_api_logs (uid, msg_id, request, response, status) VALUES (?, ?, ?, ?, ?)`,
      [
        uid,
        publicMsgId,
        JSON.stringify({
          to: normalizedTo,
          type: "template",
          templateName,
          connection_id: connection.public_id,
          provider_msg_id: providerMsgId,
        }),
        JSON.stringify(metaResponse),
        initialStatus,
      ]
    );
  } catch (err) {
    logger.error("Failed to log template message send:", err);
  }

  return {
    success: true,
    data: {
      id: publicMsgId,
      status: initialStatus,
      connection_id: connection.public_id,
      to: normalizedTo,
      template: templateName,
      created_at: new Date().toISOString(),
    },
    statusCode: 202,
  };
}

/**
 * Retrieve message status by public ID (Tenant isolated)
 */
async function getPublicMessageStatus(publicMsgId, uid) {
  // Query beta_api_logs first
  const logRows = await query(
    `SELECT * FROM beta_api_logs WHERE msg_id = ? AND uid = ? LIMIT 1`,
    [publicMsgId, uid]
  );

  if (logRows.length > 0) {
    const row = logRows[0];
    let reqData = {};
    try {
      reqData = JSON.parse(row.request);
    } catch {}

    return {
      success: true,
      data: {
        id: row.msg_id,
        status: row.status || "accepted",
        connection_id: reqData.connection_id || null,
        to: reqData.to || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.createdAt || new Date().toISOString(),
      },
    };
  }

  // Check beta_conversation by metaChatId
  const convRows = await query(
    `SELECT * FROM beta_conversation WHERE metaChatId = ? AND uid = ? LIMIT 1`,
    [publicMsgId, uid]
  );

  if (convRows.length > 0) {
    const row = convRows[0];
    return {
      success: true,
      data: {
        id: row.metaChatId,
        status: row.status || "accepted",
        to: row.senderMobile || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.createdAt || new Date().toISOString(),
      },
    };
  }

  // Tenant isolation: if not found for this workspace, return 404
  return {
    success: false,
    error: "MESSAGE_NOT_FOUND",
    message: "Message not found or does not belong to this workspace.",
    statusCode: 404,
  };
}

module.exports = {
  generatePublicMessageId,
  normalizePhoneNumber,
  dispatchPublicMessage,
  dispatchPublicTemplateMessage,
  getPublicMessageStatus,
};
