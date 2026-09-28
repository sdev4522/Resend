const jwt = require("jsonwebtoken");
const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");
const {
  resolveUserPlan,
  hasEntitlement,
  getLimit,
  getUsage,
  getAllEntitlements,
  buildPlanError,
} = require("../helper/entitlements");

/**
 * Validates that the requesting user has an active, non-expired subscription.
 * Attaches the live plan and entitlements to req.plan and req.entitlements.
 */
const checkPlan = async (req, res, next) => {
  try {
    if (req.owner) {
      req.decode.uid = req.owner.uid;
    }

    const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [
      req.decode.uid,
    ]);

    if (!getUser || getUser.length === 0) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        msg: "User not found",
      });
    }

    const resolution = await resolveUserPlan(getUser[0]);

    if (!resolution.isValid) {
      if (resolution.isExpired) {
        return res.status(403).json(
          buildPlanError(
            "PLAN_EXPIRED",
            "subscription",
            0,
            0,
            "Your subscription plan has expired. Please upgrade or renew your plan."
          )
        );
      } else {
        return res.status(403).json(
          buildPlanError(
            "NO_PLAN",
            "subscription",
            0,
            0,
            "Please subscribe to a plan to proceed."
          )
        );
      }
    }

    // Attach resolved live plan and entitlements map
    req.plan = resolution.plan;
    req.entitlements = getAllEntitlements(resolution.plan);
    next();
  } catch (err) {
    logger.log("Error in checkPlan middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces contact limit based on current count vs plan limit
 */
const checkContactLimit = async (req, res, next) => {
  try {
    const contactLimit = getLimit(req.plan, "contacts");
    const currentUsage = await getUsage(req.decode.uid, "contacts");

    if (currentUsage >= contactLimit) {
      return res.status(403).json(
        buildPlanError(
          "PLAN_LIMIT_REACHED",
          "contacts",
          currentUsage,
          contactLimit,
          `Your plan allows up to ${contactLimit.toLocaleString()} contacts. Limit reached (${currentUsage}/${contactLimit}). Please delete some contacts or upgrade your plan.`
        )
      );
    }
    next();
  } catch (err) {
    logger.log("Error in checkContactLimit middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces chat notes entitlement
 */
const checkNote = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "notes")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "notes",
        0,
        0,
        "Your current plan does not allow adding or editing chat notes."
      )
    );
  } catch (err) {
    logger.log("Error in checkNote middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces chat tags entitlement
 */
const checkTags = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "tags")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "tags",
        0,
        0,
        "Your current plan does not allow managing chat tags."
      )
    );
  } catch (err) {
    logger.log("Error in checkTags middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces WhatsApp Warmer entitlement
 */
const checkWaWArmer = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "wa_warmer")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "wa_warmer",
        0,
        0,
        "Your current plan does not include the WhatsApp Warmer feature."
      )
    );
  } catch (err) {
    logger.log("Error in checkWaWArmer middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces WhatsApp QR instance limit
 */
const checkQrScan = async (req, res, next) => {
  try {
    const qrLimit = getLimit(req.plan, "qr_accounts");
    if (qrLimit < 1) {
      return res.status(403).json(
        buildPlanError(
          "FEATURE_NOT_INCLUDED",
          "qr_accounts",
          0,
          0,
          "Your current plan does not allow WhatsApp QR instances."
        )
      );
    }

    const currentUsage = await getUsage(req.decode.uid, "qr_accounts");
    if (currentUsage >= qrLimit) {
      return res.status(403).json(
        buildPlanError(
          "PLAN_LIMIT_REACHED",
          "qr_accounts",
          currentUsage,
          qrLimit,
          `Your plan allows up to ${qrLimit} WhatsApp instance(s). You currently have ${currentUsage} active instance(s).`
        )
      );
    }

    next();
  } catch (err) {
    logger.log("Error in checkQrScan middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces Telegram inbox entitlement
 */
const checkTeleInbox = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "telegram")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "telegram_inbox",
        0,
        0,
        "Your current plan does not include the Telegram Inbox feature."
      )
    );
  } catch (err) {
    logger.log("Error in checkTeleInbox middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces Instagram inbox entitlement
 */
const checkInstaInbox = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "instagram")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "instagram_inbox",
        0,
        0,
        "Your current plan does not include the Instagram Inbox feature."
      )
    );
  } catch (err) {
    logger.log("Error in checkInstaInbox middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces WhatsApp Forms entitlement
 */
const checkWaForms = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "wa_forms")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "wa_forms",
        0,
        0,
        "Your current plan does not include WhatsApp Forms."
      )
    );
  } catch (err) {
    logger.log("Error in checkWaForms middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces Chatbot / Flow Builder entitlement
 */
const checkChatbot = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "chatbot")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "chatbot",
        0,
        0,
        "Your current plan does not allow Chatbot or Flow Builder automation."
      )
    );
  } catch (err) {
    logger.log("Error in checkChatbot middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces API access entitlement
 */
const checkApiAccess = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "api")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "api",
        0,
        0,
        "Your current plan does not include API access."
      )
    );
  } catch (err) {
    logger.log("Error in checkApiAccess middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

/**
 * Enforces QR REST API entitlement
 */
const checkRestApiQr = async (req, res, next) => {
  try {
    if (hasEntitlement(req.plan, "rest_api_qr")) {
      return next();
    }
    return res.status(403).json(
      buildPlanError(
        "FEATURE_NOT_INCLUDED",
        "rest_api_qr",
        0,
        0,
        "Your current plan does not include REST API QR capabilities."
      )
    );
  } catch (err) {
    logger.log("Error in checkRestApiQr middleware:", err);
    res.status(500).json({ success: false, msg: "Server error", err });
  }
};

module.exports = {
  checkPlan,
  checkContactLimit,
  checkNote,
  checkTags,
  checkWaWArmer,
  checkQrScan,
  checkWaForms,
  checkInstaInbox,
  checkTeleInbox,
  checkChatbot,
  checkApiAccess,
  checkRestApiQr,
};
