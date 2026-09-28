const router = require("express").Router();
const { query } = require("../database/dbpromise.js");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  getFileExtension,
  sendMetaMsg,
  mergeArrays,
  sendMetatemplet,
  updateMetaTempletInMsg,
  getUserPlayDays,
  parseJson,
  handleWAFormSubmission,
  getCurrentTimestampInTimeZone,
  saveMessageToConversation,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const { getIOInstance, sendToUid } = require("../socket.js");
const { sendQrMsg, sendNewMessage } = require("../helper/socket/function.js");
const { checkPlan } = require("../middlewares/plan.js");
const { processMessage } = require("../helper/inbox/inbox.js");
const con = require("../database/config.js");
const { updateMessageStatus } = require("../loops/campaignBeta.js");
const logger = require("../utils/logger.js");
const fs = require("fs");
const path = require("path");
const { handleCalls } = require("../helper/addon/wacall/wacall.js");
const {
  handleBroadcastCallConnect,
  handleBroadcastCallTerminate,
  outgoingCallStates,
} = require("../helper/addon/wacall/broadcastProcessor.js");

const crypto = require("crypto");

function logToFile(label, data) {}

/**
 * Server-side HMAC-SHA256 signature verification for Meta WhatsApp Webhooks.
 */
async function verifyMetaSignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  const [web] = await query(
    `SELECT embed_app_sec FROM web_private LIMIT 1`,
    [],
  );
  const secret = web?.embed_app_sec || process.env.META_APP_SECRET;

  // If signature header is provided, or in production mode, enforce verification
  if (signature || process.env.NODE_ENV === "production" || secret) {
    if (!signature) {
      return { valid: false, reason: "Missing x-hub-signature-256 header" };
    }
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        return { valid: false, reason: "Meta app secret not configured in production" };
      }
      return { valid: true };
    }

    const payload = req.rawBody || JSON.stringify(req.body);
    const expectedSig =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const expectedBuf = Buffer.from(expectedSig, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");

    if (
      expectedBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, sigBuf)
    ) {
      return { valid: false, reason: "Signature mismatch" };
    }
  }

  return { valid: true };
}

// WhatsApp Webhook Verification
router.get("/embed/webhook/:uid", async (req, res) => {
  try {
    const [admin] = await query(`SELECT uid FROM admin LIMIT 1`);
    if (!admin) {
      return res.sendStatus(400);
    }

    const VERIFY_TOKEN = admin.uid;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (!mode || !token) {
      return res.sendStatus(400);
    }

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      logger.log("✅ WHATSAPP WEBHOOK VERIFIED");
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  } catch (err) {
    logger.error(err);
    return res.sendStatus(500);
  }
});

router.post("/embed/webhook/:uid", async (req, res) => {
  try {
    const sigCheck = await verifyMetaSignature(req);
    if (!sigCheck.valid) {
      logger.warn(`[Meta Webhook] Signature verification failed: ${sigCheck.reason}`);
      return res.status(403).json({ error: "Forbidden: Invalid signature" });
    }

    const body = req.body;
    res.sendStatus(200);

    const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses;

    // Handle message status updates
    if (req.body && req.body.entry) {
      for (const entry of req.body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.value && change.value.statuses) {
              for (const status of change.value.statuses) {
                if (status.id) {
                  await updateMessageStatus(status.id, status.status);

                  // Update beta_conversation status & broadcast to inbox socket
                  const [conv] = await query(
                    `SELECT id, chat_id, uid FROM beta_conversation WHERE metaChatId = ? LIMIT 1`,
                    [status.id],
                  );
                  if (conv) {
                    await query(
                      `UPDATE beta_conversation 
                       SET status = CASE 
                         WHEN status = 'read' THEN 'read'
                         WHEN status = 'delivered' AND ? = 'sent' THEN 'delivered'
                         ELSE ?
                       END 
                       WHERE id = ?`,
                      [status.status, status.status, conv.id],
                    );

                    sendToUid(
                      conv.uid,
                      {
                        chatId: conv.chat_id,
                        messageId: status.id,
                        status: status.status,
                        timestamp: Date.now(),
                      },
                      "message_status_update",
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    // updating API logs
    if (statuses?.length > 0) {
      const { status, id } = statuses[0];
      const errorData = JSON.stringify(body);

      if (status === "failed") {
        await query(
          `UPDATE beta_api_logs SET status = ?, err = ? WHERE msg_id = ?`,
          [status, errorData, id],
        );
      } else if (id) {
        await query(`UPDATE beta_api_logs SET status = ? WHERE msg_id = ?`, [
          status,
          id,
        ]);
      }
    }

    if (statuses?.length > 0) {
      const { status, id } = statuses[0];
      const errorData = JSON.stringify(body);

      if (status === "failed") {
        await query(
          `UPDATE beta_campaign_logs SET delivery_status = ?, error_message = ? WHERE meta_msg_id = ?`,
          [status, errorData, id],
        );
      } else if (id) {
        await query(
          `UPDATE beta_campaign_logs SET delivery_status = ? WHERE meta_msg_id = ?`,
          [status, id],
        );
      }
    }

    const changes = body?.entry[0]?.changes[0];
    const phoneNumId = changes?.value?.metadata?.phone_number_id;
    const wabaId = body?.entry[0]?.id;

    logToFile("EXTRACTED_IDS", { phoneNumId, wabaId });

    let userUID = null;

    if (phoneNumId) {
      logToFile("QUERYING_META_API", { wabaId, phoneNumId });

      const getMyMetaApi = await query(
        `SELECT * FROM meta_api WHERE business_phone_number_id = ?`,
        [phoneNumId],
      );

      logToFile("META_API_QUERY_RESULT", getMyMetaApi);

      if (!getMyMetaApi || getMyMetaApi.length < 1) {
        logToFile("BLOCKED", "No meta_api record found for this phoneNumId");
        return;
      }

      const matchedApi = getMyMetaApi[0];
      userUID = matchedApi.uid;

      logToFile("USER_UID_RESOLVED", { userUID });

      const getDays = await getUserPlayDays(userUID);
      logToFile("USER_PLAY_DAYS", { userUID, getDays });

      if (getDays < 1) {
        logToFile("BLOCKED", "User plan expired");
        return;
      }
    } else {
      logToFile(
        "BLOCKED",
        "phoneNumId is null/undefined — skipping user lookup",
      );
    }

    logToFile("USER_UID_FINAL", { userUID });

    if (!userUID) {
      logToFile("BLOCKED", "userUID is null — returning");
      return;
    }

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];

    if (!change) {
      logToFile("BLOCKED", "No change data found");
      return;
    }

    logToFile("CHANGE_FIELD", { field: change.field });

    switch (change.field) {
      case "messages":
        logToFile("PROCESSING", "Calling processMessage");
        await processMessage({
          body,
          uid: userUID,
          origin: "meta",
        });
        logToFile("PROCESSING", "processMessage done");

        // ✅ Handle WhatsApp Forms submission — added to match normal webhook
        await handleWAFormSubmission(change, userUID);
        logToFile("PROCESSING", "handleWAFormSubmission done");

        const messages = change.value?.messages || [];
        for (const message of messages) {
          if (
            message.type === "interactive" &&
            message.interactive?.type === "call_permission_reply"
          ) {
            const reply = message.interactive.call_permission_reply;
            const fromNumber = message.from;

            logToFile("CALL_PERMISSION_REPLY", { fromNumber, reply });

            if (reply.response === "accept") {
              await updateBroadcastContactPermission(
                fromNumber,
                "granted",
                reply,
              );
            } else if (reply.response === "reject") {
              await updateBroadcastContactPermission(
                fromNumber,
                "denied",
                reply,
              );
            }
          }
        }
        break;

      case "smb_message_echoes":
        await processMessage({ body, uid: userUID, origin: "meta_echo" });
        break;

      case "calls":
        const callEvents = change.value.calls || [];
        const callStatuses = change.value.statuses || [];

        for (const callEvent of callEvents) {
          const callId = callEvent.id;
          const callbackData = callEvent.biz_opaque_callback_data;

          logToFile("CALL_EVENT", {
            callId,
            event: callEvent.event,
            callbackData,
          });

          let isBroadcastCall = false;
          let parsedCallbackData = null;

          if (callbackData) {
            try {
              parsedCallbackData = JSON.parse(callbackData);
              isBroadcastCall = !!parsedCallbackData.campaign_id;
              logToFile("CALL_CALLBACK_PARSED", {
                callId,
                parsedCallbackData,
                isBroadcastCall,
              });
            } catch (e) {
              logToFile("CALL_CALLBACK_PARSE_ERROR", {
                callId,
                error: e.message,
              });
            }
          }

          if (isBroadcastCall) {
            logToFile("CALL_TYPE", { callId, type: "broadcast" });

            if (callEvent.event === "connect" && callEvent.session) {
              await handleBroadcastCallConnect(
                callId,
                callEvent.session,
                callbackData,
              );
            }

            if (callEvent.event === "terminate") {
              await handleBroadcastCallTerminate(
                callId,
                callEvent.status,
                callEvent.duration,
                callbackData,
              );
            }
          } else {
            logToFile("CALL_TYPE", { callId, type: "incoming" });
            await handleCalls(change, userUID, body);
          }
        }

        for (const status of callStatuses) {
          const callId = status.id;
          const isBroadcastCall = outgoingCallStates.has(callId);

          if (isBroadcastCall) {
            const callState = outgoingCallStates.get(callId);
            if (callState) {
              const { campaignId, contact } = callState;
              logToFile("CALL_STATUS_UPDATE", {
                callId,
                status: status.status,
              });

              if (status.status === "REJECTED") {
                await updateContactInBroadcast(campaignId, contact.mobile, {
                  call_status: "rejected",
                });
              }
            }
          }
        }
        break;

      default:
        logToFile("UNKNOWN_FIELD", { field: change.field });
        break;
    }
  } catch (err) {
    logToFile("FATAL_ERROR", { message: err.message, stack: err.stack });
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

router.post("/webhook/:uid", async (req, res) => {
  try {
    const sigCheck = await verifyMetaSignature(req);
    if (!sigCheck.valid) {
      logger.warn(`[Meta Webhook] Signature verification failed: ${sigCheck.reason}`);
      return res.status(403).json({ error: "Forbidden: Invalid signature" });
    }

    const body = req.body;
    const userUID = req.params.uid;

    // ✅ ACK immediately
    res.sendStatus(200);

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];

    if (!change) {
      logger.log("⚠️ No change data");
      return;
    }

    switch (change.field) {
      case "messages":
        await handleMessages(change, userUID, body);

        await handleWAFormSubmission(change, userUID);

        // Handle call permission replies for broadcasts
        const messages = change.value?.messages || [];
        for (const message of messages) {
          if (
            message.type === "interactive" &&
            message.interactive?.type === "call_permission_reply"
          ) {
            const reply = message.interactive.call_permission_reply;
            const fromNumber = message.from;

            if (reply.response === "accept") {
              await updateBroadcastContactPermission(
                fromNumber,
                "granted",
                reply,
              );
            } else if (reply.response === "reject") {
              await updateBroadcastContactPermission(
                fromNumber,
                "denied",
                reply,
              );
            }
          }
        }
        break;

      case "calls":
        const callEvents = change.value.calls || [];
        const statuses = change.value.statuses || [];

        for (const callEvent of callEvents) {
          const callId = callEvent.id;

          const callbackData = callEvent.biz_opaque_callback_data;

          logger.log(`🔍 [${callId}] Call event:`, callEvent.event);
          logger.log(`🔍 [${callId}] Callback data:`, callbackData);

          let isBroadcastCall = false;
          let parsedCallbackData = null;

          if (callbackData) {
            try {
              parsedCallbackData = JSON.parse(callbackData);
              isBroadcastCall = !!parsedCallbackData.campaign_id;
              logger.log(`🔍 [${callId}] Parsed callback:`, parsedCallbackData);
              logger.log(`🔍 [${callId}] Is broadcast call:`, isBroadcastCall);
            } catch (e) {
              logger.error(`[${callId}] Failed to parse callback data:`, e);
            }
          }

          if (isBroadcastCall) {
            logger.log(`📞 [${callId}] Handling as broadcast call`);

            if (callEvent.event === "connect" && callEvent.session) {
              logger.log(`📞 [${callId}] Broadcast call connect event`);
              await handleBroadcastCallConnect(
                callId,
                callEvent.session,
                callbackData,
              );
            }

            if (callEvent.event === "terminate") {
              logger.log(`📞 [${callId}] Broadcast call terminate event`);
              await handleBroadcastCallTerminate(
                callId,
                callEvent.status,
                callEvent.duration,
                callbackData,
              );
            }
          } else {
            logger.log(`📞 [${callId}] Handling as incoming call`);
            await handleCalls(change, userUID, body);
          }
        }

        for (const status of statuses) {
          const callId = status.id;
          const isBroadcastCall = outgoingCallStates.has(callId);

          if (isBroadcastCall) {
            const callState = outgoingCallStates.get(callId);
            if (callState) {
              const { campaignId, contact } = callState;

              logger.log(`📞 [${callId}] Status update:`, status.status);

              if (status.status === "REJECTED") {
                await updateContactInBroadcast(campaignId, contact.mobile, {
                  call_status: "rejected",
                });
              }
            }
          }
        }
        break;

      default:
        logger.log(`⚠️ Unknown field: ${change.field}`);
        break;
    }
  } catch (err) {
    logger.error("Webhook error:", err);
  }
});

// Helper function to update broadcast contact permission
async function updateBroadcastContactPermission(mobile, status, reply) {
  try {
    logger.log(`🔄 Updating permission for ${mobile} to ${status}...`);

    const broadcasts = await query(
      `SELECT * FROM wa_call_broadcasts WHERE status IN ('requesting_permissions', 'ready', 'running', 'draft')`,
    );

    let updated = false;

    for (const broadcast of broadcasts) {
      const contacts = JSON.parse(broadcast.contacts || "[]");
      const contactIndex = contacts.findIndex((c) => c.mobile === mobile);

      if (contactIndex !== -1) {
        if (
          ["pending", "requested"].includes(
            contacts[contactIndex].permission_status,
          )
        ) {
          contacts[contactIndex].permission_status = status;
          contacts[contactIndex].permission_granted_at =
            new Date().toISOString();

          if (status === "granted") {
            contacts[contactIndex].permission_type = reply.is_permanent
              ? "permanent"
              : "temporary";
            contacts[contactIndex].permission_expires_at =
              reply.expiration_timestamp
                ? new Date(reply.expiration_timestamp * 1000).toISOString()
                : null;
          }

          let statsUpdate = {};
          if (status === "granted") {
            statsUpdate.permission_granted =
              (broadcast.permission_granted || 0) + 1;
          } else if (status === "denied") {
            statsUpdate.permission_denied =
              (broadcast.permission_denied || 0) + 1;
          }

          let updateQuery = `UPDATE wa_call_broadcasts SET contacts = ?`;
          let updateParams = [JSON.stringify(contacts)];

          Object.keys(statsUpdate).forEach((key) => {
            updateQuery += `, ${key} = ?`;
            updateParams.push(statsUpdate[key]);
          });

          updateQuery += ` WHERE campaign_id = ?`;
          updateParams.push(broadcast.campaign_id);

          await query(updateQuery, updateParams);

          logger.log(
            `✅ Updated permission for ${mobile} in campaign ${broadcast.campaign_id}`,
          );

          updated = true;
        }
      }
    }

    if (!updated) {
      logger.log(`⚠️ No matching campaign found for ${mobile}`);
    }
  } catch (err) {
    logger.error("Error updating broadcast contact permission:", err);
  }
}

async function handleMessages(change, uid, body) {
  const value = change.value;

  // ✅ Check plan ONLY for messages
  const getDays = await getUserPlayDays(uid);
  if (getDays < 1) {
    logger.log("User plan expired");
    return;
  }

  // Handle message status updates
  const statuses = value?.statuses;

  if (statuses && statuses.length > 0) {
    for (const status of statuses) {
      if (status.id) {
        await updateMessageStatus(status.id, status.status);
      }
    }

    // Update API logs
    const { status, id } = statuses[0];
    const errorData = JSON.stringify(body);

    if (status === "failed") {
      await query(
        `UPDATE beta_api_logs SET status = ?, err = ? WHERE msg_id = ?`,
        [status, errorData, id],
      );
    } else if (id) {
      await query(`UPDATE beta_api_logs SET status = ? WHERE msg_id = ?`, [
        status,
        id,
      ]);
    }

    // Update campaign logs
    if (status === "failed") {
      await query(
        `UPDATE beta_campaign_logs SET delivery_status = ?, error_message = ? WHERE meta_msg_id = ?`,
        [status, errorData, id],
      );
    } else if (id) {
      await query(
        `UPDATE beta_campaign_logs SET delivery_status = ? WHERE meta_msg_id = ?`,
        [status, id],
      );
    }
  }

  // Verify phone number
  if (value?.metadata?.phone_number_id) {
    const getMyMetaApi = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      uid,
    ]);

    if (getMyMetaApi?.length > 0) {
      const checkNumber = value.metadata.phone_number_id;
      const myNumberId = getMyMetaApi[0]?.business_phone_number_id;

      if (checkNumber !== myNumberId) {
        logger.log("⚠️ Phone number mismatch");
        return;
      }
    }
  }

  // Save message
  await processMessage({
    body,
    uid,
    origin: "meta",
  });
}

// adding webhook
router.get("/webhook/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const queryParan = req.query;
    const body = req.body;

    const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [uid]);

    let verify_token = "";

    if (getUser.length < 1) {
      verify_token = "NULL";
      res.json({
        success: false,
        msg: "Token not verified",
        webhook: uid,
        token: "NOT FOUND",
      });
    } else {
      verify_token = uid;

      let mode = req.query["hub.mode"];
      let token = req.query["hub.verify_token"];
      let challenge = req.query["hub.challenge"];

      if (mode && token) {
        if (mode === "subscribe" && token === verify_token) {
          logger.log("WEBHOOK_VERIFIED");
          res.status(200).send(challenge);
        } else {
          res.sendStatus(403);
        }
      } else {
        res.json({
          success: false,
          msg: "Token not verified",
          webhook: uid,
          token: "FOUND",
        });
      }
    }
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// sending templets
router.post("/send_templet", validateUser, checkPlan, async (req, res) => {
  try {
    const { content, toName, toNumber, chatId, msgType, origin, accountType } = req.body;

    if (!content || !toName || !msgType) {
      return res.json({ success: false, msg: "Invalid request" });
    }

    // Server-side QR template restriction
    if (origin === "qr" || accountType === "qr") {
      return res.json({
        success: false,
        msg: "Templates are available only for Meta Cloud API WhatsApp connections.",
      });
    }

    if (chatId) {
      const [chat] = await query(
        `SELECT * FROM beta_chats WHERE chat_id = ? AND uid = ? LIMIT 1`,
        [chatId, req.decode.uid],
      );
      if (chat && chat.origin === "qr") {
        return res.json({
          success: false,
          msg: "Templates are available only for Meta Cloud API WhatsApp connections.",
        });
      }
    }

    const msgObj = content;

    const savObj = {
      type: msgType,
      metaChatId: "",
      msgContext: content,
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
    };

    const resp = await sendMetaMsg(
      req.decode.uid,
      msgObj,
      toNumber,
      savObj,
      chatId,
    );
    res.json(resp);
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// GET /api/inbox/get_chats (WhatsApp Web style paginated chat list)
router.get("/get_chats", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const {
      accountId = "",
      origin = "",
      search = "",
      filter = "all", // "all" | "unread" | "has_note"
      limit = 30,
      offset = 0,
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 50);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    const conditions = ["uid = ?"];
    const params = [uid];

    // Origin filter (when no specific account is selected)
    if (origin && origin !== "all" && (!accountId || accountId === "all")) {
      conditions.push("origin = ?");
      params.push(origin);
    }

    // Account scoping
    if (accountId && accountId !== "all") {
      let matchedInstance = null;
      let matchedMeta = null;

      const isNumericId = !isNaN(accountId) && /^\d+$/.test(accountId);
      const [qrInst] = await query(
        `SELECT id, uniqueId, number, status FROM instance WHERE uid = ? AND (uniqueId = ? OR id = ? OR number = ?) LIMIT 1`,
        [uid, accountId, isNumericId ? parseInt(accountId) : -1, accountId]
      );

      if (qrInst) {
        matchedInstance = qrInst;
      } else {
        const [metaInst] = await query(
          `SELECT id, business_phone_number_id, waba_id FROM meta_api WHERE uid = ? AND (business_phone_number_id = ? OR id = ? OR waba_id = ?) LIMIT 1`,
          [uid, accountId, isNumericId ? parseInt(accountId) : -1, accountId]
        );
        if (metaInst) {
          matchedMeta = metaInst;
        }
      }

      if (!matchedInstance && !matchedMeta) {
        return res.status(403).json({
          success: false,
          msg: "Unauthorized or invalid instance selected",
          chats: [],
          total: 0,
          hasMore: false,
          offset: parsedOffset,
          limit: parsedLimit,
        });
      }

      // Gate: QR instance must be ACTIVE — disconnected instances show no chats
      if (matchedInstance && matchedInstance.status !== "ACTIVE") {
        return res.json({
          success: true,
          chats: [],
          data: [],
          total: 0,
          hasMore: false,
          offset: parsedOffset,
          limit: parsedLimit,
          disconnected: true,
        });
      }

      if (matchedMeta) {
        const busId = matchedMeta.business_phone_number_id || "";
        const wabaId = matchedMeta.waba_id || "";
        conditions.push("(origin = 'meta' AND (origin_instance_id LIKE ? OR origin_instance_id LIKE ? OR chat_id LIKE 'meta_%'))");
        params.push(`%"${busId}%`, `%"${wabaId}%`);
      } else if (matchedInstance) {
        if (matchedInstance.number) {
          const cleanNum = matchedInstance.number.replace(/[^0-9]/g, "");
          conditions.push("(origin = 'qr' AND (chat_id LIKE ? OR origin_instance_id LIKE ? OR origin_instance_id LIKE ?))");
          params.push(`${cleanNum}_%`, `%"${cleanNum}%`, `%"${matchedInstance.uniqueId}%`);
        } else {
          conditions.push("1 = 0");
        }
      }
    } else {
      // "All Connections" mode: Only show QR chats from ACTIVE instances.
      // Meta chats always show (Cloud API is stateless — no live socket needed).
      const activeInstances = await query(
        `SELECT number, uniqueId FROM instance WHERE uid = ? AND status = 'ACTIVE'`,
        [uid]
      );

      if (activeInstances.length === 0) {
        // No connected QR instances — only show Meta/Telegram/other non-QR chats
        conditions.push("(origin != 'qr')");
      } else {
        // Build a number-match filter for each active QR instance
        const qrOrParts = activeInstances
          .filter((i) => i.number)
          .map(() => "(origin = 'qr' AND (chat_id LIKE ? OR origin_instance_id LIKE ? OR origin_instance_id LIKE ?))")
          .join(" OR ");

        const qrParams = [];
        activeInstances.filter((i) => i.number).forEach((i) => {
          const cleanNum = i.number.replace(/[^0-9]/g, "");
          qrParams.push(`${cleanNum}_%`, `%"${cleanNum}%`, `%"${i.uniqueId}%`);
        });

        if (qrOrParts) {
          conditions.push(`(origin != 'qr' OR (${qrOrParts}))`);
          params.push(...qrParams);
        } else {
          conditions.push("(origin != 'qr')");
        }
      }
    }

    // Tab filter
    if (filter === "unread") {
      conditions.push("unread_count > 0");
    } else if (filter === "has_note") {
      conditions.push("(chat_note IS NOT NULL AND chat_note != '' AND chat_note != '[]')");
    }

    // Search filter
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push("(sender_name LIKE ? OR sender_mobile LIKE ? OR last_message LIKE ? OR chat_label LIKE ?)");
      params.push(s, s, s, s);
    }

    const whereClause = conditions.join(" AND ");

    const [totalRow] = await query(
      `SELECT COUNT(*) as total FROM beta_chats WHERE ${whereClause}`,
      params,
    );
    const total = totalRow?.total || 0;

    const chats = await query(
      `SELECT * FROM beta_chats WHERE ${whereClause} ORDER BY updatedAt DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, parsedLimit, parsedOffset],
    );

    // Efficiently match contact phonebook without querying whole table
    const senderMobiles = Array.from(new Set(chats.map((c) => c.sender_mobile).filter(Boolean)));
    let contactsMap = {};
    if (senderMobiles.length > 0) {
      const placeholders = senderMobiles.map(() => "?").join(",");
      const contacts = await query(
        `SELECT id, name, mobile, phonebook_name FROM contact WHERE uid = ? AND mobile IN (${placeholders})`,
        [uid, ...senderMobiles],
      );
      contacts.forEach((ct) => {
        contactsMap[ct.mobile] = ct;
      });
    }

    const enrichedChats = chats.map((c) => {
      let parsedLastMsg = null;
      if (c.last_message) {
        try {
          parsedLastMsg = typeof c.last_message === "string" ? JSON.parse(c.last_message) : c.last_message;
        } catch {
          parsedLastMsg = c.last_message;
        }
      }
      return {
        ...c,
        last_message: parsedLastMsg,
        contactData: contactsMap[c.sender_mobile] || null,
      };
    });

    res.json({
      success: true,
      chats: enrichedChats,
      data: enrichedChats,
      total,
      hasMore: parsedOffset + chats.length < total,
      offset: parsedOffset,
      limit: parsedLimit,
    });
  } catch (err) {
    logger.error("get_chats error:", err);
    res.json({ success: false, msg: "Failed to load conversations" });
  }
});

// GET /api/inbox/get_messages (WhatsApp Web style paginated messages)
router.get("/get_messages", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const {
      chat_id,
      limit = 30,
      offset = 0,
      before = null,
    } = req.query;

    if (!chat_id) {
      return res.json({ success: false, msg: "chat_id is required" });
    }

    // Verify conversation ownership
    const [chat] = await query(
      `SELECT id, chat_id, sender_name, sender_mobile, origin, chat_label, chat_note, unread_count 
       FROM beta_chats WHERE chat_id = ? AND uid = ? LIMIT 1`,
      [chat_id, uid],
    );

    if (!chat) {
      return res.status(404).json({ success: false, msg: "Conversation not found" });
    }

    // Mark unread as 0
    if (chat.unread_count > 0) {
      await query(`UPDATE beta_chats SET unread_count = 0 WHERE chat_id = ? AND uid = ?`, [chat_id, uid]);
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 50);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    const conditions = ["chat_id = ?", "uid = ?"];
    const params = [chat_id, uid];

    if (before) {
      conditions.push("timestamp < ?");
      params.push(String(before));
    }

    const whereClause = conditions.join(" AND ");

    const [totalRow] = await query(
      `SELECT COUNT(*) as total FROM beta_conversation WHERE chat_id = ? AND uid = ?`,
      [chat_id, uid],
    );
    const total = totalRow?.total || 0;

    // Fetch messages (DESC: newest first in DB query for pagination slice)
    const messages = await query(
      `SELECT * FROM beta_conversation WHERE ${whereClause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, parsedLimit, parsedOffset],
    );

    // Parse JSON contexts
    const parsedMessages = messages.map((m) => {
      let ctx = m.msgContext;
      if (typeof ctx === "string") {
        try { ctx = JSON.parse(ctx); } catch {}
      }
      let cContext = m.context;
      if (typeof cContext === "string") {
        try { cContext = JSON.parse(cContext); } catch {}
      }
      return {
        ...m,
        msgContext: ctx,
        context: cContext,
      };
    });

    // Reverse to chronological order (oldest first, newest at bottom)
    const chronologicalMessages = [...parsedMessages].reverse();

    // Get contact info if available
    const [contact] = await query(
      `SELECT * FROM contact WHERE uid = ? AND mobile = ? LIMIT 1`,
      [uid, chat.sender_mobile],
    );

    res.json({
      success: true,
      messages: chronologicalMessages,
      data: chronologicalMessages,
      chatInfo: {
        ...chat,
        contactData: contact || null,
      },
      total,
      hasMore: parsedOffset + messages.length < total,
      offset: parsedOffset,
      limit: parsedLimit,
    });
  } catch (err) {
    logger.error("get_messages error:", err);
    res.json({ success: false, msg: "Failed to load messages" });
  }
});

// POST /api/inbox/check_conversation (Verify if contact already has a conversation or prepare new one)
router.post("/check_conversation", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { accountId, accountType = "qr", mobile, name } = req.body;

    if (!mobile) {
      return res.json({ success: false, msg: "Phone number is required" });
    }

    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (!cleanMobile || cleanMobile.length < 7) {
      return res.json({ success: false, msg: "Invalid phone number" });
    }

    // Look for existing chat
    let existingChat = null;

    if (accountType === "qr" && accountId) {
      let cleanAcc = accountId.replace(/[^0-9]/g, "");
      const isNum = !isNaN(accountId) && /^\d+$/.test(accountId);
      const [inst] = await query(
        `SELECT number, uniqueId FROM instance WHERE uid = ? AND (uniqueId = ? OR id = ? OR number = ?) LIMIT 1`,
        [uid, accountId, isNum ? parseInt(accountId) : -1, accountId]
      );
      if (inst && inst.number) {
        cleanAcc = inst.number.replace(/[^0-9]/g, "");
      }
      const targetChatId = `${cleanAcc}_${cleanMobile}_${uid}`;
      const [found] = await query(
        `SELECT * FROM beta_chats WHERE (chat_id = ? OR (sender_mobile = ? AND origin = 'qr' AND chat_id LIKE ?)) AND uid = ? LIMIT 1`,
        [targetChatId, cleanMobile, `${cleanAcc}_%`, uid],
      );
      existingChat = found;
    } else if (accountType === "meta") {
      const metaChatId = `meta_${cleanMobile}`;
      const [found] = await query(
        `SELECT * FROM beta_chats WHERE (chat_id = ? OR (sender_mobile = ? AND origin = 'meta')) AND uid = ? LIMIT 1`,
        [metaChatId, cleanMobile, uid],
      );
      existingChat = found;
    } else {
      const [found] = await query(
        `SELECT * FROM beta_chats WHERE sender_mobile = ? AND uid = ? LIMIT 1`,
        [cleanMobile, uid],
      );
      existingChat = found;
    }

    if (existingChat) {
      const [contact] = await query(
        `SELECT * FROM contact WHERE uid = ? AND mobile = ? LIMIT 1`,
        [uid, existingChat.sender_mobile],
      );
      existingChat.contactData = contact || null;

      return res.json({
        success: true,
        exists: true,
        chat: existingChat,
      });
    }

    // Chat does not exist yet. Generate candidate chat_id
    let candidateChatId = "";
    if (accountType === "qr") {
      let cleanAcc = (accountId || "").replace(/[^0-9]/g, "");
      const isNum = !isNaN(accountId) && /^\d+$/.test(accountId);
      const [inst] = await query(
        `SELECT number, uniqueId FROM instance WHERE uid = ? AND (uniqueId = ? OR id = ? OR number = ?) LIMIT 1`,
        [uid, accountId, isNum ? parseInt(accountId) : -1, accountId]
      );
      if (inst && inst.number) {
        cleanAcc = inst.number.replace(/[^0-9]/g, "");
      }
      candidateChatId = `${cleanAcc}_${cleanMobile}_${uid}`;
    } else {
      candidateChatId = `meta_${cleanMobile}`;
    }

    const [contact] = await query(
      `SELECT * FROM contact WHERE uid = ? AND mobile = ? LIMIT 1`,
      [uid, cleanMobile],
    );

    const newChatDraft = {
      chat_id: candidateChatId,
      sender_name: name || contact?.name || cleanMobile,
      sender_mobile: cleanMobile,
      origin: accountType,
      unread_count: 0,
      contactData: contact || null,
      isNew: true,
    };

    return res.json({
      success: true,
      exists: false,
      chat: newChatDraft,
    });
  } catch (err) {
    logger.error("check_conversation error:", err);
    res.json({ success: false, msg: "Failed to check conversation" });
  }
});

// POST /api/inbox/send_message (Send a message via REST)
router.post("/send_message", validateUser, checkPlan, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { chat_id, message, type = "text", media_url, caption = "", accountId } = req.body;

    if (!chat_id || (!message && !media_url)) {
      return res.status(400).json({ success: false, msg: "Message or media content is required" });
    }

    let [chat] = await query(
      `SELECT * FROM beta_chats WHERE chat_id = ? AND uid = ? LIMIT 1`,
      [chat_id, uid],
    );

    const [user] = await query(`SELECT * FROM user WHERE uid = ?`, [uid]);
    const userTimezone = getCurrentTimestampInTimeZone(user?.timezone || "Asia/Kolkata");

    let msgCon = null;
    if (type === "text") {
      msgCon = { type: "text", text: { body: message.trim(), preview_url: true } };
    } else if (type === "image") {
      msgCon = { type: "image", image: { link: media_url, caption: caption.trim() } };
    } else if (type === "video") {
      msgCon = { type: "video", video: { link: media_url, caption: caption.trim() } };
    } else if (type === "audio") {
      msgCon = { type: "audio", audio: { link: media_url } };
    } else if (type === "document") {
      msgCon = { type: "document", document: { link: media_url, caption: caption.trim() } };
    } else {
      msgCon = { type: "text", text: { body: message?.trim() || "" } };
    }

    let sendResult = null;
    let targetOrigin = chat?.origin || (chat_id.startsWith("meta_") ? "meta" : "qr");
    let targetMobile = chat?.sender_mobile;

    if (!targetMobile) {
      // Derive from chat_id
      if (chat_id.startsWith("meta_")) {
        targetMobile = chat_id.replace("meta_", "");
      } else {
        const parts = chat_id.split("_");
        if (parts.length >= 2) targetMobile = parts[1];
      }
    }

    if (targetOrigin === "qr") {
      if (chat) {
        sendResult = await sendQrMsg({
          uid,
          to: targetMobile,
          msgObj: msgCon,
          chatInfo: chat,
        });
      } else {
        // New conversation: resolve instance uniqueId
        const isNum = !isNaN(accountId) && /^\d+$/.test(accountId);
        const [inst] = await query(
          `SELECT * FROM instance WHERE uid = ? AND (number = ? OR uniqueId = ? OR id = ?) LIMIT 1`,
          [uid, accountId, accountId, isNum ? parseInt(accountId) : -1],
        );
        if (!inst) {
          return res.status(400).json({ success: false, msg: "WhatsApp session not found" });
        }
        sendResult = await sendNewMessage({
          sessionId: inst.uniqueId,
          message: message?.trim() || caption?.trim() || "Media",
          number: targetMobile,
        });
      }
    } else if (targetOrigin === "meta") {
      sendResult = await sendMetaMsg(
        uid,
        msgCon,
        targetMobile,
        {
          type,
          metaChatId: "",
          msgContext: msgCon,
          reaction: "",
          timestamp: userTimezone,
          senderName: "Me",
          senderMobile: targetMobile,
          status: "sent",
          star: false,
          route: "OUTGOING",
        },
        chat_id,
      );
    } else {
      return res.status(400).json({ success: false, msg: `Sending not supported for channel: ${targetOrigin}` });
    }

    if (!sendResult || (!sendResult.success && !sendResult.id && !sendResult.messages)) {
      return res.status(400).json({
        success: false,
        msg: sendResult?.msg || "Failed to send message via provider",
      });
    }

    const msgId = sendResult.id || sendResult?.messages?.[0]?.id || "";

    const messageData = {
      type,
      metaChatId: msgId,
      msgContext: msgCon,
      reaction: "",
      timestamp: String(Math.floor(Date.now() / 1000)),
      senderName: "Me",
      senderMobile: targetMobile,
      star: 0,
      route: "OUTGOING",
      status: "sent",
      context: null,
      origin: targetOrigin,
    };

    await saveMessageToConversation({
      uid,
      chatId: chat_id,
      messageData,
      sentBy: "human",
    });

    if (chat) {
      await query(
        `UPDATE beta_chats SET last_message = ?, updatedAt = NOW() WHERE chat_id = ? AND uid = ?`,
        [JSON.stringify(messageData), chat_id, uid],
      );
    } else {
      await query(
        `INSERT INTO beta_chats (uid, origin_instance_id, chat_id, last_message, sender_name, sender_mobile, origin) VALUES (?,?,?,?,?,?,?)`,
        [
          uid,
          JSON.stringify(sendResult?.sessionData?.user || { id: targetMobile }),
          chat_id,
          JSON.stringify(messageData),
          targetMobile,
          targetMobile,
          targetOrigin,
        ],
      );
    }

    // Notify sockets
    sendToUid(uid, { chatId: chat_id, message: messageData }, "new_message");
    sendToUid(uid, { chatId: chat_id }, "request_update_chat_list");
    sendToUid(
      uid,
      {
        chatId: chat_id,
        messageId: msgId,
        status: "sent",
        timestamp: Date.now(),
      },
      "message_status_update",
    );

    res.json({
      success: true,
      message: messageData,
    });
  } catch (err) {
    logger.error("send_message error:", err);
    res.status(500).json({ success: false, msg: "Failed to dispatch message" });
  }
});

function groupChatsByNumberArrayFormat(chats) {
  const groupedChats = [];

  chats.forEach((chat) => {
    const number = chat.number;

    const existingGroup = groupedChats.find(
      (group) => group.instance === number,
    );

    if (existingGroup) {
      existingGroup.array.push(chat);
    } else {
      groupedChats.push({
        instance: number,
        array: [chat],
      });
    }
  });

  return groupedChats;
}

module.exports = router;

