const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { idList, idParam, intOrNull, plain, str, whereStr } = require("../database/prismaHelpers");
const validateUser = require("../middlewares/user.js");
const Stripe = require("stripe");
const {
  checkPlan,
  checkNote,
  checkTags,
  checkContactLimit,
  checkWaWArmer,
} = require("../middlewares/plan.js");
const { getElevenLabsVoices } = require("../functions/function.js");
const {
  processPermissionRequests,
  processBroadcastCalls,
} = require("../helper/addon/wacall/broadcastProcessor.js");
const axios = require("axios");
const logger = require("../utils/logger.js");

// add new beta
router.post("/insert_flow", validateUser, checkPlan, async (req, res) => {
  try {
    const { name, flow_id, data, source = "wa_call" } = req.body;
    if (!name && !flow_id) {
      return res.json({ msg: "Please type a flow name" });
    }

    const sourceTypes = ["wa_call"];

    if (!sourceTypes.includes(source)) {
      return res.json({ msg: `Unknown flow source found: ${source}` });
    }

    if (data?.nodes?.length < 1 || data?.edges?.length < 1) {
      return res.json({ msg: "Blank flow can ot be saved" });
    }

    // checking with the same id
    const [cehckId] = plain(await prisma.wa_call_flows.findMany({ where: { flow_id: whereStr(flow_id) } }));
    if (cehckId) {
      await prisma.wa_call_flows.updateMany({
        where: { flow_id: whereStr(flow_id) },
        data: { name: str(name), data: str(JSON.stringify(data)), source: str(source) },
      });

      res.json({ msg: "Flows was updated", success: true });
    } else {
      await prisma.wa_call_flows.create({
        data: {
          uid: str(req.decode.uid),
          flow_id: str(flow_id),
          source: str(source),
          name: str(name),
          data: str(JSON.stringify(data)),
        },
      });

      res.json({ msg: "Flows was saved", success: true });
    }
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get flows beta
router.get("/get_flows", validateUser, checkPlan, async (req, res) => {
  try {
    let data = plain(await prisma.wa_call_flows.findMany({ where: { uid: whereStr(req.decode.uid) } }));

    data = data.map((x) => {
      return {
        ...x,
        data: JSON.parse(x.data),
      };
    });

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del flow beta
router.post("/del_flow", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.wa_call_flows.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });
    res.json({ msg: "Flow was deleted", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// fetch vocies
router.post("/fetch_el_voice", validateUser, async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.json({ msg: "Please provide Elevenlabs API keys" });
    }

    const voicesDataa = await getElevenLabsVoices({ apiKeys: apiKey });
    res.json(voicesDataa);
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// get call logs
router.get("/call_logs", validateUser, async (req, res) => {
  try {
    const data = plain(await prisma.wa_call_logs.findMany({ where: { uid: whereStr(req.decode.uid) } }));
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err });
    logger.log(err);
  }
});

// bulk delete call logs
router.post("/bulk_delete", validateUser, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, msg: "No IDs provided" });
    }

    // Convert IDs to numbers if they're strings
    const numericIds = ids.map((id) => parseInt(id));

    // Verify all logs belong to the user before deleting
    const verifyData = await prisma.wa_call_logs.findMany({
      where: { id: { in: idList(numericIds) }, uid: req.decode.uid },
      select: { id: true },
    });

    if (verifyData.length !== numericIds.length) {
      return res.json({
        success: false,
        msg: "Unauthorized deletion attempt or some logs not found",
      });
    }

    // Delete the logs
    await prisma.wa_call_logs.deleteMany({
      where: { id: { in: idList(numericIds) }, uid: req.decode.uid },
    });

    res.json({
      success: true,
      msg: `${numericIds.length} log(s) deleted successfully`,
      deletedCount: numericIds.length,
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err: err.message });
    logger.log(err);
  }
});

// adding call incoming bot
router.post("/add_in_bot", validateUser, checkPlan, async (req, res) => {
  try {
    const { title, flowId } = req.body;

    if (!title || !flowId) {
      return res.json({ msg: "Please type title and select Flow" });
    }

    const [getFlow] = plain(await prisma.wa_call_flows.findMany({ where: { uid: whereStr(req.decode.uid), flow_id: whereStr(flowId) } }));
    if (!getFlow) {
      return res.json({
        msg: "Flow does not exist. Please select valid flow once again",
      });
    }

    const [existFlow] = plain(await prisma.wa_call_bot.findMany({ where: { active: idParam(1), uid: whereStr(req.decode.uid) } }));
    if (existFlow) {
      return res.json({
        msg: "An active flow call bot is already running. Please disable that or delete that",
      });
    }

    await prisma.wa_call_bot.create({
      data: {
        uid: str(req.decode.uid),
        title: str(title),
        flow_id: str(getFlow?.flow_id),
        active: intOrNull(1),
      },
    });

    res.json({ msg: "Call Bot was added", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong", err: err.message });
    logger.log(err);
  }
});

// change wa call bot status
router.post(
  "/change_wa_call_bot_status",
  validateUser,
  checkPlan,
  async (req, res) => {
    try {
      const { id, active } = req.body;

      if (parseInt(active) > 0) {
        const [existFlow] = plain(await prisma.wa_call_bot.findMany({ where: { active: idParam(1), uid: whereStr(req.decode.uid) } }));
        if (existFlow) {
          return res.json({
            msg: "An active flow call bot is already running. Please disable that or delete that",
          });
        }
      }

      await prisma.wa_call_bot.updateMany({
        where: { uid: whereStr(req.decode.uid), id: idParam(id) },
        data: { active: intOrNull(parseInt(active) > 0 ? 1 : 0) },
      });

      res.json({ success: true, msg: "Status changed" });
    } catch (err) {
      res.json({
        success: false,
        msg: "something went wrong",
        err: err.message,
      });
      logger.log(err);
    }
  },
);

// get running bot
router.get("/get_call_bot", validateUser, checkPlan, async (req, res) => {
  try {
    const data = plain(await prisma.wa_call_bot.findMany({ where: { uid: whereStr(req.decode.uid) } }));
    res.json({ data, success: true });
  } catch (err) {
    res.json({
      success: false,
      msg: "something went wrong",
      err: err.message,
    });
    logger.log(err);
  }
});

// del a call in bot
router.post("/del_call_bot", validateUser, checkPlan, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.wa_call_bot.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });
    res.json({ msg: "Bot was deleted", success: true });
  } catch (err) {
    res.json({
      success: false,
      msg: "something went wrong",
      err: err.message,
    });
    logger.log(err);
  }
});

// Create new broadcast campaign
router.post("/create_broadcast", validateUser, checkPlan, async (req, res) => {
  try {
    const { title, flowId, phonebook, settings = {} } = req.body;

    if (!title || !flowId) {
      return res.json({ msg: "Title and Flow are required" });
    }

    const contacts = plain(await prisma.contact.findMany({ where: { uid: whereStr(req.decode.uid), phonebook_id: whereStr(phonebook?.id) } }));

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.json({ msg: "At least one contact is required" });
    }

    // Validate flow exists
    const [flow] = plain(await prisma.wa_call_flows.findMany({ where: { uid: whereStr(req.decode.uid), flow_id: whereStr(flowId) } }));

    if (!flow) {
      return res.json({ msg: "Selected flow does not exist" });
    }

    // Generate campaign ID
    const campaignId = `BC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare contacts with initial status
    const preparedContacts = contacts.map((contact, index) => ({
      id: `${campaignId}_${index}`,
      name: contact.name || "",
      mobile: contact.mobile,
      var1: contact.var1 || "",
      var2: contact.var2 || "",
      var3: contact.var3 || "",
      var4: contact.var4 || "",
      var5: contact.var5 || "",
      permission_status: "pending", // pending, requested, granted, denied, expired
      permission_requested_at: null,
      permission_granted_at: null,
      permission_expires_at: null,
      permission_type: null, // temporary, permanent
      call_status: "pending", // pending, ringing, answered, completed, failed, rejected
      call_id: null,
      call_initiated_at: null,
      call_completed_at: null,
      call_duration: null,
      error_message: null,
      retry_count: 0,
    }));

    const campaignData = {
      uid: req.decode.uid,
      campaign_id: campaignId,
      title,
      flow_id: flowId,
      status: "draft",
      contacts: JSON.stringify(preparedContacts),
      call_delay: settings.callDelay || 5000,
      max_concurrent_calls: settings.maxConcurrentCalls || 1,
      retry_failed: settings.retryFailed ? 1 : 0,
      retry_count: settings.retryCount || 0,
      total_contacts: preparedContacts.length,
      logs: JSON.stringify([
        {
          timestamp: new Date().toISOString(),
          type: "campaign_created",
          message: `Campaign created with ${preparedContacts.length} contacts`,
        },
      ]),
      meta_data: JSON.stringify({
        flow_name: flow.name,
        created_by: req.decode.uid,
      }),
    };

    await prisma.wa_call_broadcasts.create({
      data: { ...campaignData, retry_failed: Boolean(campaignData.retry_failed) },
    });

    res.json({
      success: true,
      msg: "Broadcast campaign created successfully",
      campaignId,
    });
  } catch (err) {
    logger.error("Error creating broadcast:", err);
    res.json({ success: false, msg: "Failed to create broadcast campaign" });
  }
});

// Get all broadcasts for user
router.get("/get_broadcasts", validateUser, checkPlan, async (req, res) => {
  try {
    const broadcasts = plain(await prisma.wa_call_broadcasts.findMany({ where: { uid: whereStr(req.decode.uid) }, orderBy: { created_at: "desc" } }));

    const formattedBroadcasts = broadcasts.map((b) => ({
      ...b,
      contacts: JSON.parse(b.contacts || "[]"),
      logs: JSON.parse(b.logs || "[]"),
      meta_data: JSON.parse(b.meta_data || "{}"),
    }));

    res.json({ success: true, data: formattedBroadcasts });
  } catch (err) {
    logger.error("Error fetching broadcasts:", err);
    res.json({ success: false, msg: "Failed to fetch broadcasts" });
  }
});

// Get single broadcast details
router.get(
  "/get_broadcast/:campaignId",
  validateUser,
  checkPlan,
  async (req, res) => {
    try {
      const { campaignId } = req.params;

      const [broadcast] = plain(await prisma.wa_call_broadcasts.findMany({ where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) } }));

      if (!broadcast) {
        return res.json({ success: false, msg: "Broadcast not found" });
      }

      const formattedBroadcast = {
        ...broadcast,
        contacts: JSON.parse(broadcast.contacts || "[]"),
        logs: JSON.parse(broadcast.logs || "[]"),
        meta_data: JSON.parse(broadcast.meta_data || "{}"),
      };

      res.json({ success: true, data: formattedBroadcast });
    } catch (err) {
      logger.error("Error fetching broadcast:", err);
      res.json({ success: false, msg: "Failed to fetch broadcast" });
    }
  },
);

// Start permission request phase
router.post(
  "/start_permission_request",
  validateUser,
  checkPlan,
  async (req, res) => {
    try {
      const { campaignId } = req.body;

      const [broadcast] = plain(await prisma.wa_call_broadcasts.findMany({ where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) } }));

      if (!broadcast) {
        return res.json({ success: false, msg: "Broadcast not found" });
      }

      if (broadcast.status !== "draft") {
        return res.json({ success: false, msg: "Campaign already started" });
      }

      // Update status
      await prisma.wa_call_broadcasts.updateMany({
        where: { campaign_id: whereStr(campaignId) },
        data: { status: "requesting_permissions", started_at: new Date() },
      });

      // Add log
      const logs = JSON.parse(broadcast.logs || "[]");
      logs.push({
        timestamp: new Date().toISOString(),
        type: "permission_phase_started",
        message: "Started requesting call permissions from contacts",
      });

      await prisma.wa_call_broadcasts.updateMany({
        where: { campaign_id: whereStr(campaignId) },
        data: { logs: str(JSON.stringify(logs)) },
      });

      // Trigger permission request process (async)
      setImmediate(() => {
        processPermissionRequests(campaignId, req.decode.uid);
      });

      res.json({
        success: true,
        msg: "Permission request phase started",
      });
    } catch (err) {
      logger.error("Error starting permission request:", err);
      res.json({ success: false, msg: "Failed to start permission request" });
    }
  },
);

// Start calling phase (after permissions granted)
router.post("/start_calling", validateUser, checkPlan, async (req, res) => {
  try {
    const { campaignId } = req.body;

    const [broadcast] = plain(await prisma.wa_call_broadcasts.findMany({ where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) } }));

    if (!broadcast) {
      return res.json({ success: false, msg: "Broadcast not found" });
    }

    if (!["ready", "paused"].includes(broadcast.status)) {
      return res.json({
        success: false,
        msg: "Campaign not ready to start calling",
      });
    }

    // Update status
    await prisma.wa_call_broadcasts.updateMany({ where: { campaign_id: whereStr(campaignId) }, data: { status: "running" } });

    // Add log
    const logs = JSON.parse(broadcast.logs || "[]");
    logs.push({
      timestamp: new Date().toISOString(),
      type: "calling_phase_started",
      message: "Started making calls to contacts with granted permissions",
    });

    await prisma.wa_call_broadcasts.updateMany({
      where: { campaign_id: whereStr(campaignId) },
      data: { logs: str(JSON.stringify(logs)) },
    });

    // ✅ FIX: Trigger calling process (async)
    setImmediate(() => {
      processBroadcastCalls(campaignId, req.decode.uid);
    });

    res.json({
      success: true,
      msg: "Calling phase started",
    });
  } catch (err) {
    logger.error("Error starting calling:", err);
    res.json({ success: false, msg: "Failed to start calling" });
  }
});

// Pause broadcast
router.post("/pause_broadcast", validateUser, checkPlan, async (req, res) => {
  try {
    const { campaignId } = req.body;

    await prisma.wa_call_broadcasts.updateMany({
      where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) },
      data: { status: "paused" },
    });

    res.json({ success: true, msg: "Broadcast paused" });
  } catch (err) {
    logger.error("Error pausing broadcast:", err);
    res.json({ success: false, msg: "Failed to pause broadcast" });
  }
});

// Delete broadcast
router.post("/delete_broadcast", validateUser, checkPlan, async (req, res) => {
  try {
    const { campaignId } = req.body;

    const [broadcast] = plain(await prisma.wa_call_broadcasts.findMany({
      where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) },
      select: { status: true },
    }));

    if (!broadcast) {
      return res.json({ success: false, msg: "Broadcast not found" });
    }

    if (broadcast.status === "running") {
      return res.json({
        success: false,
        msg: "Cannot delete running broadcast. Pause it first.",
      });
    }

    await prisma.wa_call_broadcasts.deleteMany({ where: { campaign_id: whereStr(campaignId), uid: whereStr(req.decode.uid) } });

    res.json({ success: true, msg: "Broadcast deleted" });
  } catch (err) {
    logger.error("Error deleting broadcast:", err);
    res.json({ success: false, msg: "Failed to delete broadcast" });
  }
});

// Update contact status (called by webhook)
router.post("/update_broadcast_contact", async (req, res) => {
  try {
    const { campaignId, contactMobile, updates } = req.body;

    const [broadcast] = plain(await prisma.wa_call_broadcasts.findMany({ where: { campaign_id: whereStr(campaignId) } }));

    if (!broadcast) {
      return res.json({ success: false, msg: "Broadcast not found" });
    }

    const contacts = JSON.parse(broadcast.contacts || "[]");
    const contactIndex = contacts.findIndex((c) => c.mobile === contactMobile);

    if (contactIndex === -1) {
      return res.json({ success: false, msg: "Contact not found" });
    }

    // Update contact
    contacts[contactIndex] = {
      ...contacts[contactIndex],
      ...updates,
    };

    // Update statistics
    let statsUpdate = {};

    if (updates.permission_status === "requested") {
      statsUpdate.permission_requested = broadcast.permission_requested + 1;
    }
    if (updates.permission_status === "granted") {
      statsUpdate.permission_granted = broadcast.permission_granted + 1;
    }
    if (updates.permission_status === "denied") {
      statsUpdate.permission_denied = broadcast.permission_denied + 1;
    }
    if (updates.call_status === "ringing") {
      statsUpdate.calls_initiated = broadcast.calls_initiated + 1;
    }
    if (updates.call_status === "completed") {
      statsUpdate.calls_completed = broadcast.calls_completed + 1;
    }
    if (updates.call_status === "failed") {
      statsUpdate.calls_failed = broadcast.calls_failed + 1;
    }

    // statsUpdate only ever holds the integer counter columns set above
    const data = { contacts: JSON.stringify(contacts) };
    Object.keys(statsUpdate).forEach((key) => {
      data[key] = intOrNull(statsUpdate[key]) ?? 0;
    });

    await prisma.wa_call_broadcasts.updateMany({
      where: { campaign_id: whereStr(campaignId) },
      data,
    });

    res.json({ success: true, msg: "Contact updated" });
  } catch (err) {
    logger.error("Error updating contact:", err);
    res.json({ success: false, msg: "Failed to update contact" });
  }
});

// Single endpoint - Check and Enable in ONE request
router.post(
  "/check_and_enable_call_permission",
  validateUser,
  async (req, res) => {
    try {
      const [metaAPI] = plain(await prisma.meta_api.findMany({ where: { uid: whereStr(req.decode.uid) } }));

      if (!metaAPI?.access_token || !metaAPI?.business_phone_number_id) {
        return res.json({
          success: false,
          msg: "Please setup your META API from the profile => META API option",
        });
      }

      const phoneNumberId = metaAPI?.business_phone_number_id;
      const accessToken = metaAPI?.access_token;

      // Try to enable calling directly
      try {
        const enableResponse = await axios.post(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/settings`,
          {
            calling: {
              status: "ENABLED",
              call_icon_visibility: "DEFAULT",
              callback_permission_status: "ENABLED",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        logger.log("Enable response:", enableResponse.data);

        return res.json({
          success: true,
          msg: "✅ WhatsApp calling has been enabled successfully!",
        });
      } catch (enableError) {
        logger.error(
          "Error enabling call permission:",
          enableError.response?.data || enableError.message,
        );

        return res.json({
          success: false,
          msg:
            enableError.response?.data?.error?.message ||
            "Failed to enable call feature. Please try again.",
        });
      }
    } catch (error) {
      logger.error("Unexpected error:", error);
      res.json({
        success: false,
        msg: "An unexpected error occurred. Please try again.",
      });
    }
  },
);

module.exports = router;
