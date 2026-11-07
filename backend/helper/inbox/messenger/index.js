const { prisma } = require("../../../database/prisma");
const { bigOrNull, plain, str, toData, whereStr } = require("../../../database/prismaHelpers");
const randomstring = require("randomstring");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const mime = require("mime-types");
const logger = require("../../../utils/logger");

const API_VERSION = "v21.0";

function getCurrentTimestamp() {
  return Math.round(Date.now() / 1000);
}

async function downloadAndSaveMedia(mediaUrl, accessToken) {
  try {
    const response = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
    });
    const contentType = response.headers["content-type"] || "image/jpeg";
    const ext = mime.extension(contentType) || "jpg";
    const fileName = `${randomstring.generate(10)}_msng.${ext}`;
    const filePath = path.resolve(
      __dirname,
      "../../../client/public/meta-media",
      fileName,
    );
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, response.data);
    return fileName;
  } catch (err) {
    logger.error("Messenger media download error:", err.message);
    return null;
  }
}

async function updateChatInMysql({
  chatId,
  uid,
  senderName,
  senderMobile,
  actualMsg,
  account,
}) {
  try {
    const allowedTypes = ["text", "image", "video", "audio", "document"];
    const isIncoming = actualMsg?.route === "INCOMING";

    const [chat] = plain(await prisma.beta_chats.findMany({
      where: { chat_id: whereStr(chatId), uid: whereStr(uid) },
      select: { unread_count: true },
      take: 1,
    }));

    const last_message = JSON.stringify(actualMsg);
    const sender_name = senderName || "Messenger User";
    const sender_mobile = senderMobile || "NA";
    const origin = "messenger";
    const origin_instance_id = JSON.stringify({
      id: account.page_id,
      name: account.page_name,
    });

    let unread_count = 0;
    if (isIncoming && allowedTypes.includes(actualMsg?.type)) {
      unread_count = chat?.unread_count ? chat.unread_count + 1 : 1;
    }

    if (chat) {
      const data = {
        last_message: str(last_message),
        sender_name: str(sender_name),
        sender_mobile: str(sender_mobile),
        origin,
        origin_instance_id,
      };
      if (unread_count > 0) data.unread_count = BigInt(unread_count);
      await prisma.beta_chats.updateMany({
        where: { chat_id: whereStr(chatId), uid: whereStr(uid) },
        data,
      });
    } else {
      await prisma.beta_chats.create({
        data: {
          uid: str(uid),
          chat_id: str(chatId),
          last_message: str(last_message),
          sender_name: str(sender_name),
          sender_mobile: str(sender_mobile),
          origin: str(origin),
          origin_instance_id: str(origin_instance_id),
          unread_count: bigOrNull(unread_count),
          assigned_agent: null,
        },
      });
    }
  } catch (err) {
    logger.error("Messenger updateChatInMysql error:", err);
  }
}

async function saveMessageToConversation({ uid, chatId, messageData }) {
  try {
    await prisma.beta_conversation.create({ data: toData("beta_conversation", {
      type: messageData.type,
      metaChatId: messageData.metaChatId,
      msgContext: JSON.stringify(messageData.msgContext),
      reaction: messageData.reaction || "",
      timestamp: messageData.timestamp,
      senderName: messageData.senderName,
      senderMobile: messageData.senderMobile,
      star: messageData.star ? 1 : 0,
      route: messageData.route,
      context: messageData.context ? JSON.stringify(messageData.context) : null,
      origin: "messenger",
      uid,
      chat_id: chatId,
      status: messageData.status || "",
      createdAt: new Date(),
    }) });
    return true;
  } catch (err) {
    logger.error("Messenger saveMessageToConversation error:", err);
    return false;
  }
}

async function processMessengerMessage({ body, uid }) {
  try {
    if (body.object !== "page") return null;

    const entry = body?.entry?.[0];
    if (!entry) return null;

    const pageId = String(entry.id);

    const [account] = plain(await prisma.messenger_accounts.findMany({ where: { page_id: whereStr(pageId) }, take: 1 }));
    if (!account) return null;

    const resolvedUid = account.uid;
    const messagingEvents = entry?.messaging || [];
    if (messagingEvents.length === 0) return null;

    let lastResult = null;

    for (const event of messagingEvents) {
      // Read receipt
      if (event.read) {
        const watermark = event.read?.watermark;
        if (watermark) {
          await prisma.beta_conversation.updateMany({
            where: {
              uid: whereStr(resolvedUid),
              origin: "messenger",
              route: "OUTGOING",
              timestamp: { lte: whereStr(Math.round(watermark / 1000)) },
              status: "sent",
            },
            data: { status: "read" },
          });
        }
        continue;
      }

      // Delivery receipt
      if (event.delivery) {
        const watermark = event.delivery?.watermark;
        if (watermark) {
          await prisma.beta_conversation.updateMany({
            where: {
              uid: whereStr(resolvedUid),
              origin: "messenger",
              route: "OUTGOING",
              timestamp: { lte: whereStr(Math.round(watermark / 1000)) },
              status: "sent",
            },
            data: { status: "delivered" },
          });
        }
        continue;
      }

      if (!event.message) continue;

      const message = event.message;
      const senderId = event?.sender?.id;
      const recipientId = event?.recipient?.id;

      if (!senderId) continue;

      const rawTs = event?.timestamp || Date.now();
      const timestamp = rawTs > 9999999999 ? Math.floor(rawTs / 1000) : rawTs;

      const myPageId = account.page_id;
      const isOutgoing = String(senderId) === String(myPageId);
      const route = isOutgoing ? "OUTGOING" : "INCOMING";
      const otherPersonId = isOutgoing ? recipientId : senderId;

      const chatId = `msng_${otherPersonId}`;
      const senderName = isOutgoing
        ? account.page_name || "Me"
        : `msng_${otherPersonId}`;
      const senderMobile = otherPersonId;

      // Duplicate check
      const msgId = message.mid;
      if (msgId) {
        const [existing] = plain(await prisma.beta_conversation.findMany({
          where: { metaChatId: whereStr(msgId), uid: whereStr(resolvedUid) },
          select: { id: true },
          take: 1,
        }));
        if (existing) continue;
      }

      // Build msgContext
      let msgContext = null;
      let msgType = "text";

      if (message.text && !message.attachments) {
        msgType = "text";
        msgContext = {
          type: "text",
          text: { body: message.text, preview_url: true },
        };
      } else if (message.attachments && message.attachments.length > 0) {
        const att = message.attachments[0];
        const attType = att.type;

        if (attType === "image") {
          msgType = "image";
          const mediaUrl = att.payload?.url;
          let fileName = null;
          if (mediaUrl) {
            fileName = await downloadAndSaveMedia(
              mediaUrl,
              account.page_access_token,
            );
          }
          msgContext = {
            type: "image",
            image: {
              link: fileName
                ? `${process.env.FRONTENDURI}/meta-media/${fileName}`
                : mediaUrl || "",
              caption: "",
            },
          };
        } else if (attType === "video") {
          msgType = "video";
          const mediaUrl = att.payload?.url;
          let fileName = null;
          if (mediaUrl) {
            fileName = await downloadAndSaveMedia(
              mediaUrl,
              account.page_access_token,
            );
          }
          msgContext = {
            type: "video",
            video: {
              link: fileName
                ? `${process.env.FRONTENDURI}/meta-media/${fileName}`
                : mediaUrl || "",
              caption: "",
            },
          };
        } else if (attType === "audio") {
          msgType = "audio";
          const mediaUrl = att.payload?.url;
          let fileName = null;
          if (mediaUrl) {
            fileName = await downloadAndSaveMedia(
              mediaUrl,
              account.page_access_token,
            );
          }
          msgContext = {
            type: "audio",
            audio: {
              link: fileName
                ? `${process.env.FRONTENDURI}/meta-media/${fileName}`
                : mediaUrl || "",
            },
          };
        } else if (attType === "file") {
          msgType = "document";
          const mediaUrl = att.payload?.url;
          let fileName = null;
          if (mediaUrl) {
            fileName = await downloadAndSaveMedia(
              mediaUrl,
              account.page_access_token,
            );
          }
          msgContext = {
            type: "document",
            document: {
              link: fileName
                ? `${process.env.FRONTENDURI}/meta-media/${fileName}`
                : mediaUrl || "",
              caption: att.payload?.title || "",
            },
          };
        } else {
          msgType = "text";
          const fallbackTitle = att.payload?.title || "Shared content";
          const fallbackUrl = att.payload?.url || "";
          msgContext = {
            type: "text",
            text: {
              body: fallbackUrl
                ? `${fallbackTitle}: ${fallbackUrl}`
                : fallbackTitle,
              preview_url: true,
            },
          };
        }
      } else if (message.is_deleted) {
        await prisma.beta_conversation.updateMany({
          where: { metaChatId: whereStr(msgId), uid: whereStr(resolvedUid) },
          data: { status: "deleted" },
        });
        continue;
      }

      if (!msgContext) continue;

      const newMessage = {
        type: msgType,
        metaChatId: msgId || `msng_${randomstring.generate(12)}`,
        msgContext,
        reaction: "",
        timestamp,
        senderName,
        senderMobile,
        status: isOutgoing ? "sent" : "",
        star: false,
        route,
        context: null,
        origin: "messenger",
      };

      await saveMessageToConversation({
        uid: resolvedUid,
        chatId,
        messageData: newMessage,
      });
      await updateChatInMysql({
        chatId,
        uid: resolvedUid,
        senderName,
        senderMobile,
        actualMsg: newMessage,
        account,
      });

      lastResult = {
        newMessage,
        chatId,
        sessionId: account.page_id,
      };
    }

    return lastResult;
  } catch (err) {
    logger.error("processMessengerMessage error:", err);
    return null;
  }
}

module.exports = { processMessengerMessage };
