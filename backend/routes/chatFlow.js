const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { idList, idParam, plain, str, whereStr } = require("../database/prismaHelpers");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  getFileExtension,
  makeRequestBeta,
  executeMySQLQuery,
  buildSystemPrompt,
  buildUserPrompt,
  callOpenAI,
  callGemini,
  callDeepSeek,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const { checkPlan, checkChatbot } = require("../middlewares/plan.js");
const validateAgent = require("../middlewares/agent.js");
const { returnAddons } = require("../utils/addons.js");
const axios = require("axios");
const logger = require("../utils/logger.js");

const validateLastNode = (nodes, edges) => {
  // Find all target nodes (nodes that have incoming connections)
  const targetNodeIds = new Set(edges.map((edge) => edge.target));

  // Find source nodes that aren't targets (potential starting nodes)
  const startingNodes = nodes.filter((node) => !targetNodeIds.has(node.id));

  // If no edges exist, just check the last node in array
  if (edges.length === 0) {
    const lastNode = nodes[nodes.length - 1];
    if (lastNode?.data?.moveToNextNode) {
      return {
        isValid: false,
        message: `${lastNode?.type} Node cannot be last.`,
      };
    }
    return { isValid: true };
  }

  // Traverse the flow to find the actual last connected node
  let lastConnectedNode = null;
  const visited = new Set();

  const traverse = (currentNodeId) => {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);
    if (outgoingEdges.length === 0) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (
        node &&
        (!lastConnectedNode || node.position.x > lastConnectedNode.position.x)
      ) {
        lastConnectedNode = node;
      }
      return;
    }

    outgoingEdges.forEach((edge) => traverse(edge.target));
  };

  // Start traversal from all starting nodes
  startingNodes.forEach((node) => traverse(node.id));

  if (lastConnectedNode && lastConnectedNode.data?.moveToNextNode) {
    return {
      isValid: false,
      message: `${lastConnectedNode.type} Node cannot be last.`,
    };
  }

  return { isValid: true };
};

// add new beta
router.post("/insert_flow_beta", validateUser, checkPlan, checkChatbot, async (req, res) => {
  try {
    const { name, flow_id, data, source } = req.body;
    if (!name || !flow_id) {
      return res.status(400).json({ success: false, msg: "Please provide a flow name and flow_id" });
    }

    const nodesVar = data?.nodes || [];

    const validation = validateLastNode(nodesVar, data?.edges || []);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, msg: validation.message });
    }

    const sourceTypes = [
      "wa_chatbot",
      "webhook_flow",
      "webhook_automation",
      "telegram_chatbot",
      "instagram_chatbot",
      "instagram_comment",
    ];

    if (!sourceTypes.includes(source)) {
      return res.status(400).json({ success: false, msg: `Unknown flow source found: ${source}` });
    }

    if (!nodesVar || nodesVar.length < 1) {
      return res.status(400).json({ success: false, msg: "Blank flow cannot be saved" });
    }

    // checking with the same id
    const [existingFlow] = plain(await prisma.beta_flows.findMany({ where: { flow_id: whereStr(flow_id) } }));
    if (existingFlow) {
      if (existingFlow.uid !== req.decode.uid) {
        return res.status(403).json({ success: false, msg: "Unauthorized access to flow" });
      }
      await prisma.beta_flows.updateMany({
        where: { flow_id: whereStr(flow_id), uid: whereStr(req.decode.uid) },
        data: { name: str(name), data: str(JSON.stringify(data)), source: str(source) },
      });

      res.json({ msg: "Flows was updated", success: true, flow_id });
    } else {
      await prisma.beta_flows.create({
        data: {
          uid: str(req.decode.uid),
          flow_id: str(flow_id),
          source: str(source),
          name: str(name),
          data: str(JSON.stringify(data)),
        },
      });

      res.json({ msg: "Flows was saved", success: true, flow_id });
    }
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get single flow beta
router.get("/get_flow_beta", validateUser, checkPlan, async (req, res) => {
  try {
    const { flow_id, id } = req.query;
    let rows;
    if (flow_id) {
      rows = plain(await prisma.beta_flows.findMany({ where: { flow_id: whereStr(flow_id), uid: whereStr(req.decode.uid) } }));
    } else if (id) {
      rows = plain(await prisma.beta_flows.findMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } }));
    } else {
      return res.status(400).json({ success: false, msg: "flow_id or id is required" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, msg: "Flow not found" });
    }

    const flow = rows[0];
    let parsedData = flow.data;
    try {
      if (typeof parsedData === "string") {
        parsedData = JSON.parse(parsedData);
      }
    } catch {
      parsedData = { nodes: [], edges: [] };
    }

    res.json({
      success: true,
      data: {
        ...flow,
        data: parsedData,
      },
    });
  } catch (err) {
    logger.log(err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// duplicate flow beta
router.post("/duplicate_flow_beta", validateUser, checkPlan, checkChatbot, async (req, res) => {
  try {
    const { flow_id, id } = req.body;
    let rows;
    if (flow_id) {
      rows = plain(await prisma.beta_flows.findMany({ where: { flow_id: whereStr(flow_id), uid: whereStr(req.decode.uid) } }));
    } else if (id) {
      rows = plain(await prisma.beta_flows.findMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } }));
    } else {
      return res.status(400).json({ success: false, msg: "flow_id or id is required" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, msg: "Flow not found" });
    }

    const sourceFlow = rows[0];
    const newFlowId = randomstring.generate(32);
    const newName = `${sourceFlow.name || "Flow"} (Copy)`;

    await prisma.beta_flows.create({
      data: {
        uid: str(req.decode.uid),
        flow_id: str(newFlowId),
        source: str(sourceFlow.source),
        name: str(newName),
        data: str(sourceFlow.data),
      },
    });

    res.json({
      success: true,
      msg: "Flow duplicated successfully",
      flow_id: newFlowId,
    });
  } catch (err) {
    logger.log(err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get flows beta
router.get("/get_flows_beta", validateUser, checkPlan, async (req, res) => {
  try {
    const { type } = req.query;

    let data = [];
    if (!type || type === "all") {
      data = plain(await prisma.beta_flows.findMany({ where: { uid: whereStr(req.decode.uid) }, orderBy: { id: "desc" } }));
    } else {
      data = plain(await prisma.beta_flows.findMany({
        where: { uid: whereStr(req.decode.uid), source: whereStr(type) },
        orderBy: { id: "desc" },
      }));
    }
    data = data.map((x) => {
      let parsed = x.data;
      try {
        if (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
      } catch {
        parsed = { nodes: [], edges: [] };
      }
      return {
        ...x,
        data: parsed,
      };
    });

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del flow beta
router.post("/del_flow_beta", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.beta_flows.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });
    res.json({ msg: "Flow was deleted", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get my flows
router.get("/get_mine", validateUser, async (req, res) => {
  try {
    const data = plain(await prisma.flow.findMany({ where: { uid: whereStr(req.decode.uid) } }));
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get chats activity
router.post("/get_activity", validateUser, checkPlan, async (req, res) => {
  try {
    const { flowId } = req.body;

    const getFlow = plain(await prisma.flow.findMany({ where: { uid: whereStr(req.decode.uid), flow_id: whereStr(flowId) } }));

    // Parse prevent and ai lists from the database
    const prevent = getFlow[0]?.prevent_list
      ? JSON.parse(getFlow[0]?.prevent_list)
      : [];
    const ai = getFlow[0]?.ai_list ? JSON.parse(getFlow[0]?.ai_list) : [];

    // Assign unique IDs to each item in the prevent and ai lists
    const preventWithIds = prevent.map((item, index) => ({
      ...item,
      id: `prevent-${index}`, // Assign a unique ID using the index
    }));
    const aiWithIds = ai.map((item, index) => ({
      ...item,
      id: `ai-${index}`, // Assign a unique ID using the index
    }));

    // Log the data with unique IDs
    logger.log({
      prevent: preventWithIds,
      ai: aiWithIds,
    });

    // Send the response with lists that have unique IDs
    res.json({ success: true, prevent: preventWithIds, ai: aiWithIds });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// remove number from flow activiy
router.post("/remove_number_from_activity", validateUser, async (req, res) => {
  try {
    const { type, number, flowId } = req.body;

    const [flow] = plain(await prisma.flow.findMany({ where: { flow_id: whereStr(flowId) } }));

    if (type == "AI") {
      // removing from ai arr
      const aiArr = flow?.ai_list ? JSON.parse(flow?.ai_list) : [];
      const updatedArr = aiArr?.filter((x) => x.senderNumber !== number);

      await prisma.flow.updateMany({
        where: { flow_id: whereStr(flowId), uid: whereStr(req.decode.uid) },
        data: { ai_list: str(JSON.stringify(updatedArr)) },
      });
    } else if (type == "DISABLED") {
      // removing from prevent arr
      const preventArr = flow?.prevent_list
        ? JSON.parse(flow?.prevent_list)
        : [];
      const updatedPreventArr = preventArr?.filter(
        (x) => x.senderNumber !== number,
      );

      await prisma.flow.updateMany({
        where: { flow_id: whereStr(flowId), uid: whereStr(req.decode.uid) },
        data: { prevent_list: str(JSON.stringify(updatedPreventArr)) },
      });
    }

    res.json({ msg: "Number was removed", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get beta flow sessiosn
router.post("/session_mine", validateUser, async (req, res) => {
  try {
    const { flow_id, sender_mobile } = req.body;
    const data = plain(await prisma.flow_session.findMany({
      where: {
        uid: whereStr(req.decode.uid),
        flow_id: whereStr(flow_id),
        sender_mobile: whereStr(sender_mobile),
      },
    }));

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get beta flow sessiosn
router.post("/session_mine_agent", validateAgent, async (req, res) => {
  try {
    const { flow_id, sender_mobile } = req.body;
    const data = plain(await prisma.flow_session.findMany({
      where: {
        uid: whereStr(req.owner.uid),
        flow_id: whereStr(flow_id),
        sender_mobile: whereStr(sender_mobile),
      },
    }));

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

router.post("/enable_chat_agent", validateAgent, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.flow_session.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });
    res.json({ msg: "Auto reply enabled", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "something went wrong" });
  }
});

router.post("/enable_chat", validateUser, async (req, res) => {
  try {
    const { id } = req.body;

    await prisma.flow_session.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });

    res.json({ msg: "Auto reply enabled", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "something went wrong" });
  }
});

router.post("/disable_chat", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, msg: "Session ID is required" });
    }

    const [flow] = plain(await prisma.flow_session.findMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } }));

    if (flow) {
      let data = flow?.data ? JSON.parse(flow?.data) : {};

      const currentTime = new Date();
      currentTime.setHours(currentTime.getHours() + 8760);
      currentTime.setMinutes(currentTime.getMinutes() + 10);

      data.disableChat = {
        node: {},
        timestamp: currentTime.getTime(),
      };

      await prisma.flow_session.updateMany({
        where: { id: idParam(id), uid: whereStr(req.decode.uid) },
        data: { data: str(JSON.stringify(data)) },
      });
    } else {
      return res.status(404).json({ success: false, msg: "Flow session not found or unauthorized" });
    }

    res.json({ msg: "Auto reply disabled", success: true });
  } catch (err) {
    logger.error("disable_chat error:", err);
    res.status(500).json({ success: false, msg: "Failed to disable auto reply" });
  }
});

router.post("/disable_chat_agent", validateAgent, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, msg: "Session ID is required" });
    }

    const ownerUid = req.owner?.uid || req.decode?.owner_uid;
    const [flow] = plain(await prisma.flow_session.findMany({ where: { id: idParam(id), uid: whereStr(ownerUid) } }));
    if (flow) {
      let data = flow?.data ? JSON.parse(flow?.data) : {};

      const currentTime = new Date();
      currentTime.setHours(currentTime.getHours() + 8760);
      currentTime.setMinutes(currentTime.getMinutes() + 10);

      data.disableChat = {
        node: {},
        timestamp: currentTime.getTime(),
      };

      await prisma.flow_session.updateMany({
        where: { id: idParam(id), uid: whereStr(ownerUid) },
        data: { data: str(JSON.stringify(data)) },
      });
    } else {
      return res.status(404).json({ success: false, msg: "Flow session not found or unauthorized" });
    }

    res.json({ msg: "Auto reply disabled", success: true });
  } catch (err) {
    logger.error("disable_chat_agent error:", err);
    res.status(500).json({ success: false, msg: "Failed to disable auto reply" });
  }
});

// get beta flow sessiosn
router.post("/get_beta_flow_sessions", validateUser, async (req, res) => {
  try {
    const { flow_id } = req.body;
    const data = plain(await prisma.flow_session.findMany({ where: { uid: whereStr(req.decode.uid), flow_id: whereStr(flow_id) } }));

    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del flow session
router.post("/del_flow_sess", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.flow_session.deleteMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } });
    res.json({ msg: "Session was deleted", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// reset disabled chat
router.post("/reset_dc_sess", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    const [getSess] = plain(await prisma.flow_session.findMany({ where: { id: idParam(id), uid: whereStr(req.decode.uid) } }));

    if (getSess) {
      let a = JSON.parse(getSess.data);
      delete a.disableChat;
      await prisma.flow_session.updateMany({ where: { id: idParam(id) }, data: { data: str(JSON.stringify(a)) } });
    }

    res.json({ msg: "Disable chat was reset", success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// Delete multiple flow sessions
router.post("/del_multiple_flow_sess", validateUser, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, msg: "No sessions selected" });
    }

    await prisma.flow_session.deleteMany({
      where: { id: { in: idList(ids) }, uid: req.decode.uid },
    });

    res.json({ msg: "Selected sessions were deleted", success: true });
  } catch (err) {
    res.json({ success: false, msg: "Something went wrong" });
    logger.log(err);
  }
});

// make request beta
router.post("/make_request_try_beta", validateUser, async (req, res) => {
  try {
    const { data } = req.body;
    const vars = {
      name: "John Doe",
    };
    const resp = await makeRequestBeta(data, vars);

    if (resp.success) {
      logger.log({ data: resp.data.body.name });
      res.json({ success: true, msg: "Done" });
    } else {
      res.json({ success: false, msg: resp.msg });
    }
  } catch (err) {
    res.json({ success: false, msg: "Something went wrong" });
    logger.log(err);
  }
});

// try mysql con
router.post("/try_con", validateUser, async (req, res) => {
  try {
    const { data } = req.body;
    const respp = await executeMySQLQuery(data);
    if (respp?.success) {
      return res.json({
        success: true,
        msg: "Connection successful",
        data: respp?.data,
      });
    }
    res.json({ success: false, msg: respp?.error || "Connection failed" });
  } catch (err) {
    res.json({ success: false, msg: "Something went wrong" });
    logger.log(err);
  }
});

// get available origins for chatflow
router.get("/get_origians", validateUser, async (req, res) => {
  try {
    const addons = returnAddons();
    let origins = [
      {
        title: "Meta",
        code: "META",
        data: {},
      },
    ];

    if (addons?.includes("QR")) {
      const instances = plain(await prisma.instance.findMany({ where: { uid: whereStr(req.decode.uid), status: whereStr("ACTIVE") } }));

      const correctOrign = instances.map((x) => ({
        title: x.number,
        code: "QR",
        data: x,
      }));

      origins.push(...correctOrign);
    }

    if (addons?.includes("TELEGRAM")) {
      const teleSess = plain(await prisma.telegram_session.findMany({ where: { uid: whereStr(req.decode.uid), status: whereStr("active") } }));

      const correctOrign =
        teleSess?.map((x) => ({
          title: x.data ? JSON.parse(x.data)?.number : "NOT USABLE",
          code: "TELEGRAM",
          data: x,
        })) || [];

      origins.push(...correctOrign);
    }

    // In get_origians — add Instagram accounts
    if (addons?.includes("INSTAGRAM")) {
      // Instagram is always available (no addon check needed)
      const igAccounts = plain(await prisma.instagram_accounts.findMany({ where: { uid: whereStr(req.decode.uid) } }));

      const igOrigins = igAccounts.map((x) => ({
        title: `@${x.username || x.user_id}`,
        code: "INSTAGRAM",
        data: x,
      }));

      origins.push(...igOrigins);
    }

    const messengerAccounts = plain(await prisma.messenger_accounts.findMany({ where: { uid: whereStr(req.decode.uid) } }));

    const messengerOrigins = messengerAccounts.map((x) => ({
      title: x.page_name,
      code: "MESSENGER",
      data: x,
    }));

    origins.push(...messengerOrigins);

    res.json({ data: origins, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

router.post("/generate", validateUser, checkPlan, checkChatbot, async (req, res) => {
  try {
    const {
      instruction,
      provider, // { id: "openai"|"gemini"|"deepseek" }
      model, // { id: "gpt-4o" }
      apiKey,
      nodeSchemas, // serialized menuItems from frontend
      currentFlow, // { nodes, edges } or null
      mode, // "create" | "edit"
    } = req.body;

    if (!instruction || !provider?.id || !model?.id || !apiKey) {
      return res.json({
        success: false,
        msg: "instruction, provider, model, and apiKey are required",
      });
    }

    if (!nodeSchemas || nodeSchemas.length === 0) {
      return res.json({ success: false, msg: "nodeSchemas are required" });
    }

    const systemPrompt = buildSystemPrompt(nodeSchemas);
    const userPrompt = buildUserPrompt(instruction, currentFlow, mode);

    let rawJson;

    switch (provider.id.toLowerCase()) {
      case "openai":
        rawJson = await callOpenAI(apiKey, model.id, systemPrompt, userPrompt);
        break;
      case "gemini":
        rawJson = await callGemini(apiKey, model.id, systemPrompt, userPrompt);
        break;
      case "deepseek":
        rawJson = await callDeepSeek(
          apiKey,
          model.id,
          systemPrompt,
          userPrompt,
        );
        break;
      default:
        return res.json({ success: false, msg: "Unsupported provider" });
    }

    // Parse and validate
    let parsed;
    try {
      // Strip markdown fences if model ignores json_object instruction
      const cleaned = rawJson
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      logger.error("JSON parse error:", e.message, "\nRaw:", rawJson);
      return res.json({
        success: false,
        msg: "AI returned invalid JSON. Try rephrasing your instruction.",
        raw: rawJson,
      });
    }

    if (!parsed.nodes || !parsed.edges) {
      return res.json({
        success: false,
        msg: "AI response missing nodes or edges",
        raw: rawJson,
      });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    logger.error("[AI Flow Builder]", err.response?.data || err.message);
    res.json({
      success: false,
      msg:
        err.response?.data?.error?.message || err.message || "AI call failed",
    });
  }
});

module.exports = router;
