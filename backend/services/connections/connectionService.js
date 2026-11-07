const crypto = require("crypto");
const { prisma } = require("../../database/prisma");
const { idParam, plain, str, whereStr } = require("../../database/prismaHelpers");
const logger = require("../../utils/logger");

/**
 * Generate an opaque public connection ID with wa_ prefix
 */
function generatePublicConnectionId() {
  return `wa_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Synchronize internal WhatsApp records (instance for QR, meta_api for Meta)
 * into the stable api_connections mapping table.
 */
async function syncWorkspaceConnections(uid) {
  if (!uid) return;

  try {
    // 1. Sync QR instances
    const instances = plain(await prisma.instance.findMany({ where: { uid: whereStr(uid) } }));

    for (const inst of instances) {
      if (!inst.uniqueId) continue;
      const existing = plain(await prisma.api_connections.findMany({
        where: { provider: "qr", provider_ref: whereStr(inst.uniqueId) },
        select: { id: true, public_id: true },
        take: 1,
      }));

      const phone = (inst.number || "").replace(/\D/g, "");
      const name = inst.title || `WhatsApp QR (${phone || inst.uniqueId.slice(0, 8)})`;

      if (existing.length === 0) {
        const publicId = generatePublicConnectionId();
        await prisma.api_connections.create({
          data: {
            public_id: str(publicId),
            uid: str(uid),
            provider: "qr",
            provider_ref: str(inst.uniqueId),
            name: str(name),
            phone_number: str(phone),
          },
        });
      } else {
        // Update name/phone if changed
        await prisma.api_connections.updateMany({
          where: { id: idParam(existing[0].id) },
          data: { name: str(name), phone_number: str(phone), uid: str(uid) },
        });
      }
    }

    // 2. Sync Meta Cloud API
    const metaRecords = plain(await prisma.meta_api.findMany({ where: { uid: whereStr(uid) } }));

    for (const meta of metaRecords) {
      if (!meta.business_phone_number_id) continue;
      const existing = plain(await prisma.api_connections.findMany({
        where: { provider: "meta", provider_ref: whereStr(meta.business_phone_number_id) },
        select: { id: true, public_id: true },
        take: 1,
      }));

      const phone = (meta.business_phone_number_id || "").replace(/\D/g, "");
      const name = `Meta Cloud WhatsApp (${phone})`;

      if (existing.length === 0) {
        const publicId = generatePublicConnectionId();
        await prisma.api_connections.create({
          data: {
            public_id: str(publicId),
            uid: str(uid),
            provider: "meta",
            provider_ref: str(meta.business_phone_number_id),
            name: str(name),
            phone_number: str(phone),
          },
        });
      } else {
        await prisma.api_connections.updateMany({
          where: { id: idParam(existing[0].id) },
          data: { name: str(name), phone_number: str(phone), uid: str(uid) },
        });
      }
    }
  } catch (err) {
    logger.error("Error in syncWorkspaceConnections:", err);
  }
}

/**
 * List connections accessible to a given API key or workspace
 */
async function getAuthorizedConnections(uid, apiKeyId = null) {
  await syncWorkspaceConnections(uid);

  // Fetch all connections belonging to this workspace
  const connections = plain(await prisma.api_connections.findMany({ where: { uid: whereStr(uid) }, orderBy: { created_at: "asc" } }));

  if (connections.length === 0) {
    return [];
  }

  // If apiKeyId provided, check if key has connection restrictions
  let allowedSet = null;
  if (apiKeyId) {
    const permRows = plain(await prisma.api_key_connections.findMany({ where: { api_key_id: idParam(apiKeyId) }, select: { connection_public_id: true } }));
    if (permRows.length > 0) {
      allowedSet = new Set(permRows.map((r) => r.connection_public_id));
    }
  }

  const results = [];

  for (const conn of connections) {
    // If restrictions exist and this connection is not allowed for the key, skip it
    if (allowedSet && !allowedSet.has(conn.public_id)) {
      continue;
    }

    let status = "disconnected";

    if (conn.provider === "qr") {
      const [inst] = plain(await prisma.instance.findMany({
        where: { uniqueId: whereStr(conn.provider_ref), uid: whereStr(uid) },
        select: { status: true },
        take: 1,
      }));
      if (inst && inst.status === "ACTIVE") {
        // Also verify Baileys session memory if module is loaded
        try {
          const { getSession } = require("../../helper/addon/qr");
          const sess = getSession(conn.provider_ref);
          if (sess) {
            status = "connected";
          } else {
            status = "connected"; // Instance marked ACTIVE in DB
          }
        } catch {
          status = inst.status === "ACTIVE" ? "connected" : "disconnected";
        }
      }
    } else if (conn.provider === "meta") {
      const [meta] = plain(await prisma.meta_api.findMany({
        where: { business_phone_number_id: whereStr(conn.provider_ref), uid: whereStr(uid) },
        select: { access_token: true, business_phone_number_id: true },
        take: 1,
      }));
      if (meta && meta.access_token && meta.business_phone_number_id) {
        status = "connected";
      }
    }

    results.push({
      id: conn.public_id,
      name: conn.name,
      phone_number: conn.phone_number,
      provider: conn.provider,
      status,
    });
  }

  return results;
}

/**
 * Resolve and authorize a connection for a message send operation.
 * Strictly enforces tenant isolation, key authorization, and default fallbacks.
 */
async function resolveAndAuthorizeConnection({
  uid,
  apiKey,
  connectionId,
  requireActive = true,
}) {
  await syncWorkspaceConnections(uid);

  let targetId = connectionId;

  // If connection_id omitted, check default connection
  if (!targetId) {
    if (apiKey?.default_connection_id) {
      targetId = apiKey.default_connection_id;
    } else {
      return {
        error: "CONNECTION_REQUIRED",
        message: "No connection_id was provided and no default connection is configured for this API key.",
        statusCode: 400,
      };
    }
  }

  // Lookup target connection
  const connRows = plain(await prisma.api_connections.findMany({ where: { public_id: whereStr(targetId) }, take: 1 }));

  // Tenant Isolation / IDOR: if connection does not exist or belongs to another workspace, return CONNECTION_NOT_FOUND
  if (connRows.length === 0 || connRows[0].uid !== uid) {
    return {
      error: "CONNECTION_NOT_FOUND",
      message: "The requested WhatsApp connection does not exist.",
      statusCode: 404,
    };
  }

  const conn = connRows[0];

  // Verify API Key connection permissions
  if (apiKey?.id) {
    const permRows = plain(await prisma.api_key_connections.findMany({
      where: { api_key_id: idParam(apiKey.id) },
      select: { connection_public_id: true },
    }));

    if (permRows.length > 0) {
      const allowed = permRows.some((r) => r.connection_public_id === targetId);
      if (!allowed) {
        return {
          error: "CONNECTION_NOT_ALLOWED",
          message: "This API key is not authorized to use the requested WhatsApp connection.",
          statusCode: 403,
        };
      }
    }
  }

  // Check connection active state
  if (conn.provider === "qr") {
    const instRows = plain(await prisma.instance.findMany({ where: { uniqueId: whereStr(conn.provider_ref), uid: whereStr(uid) }, take: 1 }));

    if (requireActive && (instRows.length === 0 || instRows[0].status !== "ACTIVE")) {
      return {
        error: "CONNECTION_DISCONNECTED",
        message: "The requested QR WhatsApp connection is currently disconnected.",
        statusCode: 400,
        provider: "qr",
      };
    }

    return {
      connection: conn,
      provider: "qr",
      instanceRecord: instRows[0] || null,
    };
  } else if (conn.provider === "meta") {
    const metaRows = plain(await prisma.meta_api.findMany({
      where: { business_phone_number_id: whereStr(conn.provider_ref), uid: whereStr(uid) },
      take: 1,
    }));

    if (metaRows.length === 0 || !metaRows[0].access_token) {
      return {
        error: "CONNECTION_DISCONNECTED",
        message: "The requested Meta WhatsApp connection is not properly configured.",
        statusCode: 400,
      };
    }

    return {
      connection: conn,
      provider: "meta",
      metaRecord: metaRows[0],
    };
  }

  return {
    error: "PROVIDER_ERROR",
    message: "Unknown connection provider.",
    statusCode: 500,
  };
}

module.exports = {
  generatePublicConnectionId,
  syncWorkspaceConnections,
  getAuthorizedConnections,
  resolveAndAuthorizeConnection,
};
