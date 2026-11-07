const { prisma } = require("../database/prisma");
const logger = require("../utils/logger");

/**
 * Resolves a user's active plan.
 * Prioritizes live row from `plan` table matching snapshot ID for dynamic propagation.
 * Falls back to stored plan snapshot if DB row is missing.
 */
async function resolveUserPlan(userRecord) {
  if (!userRecord || !userRecord.plan) {
    return {
      isValid: false,
      isExpired: false,
      plan: null,
      message: "No subscription plan found",
    };
  }

  let snapshot;
  try {
    snapshot =
      typeof userRecord.plan === "string"
        ? JSON.parse(userRecord.plan)
        : userRecord.plan;
  } catch (err) {
    logger.log("Failed to parse user plan JSON:", err);
    return {
      isValid: false,
      isExpired: false,
      plan: null,
      message: "Invalid plan data",
    };
  }

  // Check expiry against the exact timestamp (a plan with < 24h left is still valid)
  const expireAt = Number(userRecord.plan_expire);
  const msLeft = Number.isFinite(expireAt) ? expireAt - Date.now() : 0;
  const daysLeft = msLeft > 0 ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0;
  if (msLeft <= 0) {
    return {
      isValid: false,
      isExpired: true,
      daysLeft,
      plan: snapshot,
      message: "Subscription plan has expired",
    };
  }

  // Live lookup from database for real-time propagation of admin updates
  let livePlan = snapshot;
  const snapshotId = parseInt(snapshot?.id, 10);
  if (Number.isInteger(snapshotId)) {
    try {
      const row = await prisma.plan.findFirst({ where: { id: snapshotId } });
      if (row) {
        livePlan = { ...row, price: row.price != null ? Number(row.price) : 0 };
      }
    } catch (err) {
      logger.log("Error fetching live plan from DB:", err);
    }
  }

  return {
    isValid: true,
    isExpired: false,
    daysLeft,
    plan: livePlan,
    message: "Active subscription plan",
  };
}

/**
 * Check if a plan has a boolean capability enabled
 */
function hasEntitlement(plan, featureKey) {
  if (!plan) return false;

  switch (featureKey) {
    case "tags":
    case "allow_tag":
      return Number(plan.allow_tag) > 0;

    case "notes":
    case "allow_note":
      return Number(plan.allow_note) > 0;

    case "chatbot":
    case "allow_chatbot":
      return Number(plan.allow_chatbot) > 0;

    case "api":
    case "allow_api":
      return Number(plan.allow_api) > 0;

    case "wa_warmer":
      return Number(plan.wa_warmer) > 0;

    case "rest_api_qr":
      return Number(plan.rest_api_qr) > 0;

    case "instagram":
    case "instagram_inbox":
      return Number(plan.instagram_inbox) > 0;

    case "telegram":
    case "telegram_inbox":
      return Number(plan.telegram_inbox) > 0;

    case "wa_forms":
    case "allow_wa_forms":
      return Number(plan.allow_wa_forms) > 0;

    case "messenger":
    case "messenger_inbox":
      return Number(plan.messenger_inbox) > 0;

    default:
      return false;
  }
}

/**
 * Get numeric limit for a resource
 */
function getLimit(plan, limitKey) {
  if (!plan) return 0;

  switch (limitKey) {
    case "contacts":
    case "contact_limit":
      return parseInt(plan.contact_limit, 10) || 0;

    case "qr_accounts":
    case "qr_account":
      return parseInt(plan.qr_account, 10) || 0;

    default:
      return 0;
  }
}

/**
 * Query current usage count for a user
 * @param {object} [options]
 * @param {string} [options.excludeUniqueId] - qr_accounts only: do not count this instance
 *   (used when re-connecting / re-scanning an instance the user already owns)
 */
async function getUsage(uid, limitKey, options = {}) {
  if (!uid) return 0;

  switch (limitKey) {
    case "contacts":
    case "contact_limit": {
      return prisma.contact.count({ where: { uid } });
    }

    case "qr_accounts":
    case "qr_account": {
      const where = { uid, status: "ACTIVE" };
      if (options.excludeUniqueId) {
        where.NOT = { uniqueId: options.excludeUniqueId };
      }
      return prisma.instance.count({ where });
    }

    default:
      return 0;
  }
}

/**
 * Get normalized entitlements map for a plan
 */
function getAllEntitlements(plan) {
  return {
    tags: hasEntitlement(plan, "tags"),
    notes: hasEntitlement(plan, "notes"),
    chatbot: hasEntitlement(plan, "chatbot"),
    api: hasEntitlement(plan, "api"),
    wa_warmer: hasEntitlement(plan, "wa_warmer"),
    rest_api_qr: hasEntitlement(plan, "rest_api_qr"),
    instagram_inbox: hasEntitlement(plan, "instagram_inbox"),
    telegram_inbox: hasEntitlement(plan, "telegram_inbox"),
    allow_wa_forms: hasEntitlement(plan, "allow_wa_forms"),
    messenger_inbox: hasEntitlement(plan, "messenger_inbox"),
  };
}

/**
 * Build consistent plan error response payload
 */
function buildPlanError(code, resource, current, limit, message) {
  return {
    success: false,
    code,
    resource,
    current,
    limit,
    msg: message,
  };
}

module.exports = {
  resolveUserPlan,
  hasEntitlement,
  getLimit,
  getUsage,
  getAllEntitlements,
  buildPlanError,
};
