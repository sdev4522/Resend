const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { idParam, str, whereStr } = require("../database/prismaHelpers");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  getFileExtension,
  makeRequest,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const { checkPlan, checkChatbot } = require("../middlewares/plan.js");
const logger = require("../utils/logger.js");

function hasPropertyWithValue(arr, property, value) {
  return arr.some((item) => item[property] === value);
}

router.post("/add_beta_chatbot", validateUser, checkPlan, checkChatbot, async (req, res) => {
  try {
    const { title, origin, flow } = req.body;
    if (!title || !origin || !flow?.id) {
      return res.json({ msg: "Please fill all required fields" });
    }

    const { flow_id } = flow;
    const getFlow = await prisma.beta_flows.findFirst({
      where: { flow_id: whereStr(flow_id), uid: req.decode.uid },
    });
    if (!getFlow) {
      return res.json({ msg: "This flow is not existed" });
    }

    const flowNodesEdges = getFlow?.data ? JSON.parse(getFlow.data) : null;
    if (!flowNodesEdges || flowNodesEdges?.nodes?.length < 2) {
      return res.json({
        msg: "This flow does not have enough nodes to start, Please complete the flow",
      });
    }

    const { nodes, edges } = flowNodesEdges;

    // Interactive messages only work on META — block for others
    if (origin?.code !== "META") {
      const hasButtons = nodes.some(
        (node) =>
          node.data?.type?.type === "button" ||
          (node.data?.content?.type === "interactive" &&
            node.data?.content?.interactive?.type === "button"),
      );
      const hasLists = nodes.some(
        (node) =>
          node.data?.type?.type === "list" ||
          (node.data?.content?.type === "interactive" &&
            node.data?.content?.interactive?.type === "list"),
      );

      if (hasButtons || hasLists) {
        const originLabel =
          origin.code === "TELEGRAM"
            ? "Telegram"
            : origin.code === "INSTAGRAM"
              ? "Instagram"
              : "QR";
        return res.json({
          success: false,
          msg: `Interactive buttons and lists are not supported for ${originLabel} origin.`,
        });
      }
    }

    const validOrigins = [
      "QR",
      "META",
      "WEBHOOK_AUTOMATION",
      "TELEGRAM",
      "INSTAGRAM",
      "INSTAGRAM_COMMENT",
      "MESSENGER",
    ];
    if (!validOrigins.includes(origin.code)) {
      return res.json({ msg: `Selected Origin not found ${origin?.code}` });
    }

    // ── origin-specific validation ──────────────────────────────────────────
    if (origin.code === "QR" && !origin.data?.uniqueId) {
      return res.json({ msg: "No active account found using this origin" });
    }
    if (origin.code === "TELEGRAM" && !origin.data?.id) {
      return res.json({
        msg: "No active Telegram session found using this origin",
      });
    }
    if (origin.code === "INSTAGRAM" && !origin.data?.user_id) {
      return res.json({
        msg: "No active Instagram account found using this origin",
      });
    }
    if (origin.code === "MESSENGER" && !origin.data?.page_id) {
      return res.json({
        msg: "No active Messenger page found using this origin",
      });
    }
    if (origin.code === "INSTAGRAM_COMMENT" && !origin.data?.user_id) {
      return res.json({
        msg: "No active Instagram account found using this origin",
      });
    }

    // ── duplicate check ─────────────────────────────────────────────────────
    const getAllChatbots = await prisma.beta_chatbot.findMany({
      where: { uid: req.decode.uid },
    });
    const chatbots = getAllChatbots?.map((x) => JSON.parse(x.origin)) || [];

    if (origin?.code === "META" && chatbots.find((x) => x.code === "META")) {
      return res.json({
        msg: "A chatbot is already running for META, please delete that first",
      });
    }

    if (
      chatbots.find((x) => x.title === origin?.title && x.code === origin?.code)
    ) {
      return res.json({
        msg: "A chatbot with this origin already exists",
      });
    }

    // ── resolve origin_id ───────────────────────────────────────────────────
    let origin_id;
    if (origin.code === "META") {
      origin_id = "META";
    } else if (origin.code === "TELEGRAM") {
      origin_id = origin.data?.session_id || origin.data?.id;
    } else if (origin.code === "QR") {
      origin_id = origin.data?.uniqueId;
    } else if (origin.code === "INSTAGRAM") {
      origin_id = origin.data?.user_id;
    } else if (origin.code === "INSTAGRAM_COMMENT") {
      origin_id = origin.data?.user_id; // ✅ FIXED
    } else if (origin.code === "MESSENGER") {
      origin_id = origin.data?.page_id;
    } else {
      origin_id = null;
    }

    // ── resolve source ──────────────────────────────────────────────────────
    let source;
    if (origin?.code === "WEBHOOK_AUTOMATION") {
      source = "webhook_automation";
    } else if (origin?.code === "INSTAGRAM") {
      source = "instagram_chatbot";
    } else if (origin?.code === "INSTAGRAM_COMMENT") {
      source = "instagram_comment"; // ✅ FIXED
    } else if (origin?.code === "MESSENGER") {
      source = "messenger_chatbot";
    } else {
      source = "wa_chatbot";
    }

    await prisma.beta_chatbot.create({
      data: {
        uid: req.decode.uid,
        source,
        title: str(title),
        flow_id: str(flow_id),
        origin: JSON.stringify(origin),
        origin_id: str(origin_id),
      },
    });

    res.json({ success: true, msg: "Chatbot was added successfully" });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Something went wrong", err });
  }
});

// get all chatbots beta
router.get("/get_beta_chatbots", validateUser, async (req, res) => {
  try {
    const { type, flow_id } = req.query;
    const where = { uid: req.decode.uid };
    if (flow_id) {
      where.flow_id = str(flow_id);
    } else if (type && type !== "all") {
      where.source = str(type);
    }
    const data = await prisma.beta_chatbot.findMany({
      where,
      orderBy: { id: "desc" },
    });
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Something went wrong", err });
  }
});

// change bot status
router.post("/change_beta_bot_status", validateUser, checkPlan, checkChatbot, async (req, res) => {
  try {
    const { id, status } = req.body;
    await prisma.beta_chatbot.updateMany({
      where: { uid: req.decode.uid, id: idParam(id) },
      data: { active: status ? 1 : 0 },
    });
    res.json({ msg: "Satus changed", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Something went wrong", err });
  }
});

// del beta chatbot
router.post("/del_beta_chatbot", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.beta_chatbot.deleteMany({
      where: { id: idParam(id), uid: req.decode.uid },
    });
    res.json({ msg: "Chatbot was deleted", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Something went wrong", err });
  }
});

module.exports = router;
