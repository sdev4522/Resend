const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { plain, idParam, str, whereStr } = require("../database/prismaHelpers");

// Agent rows must never leave the server with their password hash
function withoutPassword(agent) {
  if (!agent) return agent;
  const { password, ...rest } = plain(agent);
  return rest;
}

// Owner-scoped toggle of an agent flag (was: any user could toggle any agent by uid)
async function setOwnedAgentFlag(ownerUid, agentUid, field, activeness) {
  return prisma.agents.updateMany({
    where: { uid: whereStr(agentUid), owner_uid: ownerUid },
    data: { [field]: activeness ? 1 : 0 },
  });
}
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  getFileExtension,
  getBusinessPhoneNumber,
  createMetaTemplet,
  getAllTempletsMeta,
  delMetaTemplet,
  getFileInfo,
  getSessionUploadMediaMeta,
  uploadFileMeta,
  updateUserPlan,
  getUserOrderssByMonth,
  sendEmail,
  fetchProfileFun,
  mergeArrays,
  readJSONFile,
  sendMetaMsg,
  removeTokenFromAll,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const { authRateLimiter } = require("../middlewares/rateLimiter.js");
const validateAgent = require("../middlewares/agent.js");
const Stripe = require("stripe");
const {
  checkPlan,
  checkNote,
  checkTags,
  checkContactLimit,
} = require("../middlewares/plan.js");
const { recoverEmail } = require("../emails/returnEmails.js");
const moment = require("moment");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const fs = require("fs");
const logger = require("../utils/logger.js");
const { convertOwnedAudio } = require("../helper/audioConvert.js");

// adding agent
router.post("/add_agent", validateUser, checkPlan, async (req, res) => {
  try {
    const { name, password, email, mobile, comments } = req.body;

    if (!name || !password || !email || !mobile) {
      return res.json({
        msg: "Please fill all the details",
      });
    }

    if (!isValidEmail(email)) {
      return res.json({ msg: "Please enter a valid email" });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.json({ msg: "Password must be at least 8 characters" });
    }

    // check if already
    const getUser = await prisma.agents.findFirst({
      where: { email: email?.toLowerCase() },
      select: { id: true },
    });

    if (getUser) {
      return res.json({
        msg: "This email is already used by you or someone else on the platform, Please choose another email",
      });
    }

    const hashPass = await bcrypt.hash(password, 10);

    const uid = randomstring.generate();

    await prisma.agents.create({
      data: {
        owner_uid: req.decode.uid,
        uid,
        email: email?.toLowerCase(),
        password: hashPass,
        name: str(name),
        mobile: str(mobile),
        comments: str(comments),
      },
    });

    res.json({
      msg: "Agent account was created",
      success: true,
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get all agents
router.get("/get_my_agents", validateUser, async (req, res) => {
  try {
    const agents = await prisma.agents.findMany({
      where: { owner_uid: req.decode.uid },
    });

    res.json({ data: agents.map(withoutPassword), success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// change status mask number
router.post("/change_status_mask", validateUser, async (req, res) => {
  try {
    const { agentUid, activeness } = req.body;

    await setOwnedAgentFlag(req.decode.uid, agentUid, "mask_number", activeness);

    res.json({
      success: true,
      msg: "Success",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// change status mask number
router.post("/change_status_allow_send", validateUser, async (req, res) => {
  try {
    const { agentUid, activeness } = req.body;

    await setOwnedAgentFlag(req.decode.uid, agentUid, "allow_send_new_qr", activeness);

    res.json({
      success: true,
      msg: "Success",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// change agent activeness
router.post("/change_agent_activeness", validateUser, async (req, res) => {
  try {
    const { agentUid, activeness } = req.body;

    await setOwnedAgentFlag(req.decode.uid, agentUid, "is_active", activeness);

    res.json({
      success: true,
      msg: "Success",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// del user
router.post("/del_agent", validateUser, async (req, res) => {
  try {
    const { uid } = req.body;
    await prisma.agents.deleteMany({
      where: { uid: whereStr(uid), owner_uid: req.decode.uid },
    });

    res.json({
      success: true,
      msg: "Agent was deleted",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get agent chats by owner
router.post("/get_agent_chats_owner", validateUser, async (req, res) => {
  try {
    const { uid } = req.body;

    // former `agent_chats JOIN chats ON chat_id`; on duplicate column names mysql2 kept
    // the chats value, so chats fields are spread last
    const assignments = await prisma.agent_chats.findMany({
      where: { owner_uid: req.decode.uid },
    });
    const chatIds = [...new Set(assignments.map((a) => a.chat_id).filter(Boolean))];
    const chatRows = chatIds.length
      ? await prisma.chats.findMany({
          where: { chat_id: { in: chatIds }, uid: req.decode.uid },
        })
      : [];
    const chatsById = new Map();
    chatRows.forEach((c) => {
      if (!chatsById.has(c.chat_id)) chatsById.set(c.chat_id, []);
      chatsById.get(c.chat_id).push(c);
    });
    const data = [];
    assignments.forEach((a) => {
      (chatsById.get(a.chat_id) || []).forEach((c) => data.push({ ...plain(a), ...plain(c) }));
    });

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get chat assisgn agent
router.post("/get_assigned_chat_agent", validateUser, async (req, res) => {
  try {
    const { chatId } = req.body;

    let data;

    data = plain(
      await prisma.agent_chats.findMany({
        where: { chat_id: whereStr(chatId), owner_uid: req.decode.uid },
      }),
    );

    if (data.length > 0) {
      const agent = await prisma.agents.findFirst({
        where: { uid: whereStr(data[0]?.uid), owner_uid: req.decode.uid },
      });
      data[0] = {
        ...withoutPassword(agent),
        chat_id: data[0].chat_id,
        owner_uid: data[0].owner_uid,
      };
    } else {
      data = {};
    }

    res.json({ data: data[0], success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// update agent in chat

// update agent in chat
router.post("/update_agent_in_chat", validateUser, async (req, res) => {
  try {
    const { assignAgent, chatId, agentUid } = req.body;

    const removeAssignment = prisma.agent_chats.deleteMany({
      where: { owner_uid: req.decode.uid, chat_id: whereStr(chatId) },
    });

    if (assignAgent?.email) {
      await prisma.$transaction([
        removeAssignment,
        prisma.agent_chats.create({
          data: { owner_uid: req.decode.uid, uid: str(assignAgent?.uid), chat_id: str(chatId) },
        }),
      ]);
    } else {
      await removeAssignment;
    }

    res.json({ msg: "Updated", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// deleted assign chat
router.post("/del_assign_chat_by_owner", validateUser, async (req, res) => {
  try {
    const { uid, chat_id } = req.body;

    logger.log(req.body);

    await prisma.agent_chats.deleteMany({
      where: { owner_uid: req.decode.uid, uid: whereStr(uid), chat_id: whereStr(chat_id) },
    });

    res.json({ msg: "Chat was removed from the agent", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

router.post("/login", authRateLimiter({ limit: 15, prefix: "agent_login" }), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        success: false,
        msg: "Please provide email and password",
      });
    }

    const agentFind = plain(
      await prisma.agents.findMany({ where: { email: String(email) }, take: 1 }),
    );
    if (agentFind.length < 1) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
    }

    const compare = await bcrypt.compare(password, agentFind[0].password);
    if (!compare) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
    }

    // ✅ No password in token — uses tokenVersion instead with 24h expiration
    const token = sign(
      {
        uid: agentFind[0].uid,
        role: "agent",
        email: agentFind[0].email,
        owner_uid: agentFind[0]?.owner_uid,
        tokenVersion: agentFind[0]?.tokenVersion ?? 0,
      },
      process.env.JWTKEY,
      { expiresIn: "24h" },
    );

    const currentDate = new Date().toISOString().split("T")[0];
    const loginTime = new Date().toISOString();

    const existingLogs = agentFind[0].logs ? JSON.parse(agentFind[0].logs) : {};

    if (!existingLogs.dateTracking) {
      existingLogs.dateTracking = {};
    }

    if (!existingLogs.dateTracking[currentDate]) {
      existingLogs.dateTracking[currentDate] = {
        logins: 0,
        logouts: 0,
        lastLogin: loginTime,
        lastLogout: null,
      };
    }

    existingLogs.dateTracking[currentDate].logins++;
    existingLogs.dateTracking[currentDate].lastLogin = loginTime;

    await prisma.agents.updateMany({
      where: { uid: agentFind[0].uid },
      data: { logs: JSON.stringify(existingLogs) },
    });

    res.json({
      success: true,
      token,
      todayStats: existingLogs.dateTracking[currentDate],
    });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong", err });
  }
});

// logout agent
router.get("/logout", validateAgent, async (req, res) => {
  try {
    const uid = req.decode.uid;

    if (!uid) {
      return res.json({
        success: false,
        msg: "Agent UID is required",
      });
    }

    // Get agent data
    const agentFind = plain(await prisma.agents.findMany({ where: { uid }, take: 1 }));
    if (agentFind.length < 1) {
      return res.json({ success: false, msg: "Agent not found" });
    }

    // Parse existing logs or initialize
    const existingLogs = agentFind[0].logs ? JSON.parse(agentFind[0].logs) : {};

    // Initialize dateTracking if not exists
    if (!existingLogs.dateTracking) {
      existingLogs.dateTracking = {};
    }

    // Get current date (YYYY-MM-DD)
    const currentDate = new Date().toISOString().split("T")[0];

    // Initialize date entry if not exists
    if (!existingLogs.dateTracking[currentDate]) {
      existingLogs.dateTracking[currentDate] = {
        logins: 0,
        logouts: 0,
        lastLogin: null,
        lastLogout: new Date().toISOString(),
      };
    } else {
      // Update existing date entry
      existingLogs.dateTracking[currentDate].logouts++;
      existingLogs.dateTracking[currentDate].lastLogout =
        new Date().toISOString();
    }

    // Update database and increment tokenVersion to revoke active token
    await prisma.agents.updateMany({
      where: { uid },
      data: {
        logs: JSON.stringify(existingLogs),
        tokenVersion: (Number(agentFind[0].tokenVersion) || 0) + 1,
      },
    });

    res.json({
      success: true,
      msg: "Logout recorded successfully",
      todayStats: existingLogs.dateTracking[currentDate],
    });
  } catch (err) {
    logger.error("[Agent Logout Error]", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

router.post("/logout", validateAgent, async (req, res) => {
  try {
    const uid = req.decode.uid;
    // { increment } on NULL stays NULL in SQL, so treat NULL as 0 explicitly
    await prisma.$transaction([
      prisma.agents.updateMany({ where: { uid, tokenVersion: null }, data: { tokenVersion: 0 } }),
      prisma.agents.updateMany({ where: { uid }, data: { tokenVersion: { increment: 1 } } }),
    ]);
    res.json({ success: true, msg: "Logged out successfully" });
  } catch (err) {
    logger.error("[Agent Logout Error]", err);
    res.status(500).json({ success: false, msg: "Logout failed" });
  }
});

// get me agent
router.get("/get_me", validateAgent, async (req, res) => {
  try {
    const agent = await prisma.agents.findFirst({ where: { uid: req.decode.uid } });
    res.json({ data: agent ? withoutPassword(agent) : undefined, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get agent assign chats
router.get("/get_my_assigned_chats", validateAgent, async (req, res) => {
  try {
    let data = [];

    const getMyChatsId = await prisma.agent_chats.findMany({
      where: { uid: req.decode.uid },
    });

    logger.log({
      getMyChatsId,
    });

    if (getMyChatsId.length < 1) {
      return res.json({ data: [], success: true });
    }

    const chatIds = getMyChatsId.map((i) => i?.chat_id);

    logger.log({
      chatIds,
    });

    // Using IN clause to match against multiple IDs
    data = plain(
      await prisma.chats.findMany({
        where: { chat_id: { in: chatIds.filter(Boolean) }, uid: req.owner?.uid },
      }),
    );

    logger.log({
      data,
    });

    const getContacts = plain(
      await prisma.contact.findMany({ where: { uid: req.owner.uid } }),
    );

    if (data.length > 0 && getContacts.length > 0) {
      data = mergeArrays(getContacts, data);
    } else {
      data = data;
    }

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get chat conversatio
router.post("/get_convo", validateAgent, async (req, res) => {
  try {
    const { chatId } = req.body;

    const filePath = `${__dirname}/../conversations/inbox/${req.owner.uid}/${chatId}.json`;
    const data = readJSONFile(filePath, 100);

    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// send chat text
router.post("/send_text", validateAgent, checkPlan, async (req, res) => {
  try {
    const { text, toNumber, toName, chatId } = req.body;

    if (!text || !toNumber || !toName || !chatId) {
      return res.json({ success: false, msg: "Not enough input provided" });
    }

    const msgObj = {
      type: "text",
      text: {
        preview_url: true,
        body: text,
      },
    };

    const savObj = {
      type: "text",
      metaChatId: "",
      msgContext: {
        type: "text",
        text: {
          preview_url: true,
          body: text,
        },
      },
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
      agent: req.decode?.email,
    };

    const resp = await sendMetaMsg(
      req.owner.uid,
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

// send audio
router.post("/send_audio", validateAgent, checkPlan, async (req, res) => {
  try {
    const { url, toNumber, toName, chatId } = req.body;

    if (!url || !toNumber || !toName || !chatId) {
      return res.json({ success: false, msg: "Not enough input provided" });
    }

    const msgObj = {
      type: "audio",
      audio: {
        link: url,
      },
    };

    const savObj = {
      type: "audio",
      metaChatId: "",
      msgContext: {
        type: "audio",
        audio: {
          link: url,
        },
      },
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
      agent: req.decode?.email,
    };

    const resp = await sendMetaMsg(
      req.owner.uid,
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

// return image url
router.post("/return_media_url", validateAgent, async (req, res) => {
  let randomString;
  let file;

  try {
    ffmpeg.setFfmpegPath(ffmpegStatic);
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.json({ success: false, msg: "No files were uploaded" });
    }

    randomString = randomstring.generate();
    file = req.files.file;
    const shouldConvert = req.body.convert === "YES";
    const target = req.body.target; // 'baileys' or other values

    let filename = `${randomString}.${getFileExtension(file.name)}`;
    const tempPath = `${__dirname}/../client/public/media/temp_${filename}`;
    const finalPath = `${__dirname}/../client/public/media/${filename}`;

    // Move file to temp location first
    await new Promise((resolve, reject) => {
      file.mv(tempPath, (err) => {
        if (err) {
          logger.log("File move error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // If conversion is requested and it's an audio file
    if (shouldConvert && file.mimetype.startsWith("audio/")) {
      try {
        // logger.log(
        //   `Converting audio file for ${
        //     target === "baileys" ? "WhatsApp Baileys" : "MP3"
        //   } using fluent-ffmpeg...`
        // );

        if (target === "baileys") {
          // Baileys conversion: OGG format with specific settings
          filename = `${randomString}.ogg`;
          const convertedPath = `${__dirname}/../client/public/media/${filename}`;

          await new Promise((resolve, reject) => {
            ffmpeg(tempPath)
              .noVideo()
              .audioFrequency(48000)
              .audioChannels(1)
              .audioCodec("libopus")
              .audioBitrate(64)
              .outputOptions([
                "-application voip",
                "-avoid_negative_ts make_zero",
                "-map_metadata -1",
              ])
              .format("ogg")
              .on("start", (commandLine) => {
                // logger.log("FFmpeg started with command:", commandLine);
              })
              .on("progress", (progress) => {
                // logger.log("Processing: " + progress.percent + "% done");
              })
              .on("end", () => {
                // logger.log("Audio conversion to OGG completed successfully");
                resolve();
              })
              .on("error", (err) => {
                logger.error("FFmpeg conversion error:", err);
                reject(err);
              })
              .save(convertedPath);
          });
        } else {
          // Default conversion: MP3 format
          filename = `${randomString}.mp3`;
          const convertedPath = `${__dirname}/../client/public/media/${filename}`;

          await new Promise((resolve, reject) => {
            ffmpeg(tempPath)
              .noVideo()
              .audioCodec("libmp3lame")
              .audioBitrate(128)
              .audioChannels(2)
              .audioFrequency(44100)
              .outputOptions(["-write_xing 0", "-id3v2_version", "3"])
              .format("mp3")
              .on("start", (commandLine) => {
                logger.log("FFmpeg started with command:", commandLine);
              })
              .on("progress", (progress) => {
                logger.log("Processing: " + progress.percent + "% done");
              })
              .on("end", () => {
                logger.log("Audio conversion to MP3 completed successfully");
                resolve();
              })
              .on("error", (err) => {
                logger.error("FFmpeg conversion error:", err);
                reject(err);
              })
              .save(convertedPath);
          });
        }

        // Delete temp file after successful conversion
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        // Verify the converted file exists and has content
        const finalConvertedPath = `${__dirname}/../client/public/media/${filename}`;
        if (
          !fs.existsSync(finalConvertedPath) ||
          fs.statSync(finalConvertedPath).size === 0
        ) {
          throw new Error("Conversion produced empty or missing file");
        }
      } catch (conversionError) {
        logger.error("Audio conversion failed:", conversionError);

        // If conversion fails, use original file
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, finalPath);
        }

        // Reset filename to original extension
        filename = `${randomString}.${getFileExtension(file.name)}`;

        logger.log("Using original file due to conversion failure");
      }
    } else {
      // No conversion needed, just move from temp to final location
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, finalPath);
      }
    }

    const url = `${process.env.FRONTENDURI}/media/${filename}`;

    // logger.log({
    //   success: true,
    //   url,
    //   converted: shouldConvert && file.mimetype.startsWith("audio/"),
    //   format:
    //     shouldConvert && file.mimetype.startsWith("audio/")
    //       ? target === "baileys"
    //         ? "ogg"
    //         : "mp3"
    //       : getFileExtension(file.name),
    //   target: target || "default",
    // });
    res.json({
      success: true,
      url,
      converted: shouldConvert && file.mimetype.startsWith("audio/"),
      format:
        shouldConvert && file.mimetype.startsWith("audio/")
          ? target === "baileys"
            ? "ogg"
            : "mp3"
          : getFileExtension(file.name),
      target: target || "default",
    });
  } catch (err) {
    logger.error("Media upload error:", err);

    // Clean up temp file if it exists
    if (randomString && file) {
      const tempPath = `${__dirname}/../client/public/media/temp_${randomString}.${getFileExtension(
        file.name,
      )}`;
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          logger.error("Error cleaning up temp file:", cleanupError);
        }
      }
    }

    res.json({ success: false, msg: "Something went wrong", err: err.message });
  }
});

router.post("/convert_audio", validateAgent, async (req, res) => {
  try {
    res.json(await convertOwnedAudio(req.owner?.uid, req.body || {}));
  } catch (err) {
    logger.error("Audio conversion error:", err);
    res.json({ success: false, msg: "Something went wrong during conversion" });
  }
});

// send document
router.post("/send_doc", validateAgent, checkPlan, async (req, res) => {
  try {
    const { url, toNumber, toName, chatId, caption } = req.body;

    if (!url || !toNumber || !toName || !chatId) {
      return res.json({ success: false, msg: "Not enough input provided" });
    }

    const msgObj = {
      type: "document",
      document: {
        link: url,
        caption: caption || "",
      },
    };

    const savObj = {
      type: "document",
      metaChatId: "",
      msgContext: {
        type: "document",
        document: {
          link: url,
          caption: caption || "",
        },
      },
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
      agent: req.decode?.email,
    };

    const resp = await sendMetaMsg(
      req.owner.uid,
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

// send video
router.post("/send_video", validateAgent, checkPlan, async (req, res) => {
  try {
    const { url, toNumber, toName, chatId, caption } = req.body;

    if (!url || !toNumber || !toName || !chatId) {
      return res.json({ success: false, msg: "Not enough input provided" });
    }

    const msgObj = {
      type: "video",
      video: {
        link: url,
        caption: caption || "",
      },
    };

    const savObj = {
      type: "video",
      metaChatId: "",
      msgContext: {
        type: "video",
        video: {
          link: url,
          caption: caption || "",
        },
      },
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
      agent: req.decode?.email,
    };

    const resp = await sendMetaMsg(
      req.owner.uid,
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

// send image
router.post("/send_image", validateAgent, checkPlan, async (req, res) => {
  try {
    const { url, toNumber, toName, chatId, caption } = req.body;

    if (!url || !toNumber || !toName || !chatId) {
      return res.json({ success: false, msg: "Not enough input provided" });
    }

    const msgObj = {
      type: "image",
      image: {
        link: url,
        caption: caption || "",
      },
    };

    const savObj = {
      type: "image",
      metaChatId: "",
      msgContext: {
        type: "image",
        image: {
          link: url,
          caption: caption || "",
        },
      },
      reaction: "",
      timestamp: "",
      senderName: toName,
      senderMobile: toNumber,
      status: "sent",
      star: false,
      route: "OUTGOING",
      agent: req.decode?.email,
    };

    const resp = await sendMetaMsg(
      req.owner.uid,
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

// get my tasks
router.get("/get_my_task", validateAgent, async (req, res) => {
  try {
    const data = await prisma.agent_task.findMany({
      where: { uid: req.decode.uid },
    });

    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// mark task complete
router.post("/mark_task_complete", validateAgent, async (req, res) => {
  try {
    const { id, comment } = req.body;

    if (!comment) {
      return res.json({ msg: "Please type your comments." });
    }

    // only the assigned agent can complete the task (was: any task id)
    await prisma.agent_task.updateMany({
      where: { id: idParam(id), uid: req.decode.uid },
      data: { status: "COMPLETED", agent_comments: str(comment) },
    });

    res.json({ msg: "Task updated", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// change chat status
router.post("/change_chat_ticket_status", validateAgent, async (req, res) => {
  try {
    const { status, chatId } = req.body;

    if (!status || !chatId) {
      return res.json({ msg: "invalid request" });
    }

    // scoped to the agent's workspace (was: any tenant's chat)
    await prisma.chats.updateMany({
      where: { chat_id: whereStr(chatId), uid: whereStr(req.owner?.uid) },
      data: { chat_status: str(status) },
    });

    res.json({
      success: true,
      msg: "Chat status updated",
    });
  } catch (err) {
    logger.log(err);
    res.json({ err, success: false, msg: "Something went wrong" });
  }
});

// get all quick reply
router.get("/get_all_quick_reply", validateAgent, async (req, res) => {
  try {
    const data = await prisma.quick_reply.findMany({
      where: { uid: req.owner.uid },
    });
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "something went wrong",
      err: err,
    });
  }
});

// change status save as contact
router.post("/save_contact_agent", validateUser, async (req, res) => {
  try {
    const { agentUid, activeness } = req.body;

    await setOwnedAgentFlag(req.decode.uid, agentUid, "allow_save_contact", activeness);

    res.json({
      success: true,
      msg: "Success",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

router.post("/update_fcm_token", validateAgent, async (req, res) => {
  try {
    const { other, token } = req.body;
    const user = req.decode.userData;

    // 1️⃣ Remove token everywhere first
    await removeTokenFromAll(token);

    // 2️⃣ Parse CURRENT AGENT fcm_data safely
    let fcmData;
    try {
      fcmData = JSON.parse(user?.fcm_data || "{}");
    } catch {
      fcmData = {};
    }

    const existingTokens = Array.isArray(fcmData.tokens) ? fcmData.tokens : [];
    const existingOther =
      typeof fcmData.other === "object" && fcmData.other !== null
        ? fcmData.other
        : {};

    // 3️⃣ Add token to current agent (no duplicates)
    // const newTokens = existingTokens.includes(token)
    //   ? existingTokens
    //   : [...existingTokens, token];

    const newTokens = [token];

    const newUpdated = {
      tokens: newTokens,
      other: { ...existingOther, ...other },
    };

    // 4️⃣ Save final data
    await prisma.agents.updateMany({
      where: { uid: req.decode.uid },
      data: { fcm_data: JSON.stringify(newUpdated) },
    });

    res.json({ success: true, fcm_data: newUpdated });
  } catch (err) {
    logger.error("❌ AGENT FCM update error:", err);
    res.status(500).json({
      success: false,
      msg: "Something went wrong",
      err: err.message,
    });
  }
});

// GET /api/agent/get_phonebook_for_inbox
// Search contacts for inbox new chat (agent side — uses owner's contacts)
router.get("/get_phonebook_for_inbox", validateAgent, async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Agent uses owner's contacts
    const ownerUid = req.owner?.uid;
    if (!ownerUid) {
      return res.json({ success: false, msg: "Owner not found" });
    }

    const term = String(search);
    const where = {
      uid: ownerUid,
      OR: [{ name: { contains: term } }, { mobile: { contains: term } }],
    };
    const take = Math.max(1, parseInt(limit) || 20);

    const [total, data] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: { id: true, name: true, mobile: true, phonebook_name: true, var1: true, var2: true },
        orderBy: { name: "asc" },
        take,
        skip: Math.max(0, offset || 0),
      }),
    ]);
    const countResult = { total };

    res.json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: offset + data.length < countResult.total,
    });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

module.exports = router;
