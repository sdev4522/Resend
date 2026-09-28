const crypto = require("crypto");
const { query } = require("../../database/dbpromise");
const logger = require("../../utils/logger");

const DEFAULT_PREFIX = process.env.API_KEY_PREFIX || "rk_live_";

/**
 * Standard granular API scopes supported by the platform
 */
const VALID_SCOPES = [
  "messages:send",
  "messages:read",
  "contacts:read",
  "templates:read",
  "templates:send",
  "connections:read",
  "usage:read",
];

/**
 * Generate a cryptographically secure random API key
 * Returns the raw secret ONLY ONCE at generation time.
 */
async function generateApiKey({
  uid,
  name,
  scopes = [],
  allowedConnections = [],
  defaultConnectionId = null,
  expiresAt = null,
  rateLimitPolicy = null,
}) {
  if (!uid) throw new Error("Workspace UID is required");
  if (!name || typeof name !== "string") throw new Error("A descriptive key name is required");

  // Filter scopes to valid set
  const filteredScopes = scopes.filter((s) => VALID_SCOPES.includes(s));
  if (filteredScopes.length === 0) {
    throw new Error("At least one valid scope is required");
  }

  // Generate 32 bytes of cryptographic randomness (hex string = 64 characters)
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const secret = `${DEFAULT_PREFIX}${randomBytes}`;
  
  // Safe prefix for user display e.g. "rk_live_a1b2c3d4"
  const safePrefix = `${DEFAULT_PREFIX}${randomBytes.slice(0, 8)}`;
  
  // Cryptographic SHA-256 hash for secure database storage
  const keyHash = crypto.createHash("sha256").update(secret).digest("hex");

  const result = await query(
    `INSERT INTO api_keys 
     (uid, name, key_prefix, key_hash, status, scopes, rate_limit_policy, default_connection_id, expires_at) 
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      uid,
      name.trim(),
      safePrefix,
      keyHash,
      JSON.stringify(filteredScopes),
      rateLimitPolicy ? JSON.stringify(rateLimitPolicy) : null,
      defaultConnectionId || null,
      expiresAt ? new Date(expiresAt) : null,
    ]
  );

  const keyId = result.insertId;

  // Insert allowed connections if specified
  if (Array.isArray(allowedConnections) && allowedConnections.length > 0) {
    for (const connPublicId of allowedConnections) {
      if (connPublicId) {
        await query(
          `INSERT IGNORE INTO api_key_connections (api_key_id, connection_public_id) VALUES (?, ?)`,
          [keyId, connPublicId]
        );
      }
    }
  }

  return {
    id: keyId,
    uid,
    name: name.trim(),
    key_prefix: safePrefix,
    scopes: filteredScopes,
    default_connection_id: defaultConnectionId || null,
    allowed_connections: allowedConnections,
    expires_at: expiresAt || null,
    secret, // Only returned once!
  };
}

/**
 * Validates a raw Bearer API key against the database
 */
async function validateApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") {
    return { valid: false, code: "INVALID_API_KEY", message: "Missing or malformed API key." };
  }

  const cleanKey = rawKey.trim();
  const keyHash = crypto.createHash("sha256").update(cleanKey).digest("hex");

  const rows = await query(`SELECT * FROM api_keys WHERE key_hash = ? LIMIT 1`, [keyHash]);

  if (!rows || rows.length === 0) {
    return { valid: false, code: "INVALID_API_KEY", message: "Invalid API key." };
  }

  const keyRecord = rows[0];

  if (keyRecord.status === "revoked") {
    return { valid: false, code: "API_KEY_REVOKED", message: "This API key has been revoked." };
  }

  if (keyRecord.expires_at) {
    const expiryTime = new Date(keyRecord.expires_at).getTime();
    if (Date.now() > expiryTime) {
      // Mark as expired in DB
      if (keyRecord.status !== "expired") {
        await query(`UPDATE api_keys SET status = 'expired' WHERE id = ?`, [keyRecord.id]);
      }
      return { valid: false, code: "INVALID_API_KEY", message: "This API key has expired." };
    }
  }

  let scopes = [];
  try {
    scopes = typeof keyRecord.scopes === "string" ? JSON.parse(keyRecord.scopes) : keyRecord.scopes;
  } catch (err) {
    scopes = [];
  }

  // Throttled update for last_used_at (once every 60s per key max)
  touchLastUsed(keyRecord.id, keyRecord.last_used_at);

  return {
    valid: true,
    key: keyRecord,
    scopes,
  };
}

/**
 * Throttled update for last_used_at to minimize DB load
 */
function touchLastUsed(keyId, currentLastUsed) {
  const now = Date.now();
  if (!currentLastUsed || now - new Date(currentLastUsed).getTime() > 60000) {
    query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = ?`, [keyId]).catch((err) => {
      logger.error("Failed to update last_used_at for key:", keyId, err.message);
    });
  }
}

/**
 * Revoke an API key immediately
 */
async function revokeApiKey(keyId, uid) {
  const result = await query(
    `UPDATE api_keys 
     SET status = 'revoked', revoked_at = NOW() 
     WHERE id = ? AND uid = ?`,
    [keyId, uid]
  );
  return result.affectedRows > 0;
}

/**
 * List all API keys for a workspace (without secrets)
 */
async function listApiKeys(uid) {
  const rows = await query(
    `SELECT id, uid, name, key_prefix, status, scopes, default_connection_id, expires_at, last_used_at, created_at, revoked_at
     FROM api_keys
     WHERE uid = ?
     ORDER BY created_at DESC`,
    [uid]
  );

  const keysWithConnections = [];

  for (const row of rows) {
    let scopes = [];
    try {
      scopes = typeof row.scopes === "string" ? JSON.parse(row.scopes) : row.scopes;
    } catch {
      scopes = [];
    }

    const connRows = await query(
      `SELECT connection_public_id FROM api_key_connections WHERE api_key_id = ?`,
      [row.id]
    );

    keysWithConnections.push({
      ...row,
      scopes,
      allowed_connections: connRows.map((c) => c.connection_public_id),
    });
  }

  return keysWithConnections;
}

module.exports = {
  VALID_SCOPES,
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  touchLastUsed,
};
