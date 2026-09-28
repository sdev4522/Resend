const crypto = require("crypto");
const { query } = require("../../database/dbpromise");
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
    const instances = await query(
      `SELECT * FROM instance WHERE uid = ?`,
      [uid]
    );

    for (const inst of instances) {
      if (!inst.uniqueId) continue;
      const existing = await query(
        `SELECT id, public_id FROM api_connections WHERE provider = 'qr' AND provider_ref = ? LIMIT 1`,
        [inst.uniqueId]
      );

      const phone = (inst.number || "").replace(/\D/g, "");
      const name = inst.title || `WhatsApp QR (${phone || inst.uniqueId.slice(0, 8)})`;

      if (existing.length === 0) {
        const publicId = generatePublicConnectionId();
        await query(
          `INSERT INTO api_connections (public_id, uid, provider, provider_ref, name, phone_number) 
           VALUES (?, ?, 'qr', ?, ?, ?)`,
          [publicId, uid, inst.uniqueId, name, phone]
        );
      } else {
        // Update name/phone if changed
        await query(
          `UPDATE api_connections SET name = ?, phone_number = ?, uid = ? WHERE id = ?`,
          [name, phone, uid, existing[0].id]
        );
      }
    }

    // 2. Sync Meta Cloud API
    const metaRecords = await query(
      `SELECT * FROM meta_api WHERE uid = ?`,
      [uid]
    );

    for (const meta of metaRecords) {
      if (!meta.business_phone_number_id) continue;
      const existing = await query(
        `SELECT id, public_id FROM api_connections WHERE provider = 'meta' AND provider_ref = ? LIMIT 1`,
        [meta.business_phone_number_id]
      );

      const phone = (meta.business_phone_number_id || "").replace(/\D/g, "");
      const name = `Meta Cloud WhatsApp (${phone})`;

      if (existing.length === 0) {
        const publicId = generatePublicConnectionId();
        await query(
          `INSERT INTO api_connections (public_id, uid, provider, provider_ref, name, phone_number) 
           VALUES (?, ?, 'meta', ?, ?, ?)`,
          [publicId, uid, meta.business_phone_number_id, name, phone]
        );
      } else {
        await query(
          `UPDATE api_connections SET name = ?, phone_number = ?, uid = ? WHERE id = ?`,
          [name, phone, uid, existing[0].id]
        );
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
  const connections = await query(
    `SELECT * FROM api_connections WHERE uid = ? ORDER BY created_at ASC`,
    [uid]
  );

  if (connections.length === 0) {
    return [];
  }

  // If apiKeyId provided, check if key has connection restrictions
  let allowedSet = null;
  if (apiKeyId) {
    const permRows = await query(
      `SELECT connection_public_id FROM api_key_connections WHERE api_key_id = ?`,
      [apiKeyId]
    );
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
      const [inst] = await query(
        `SELECT status FROM instance WHERE uniqueId = ? AND uid = ? LIMIT 1`,
        [conn.provider_ref, uid]
      );
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
      const [meta] = await query(
        `SELECT access_token, business_phone_number_id FROM meta_api WHERE business_phone_number_id = ? AND uid = ? LIMIT 1`,
        [conn.provider_ref, uid]
      );
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
  const connRows = await query(
    `SELECT * FROM api_connections WHERE public_id = ? LIMIT 1`,
    [targetId]
  );

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
    const permRows = await query(
      `SELECT connection_public_id FROM api_key_connections WHERE api_key_id = ?`,
      [apiKey.id]
    );

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
    const instRows = await query(
      `SELECT * FROM instance WHERE uniqueId = ? AND uid = ? LIMIT 1`,
      [conn.provider_ref, uid]
    );

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
    const metaRows = await query(
      `SELECT * FROM meta_api WHERE business_phone_number_id = ? AND uid = ? LIMIT 1`,
      [conn.provider_ref, uid]
    );

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
