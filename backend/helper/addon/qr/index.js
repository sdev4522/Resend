const { toDataURL } = require("qrcode");
const pino = require("pino");
const { query } = require("../../../database/dbpromise");
const { processMessage } = require("../../inbox/inbox");
const newLogger = require("../../../utils/logger");

// Declare variables for baileys functions
let baileysLoaded = false;
let makeWASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  delay,
  downloadMediaMessage,
  getUrlInfo,
  generateProfilePicture,
  useMultiFileAuthState;

// Load baileys functions when needed
async function loadBaileysIfNeeded() {
  if (!baileysLoaded) {
    const baileys = await import("baileys");
    makeWASocket = baileys.default;
    ({
      makeCacheableSignalKeyStore,
      fetchLatestBaileysVersion,
      DisconnectReason,
      delay,
      downloadMediaMessage,
      getUrlInfo,
      generateProfilePicture,
      useMultiFileAuthState,
    } = baileys);
    baileysLoaded = true;
  }
}

// ============= CONFIGURATION =============

// Storage configuration (loaded from database)
let STORAGE_METHOD = "local";
let MONGODB_URI = null;

// MySQL Configuration (from environment or defaults)
const MYSQL_CONFIG = {
  host: process.env.DBHOST || "localhost",
  port: process.env.DBPORT || 3306,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  tableName: "auth",
  retryRequestDelayMs: 200,
};

// Local file storage
const fs = require("fs");
const path = require("path");
const sessionsDir = (sessionId = "") =>
  path.join(process.cwd(), "sessions", sessionId ? `md_${sessionId}` : "");

// Active connections tracking
const activeConnections = new Map();
// Pending QR connections tracking (TTL & isolation)
const pendingSessions = new Map(); // sessionId -> { timer: Timeout, createdAt: number, isReconnect: boolean }
const PENDING_QR_TTL_MS = 75000; // 75 seconds QR validity limit

// Lazy load storage modules
let useMySQLAuthState = null;
let useMongoDBAuthState = null;

// Configuration loaded flag
let configLoaded = false;

/**
 * Load configuration from database
 */
async function loadConfigFromDatabase() {
  if (configLoaded) return;

  try {
    const [config] = await query(`SELECT * FROM web_private`, []);

    if (config) {
      // Load MongoDB connection string from database
      if (config.mongodb_string) {
        MONGODB_URI = config.mongodb_string;
        newLogger.log("MongoDB URI loaded from database");
      }

      // Load storage method from database
      if (config.qr_storage) {
        STORAGE_METHOD = config.qr_storage.toLowerCase(); // mongodb/mysql/local
        newLogger.log(`Storage method loaded from database: ${STORAGE_METHOD}`);
      }
    }

    configLoaded = true;
  } catch (error) {
    newLogger.error("Error loading config from database:", error);
    newLogger.log("Using default configuration");
    configLoaded = true;
  }
}

/**
 * Get MongoDB configuration
 */
function getMongoDBConfig() {
  return {
    mongoUri: MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGO_DB_NAME || "wacrm_session",
  };
}

/**
 * Load the appropriate auth state module based on storage method
 */
async function loadAuthStateModule() {
  // Ensure config is loaded first
  await loadConfigFromDatabase();

  if (STORAGE_METHOD === "mysql" && !useMySQLAuthState) {
    const mysqlBaileys = require("mysql-baileys");
    useMySQLAuthState = mysqlBaileys.useMySQLAuthState;
  } else if (STORAGE_METHOD === "mongodb" && !useMongoDBAuthState) {
    const mongoSession = require("./mongoSession");
    useMongoDBAuthState = mongoSession.useMongoDBAuthState;
  } else if (STORAGE_METHOD === "local") {
  }
}

/**
 * Extract user ID from session ID
 */
function extractUidFromSessionId(input) {
  return input ? input.split("_")[0] : null;
}

/**
 * Resolve user ID from session ID or database fallback
 */
async function resolveUidForSession(sessionId) {
  if (!sessionId) return null;
  let uid = extractUidFromSessionId(sessionId);
  if (!uid || uid === sessionId) {
    try {
      const [inst] = await query("SELECT uid FROM instance WHERE uniqueId = ? LIMIT 1", [sessionId]);
      if (inst?.uid) uid = inst.uid;
    } catch (e) {
      newLogger.error("Failed to resolve UID for session:", e);
    }
  }
  return uid;
}

/**
 * Helper to emit socket events to user
 */
async function emitSocketToUser(sessionId, event, payload) {
  try {
    const { sendToUid } = require("../../../socket");
    if (typeof sendToUid === "function") {
      const uid = await resolveUidForSession(sessionId);
      if (uid) {
        sendToUid(uid, payload, event);
      }
    }
  } catch (err) {
    newLogger.error(`Socket emission error (${event}):`, err);
  }
}

/**
 * Extract phone number from WhatsApp ID
 */
function extractPhoneNumber(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(?=:|\@)/);
  return match ? match[1] : null;
}

/**
 * Check if a session exists in active connections
 */
const isSessionExists = (sessionId) => {
  return activeConnections.has(sessionId);
};

/**
 * Helper to delete local session files
 */
const deleteSessionFiles = async (sessionId) => {
  const sessionDir = sessionsDir(sessionId);
  try {
    await fs.promises.access(sessionDir);
  } catch {
    return; // directory doesn't exist
  }

  const files = await fs.promises.readdir(sessionDir);

  for (const file of files) {
    const filePath = path.join(sessionDir, file);
    const stat = await fs.promises.lstat(filePath);
    if (stat.isDirectory()) {
      await deleteSessionFiles(filePath);
    } else {
      await fs.promises.unlink(filePath);
    }
  }
  await fs.promises.rmdir(sessionDir);
};

// ============= AUTH STATE HANDLER =============

/**
 * Get authentication state based on storage method
 */
async function getAuthState(sessionId) {
  await loadAuthStateModule();

  switch (STORAGE_METHOD) {
    case "mysql":
      newLogger.log(`Using MySQL storage for session: ${sessionId}`);
      return await useMySQLAuthState({
        ...MYSQL_CONFIG,
        session: sessionId,
      });

    case "mongodb":
      newLogger.log(`Using MongoDB storage for session: ${sessionId}`);
      const mongoConfig = getMongoDBConfig();

      if (
        !mongoConfig.mongoUri ||
        mongoConfig.mongoUri === "mongodb://localhost:27017"
      ) {
        newLogger.warn("Warning: MongoDB URI not configured properly!");
      }

      return await useMongoDBAuthState({
        ...mongoConfig,
        session: sessionId,
      });

    case "local":
      return await useMultiFileAuthState(sessionsDir(sessionId));

    default:
      throw new Error(`Invalid storage method: ${STORAGE_METHOD}`);
  }
}

/**
 * Delete session data based on storage method
 */
async function deleteSessionData(sessionId) {
  switch (STORAGE_METHOD) {
    case "mysql":
      // MySQL cleanup is handled by removeCreds() during logout
      newLogger.log(`MySQL session data cleaned for: ${sessionId}`);
      break;

    case "mongodb":
      const { deleteSessionFromDB } = require("./mongoSession");
      await deleteSessionFromDB(sessionId);
      newLogger.log(`MongoDB session data deleted for: ${sessionId}`);
      break;

    case "local":
      await deleteSessionFiles(sessionId);
      newLogger.log(`Local files deleted for: ${sessionId}`);
      break;
  }
}

// ============= SESSION MANAGEMENT =============

/**
 * Create a new WhatsApp session
 */
const createSession = async (
  sessionId,
  title = "Chrome",
  options = { onQr: null, syncFullHistory: false, isPending: false, isReconnect: false },
) => {
  try {
    // Load baileys functions first
    await loadBaileysIfNeeded();

    // Ensure configuration is loaded
    await loadConfigFromDatabase();

    const logger = pino({ level: "silent" });
    const { error, version } = await fetchLatestBaileysVersion();

    if (error) {
      newLogger.log(
        `Session: ${sessionId} | No connection, check your internet.`,
      );
      return "No internet connection";
    }

    // Get authentication state based on storage method
    const { state, saveCreds, removeCreds } = await getAuthState(sessionId);

    // If this is a pending QR session, start isolated TTL timer
    if (options?.isPending) {
      const existing = pendingSessions.get(sessionId);
      if (existing?.timer) clearTimeout(existing.timer);

      const timer = setTimeout(async () => {
        newLogger.log(`Pending QR session ${sessionId} expired by TTL (${PENDING_QR_TTL_MS}ms)`);
        await expirePendingSession(sessionId);
      }, PENDING_QR_TTL_MS);

      pendingSessions.set(sessionId, {
        timer,
        createdAt: Date.now(),
        isReconnect: !!options.isReconnect,
      });
    }

    // Create WhatsApp connection
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      version,
      logger,
      printQRInTerminal: false,
      browser: [title, "", ""],
      syncFullHistory: options.syncFullHistory,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
    });

    // Store active connection
    activeConnections.set(sessionId, sock);

    // Handle credential updates
    sock.ev.on("creds.update", saveCreds);

    // Handle messages update (for message status / delivery receipts / poll updates)
    sock.ev.on("messages.update", async (m) => {
      if (!Array.isArray(m)) return;
      const uid = extractUidFromSessionId(sessionId);
      if (!uid) return;

      for (const message of m) {
        if (message?.update && message?.key?.remoteJid !== "status@broadcast") {
          if (message?.update?.status || message?.update?.pollUpdates) {
            processMessage({
              body: message,
              uid,
              origin: "qr",
              getSession,
              sessionId,
              qrType: "update",
            });
          }
        }
      }
    });

    const normalizeMessageJid = (msg) => {
      if (!msg?.key) return msg;

      const main = msg.key.remoteJid;
      const alt = msg.key.remoteJidAlt;

      if (main === "status@broadcast" || alt === "status@broadcast") {
        // Tag it so downstream code can detect it easily
        msg._isStatusBroadcast = true;
        return msg;
      }

      // For regular messages: pick the one ending with @s.whatsapp.net
      const correct =
        main && main.endsWith("@s.whatsapp.net")
          ? main
          : alt && alt.endsWith("@s.whatsapp.net")
            ? alt
            : main || alt;

      msg.key.remoteJid = correct;

      return msg;
    };

    sock.ev.on("messages.upsert", async (m) => {
      let message = m.messages[0];
      if (!message) return;

      message = normalizeMessageJid(message);

      const remoteJid = message.key.remoteJid;

      if (
        !remoteJid ||
        remoteJid === "status@broadcast" ||
        remoteJid.includes("broadcast") ||
        message._isStatusBroadcast === true ||
        message.key.fromMe === undefined ||
        // Stories often have a statusValue or status message type
        message.message?.protocolMessage?.type === 25 ||
        message.message?.senderKeyDistributionMessage?.groupId ===
          "status@broadcast"
      ) {
        return; // Skip — this is a Story/Status update
      }

      if (m.type === "notify" && remoteJid.endsWith("@s.whatsapp.net")) {
        const uid = extractUidFromSessionId(sessionId);
        if (uid) {
          processMessage({
            body: message,
            uid,
            origin: "qr",
            getSession,
            sessionId,
            qrType: "upsert",
          });
        }
      }
    });

    // Handle connection updates
    sock.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        if (connection === "open") {
          try {
            // Clear pending TTL timer
            const pending = pendingSessions.get(sessionId);
            if (pending?.timer) clearTimeout(pending.timer);
            pendingSessions.delete(sessionId);

            const userData = sock.user || {};
            const phoneNumber = extractPhoneNumber(userData?.id) || null;
            const uid = await resolveUidForSession(sessionId);

            // Duplicate Phone Number Check: prevent two active instances for same phone
            if (phoneNumber && uid) {
              const duplicate = await query(
                "SELECT uniqueId, title FROM instance WHERE uid = ? AND number = ? AND status = 'ACTIVE' AND uniqueId != ? LIMIT 1",
                [uid, phoneNumber, sessionId]
              );
              if (duplicate.length > 0) {
                newLogger.warn(
                  `Duplicate WhatsApp account (+${phoneNumber}) detected on session ${sessionId}. Already connected in ${duplicate[0].uniqueId}`
                );
                await emitSocketToUser(sessionId, "error", {
                  uniqueId: sessionId,
                  message: `This WhatsApp account (+${phoneNumber}) is already connected as "${duplicate[0].title}".`,
                });

                // Clean up duplicate session
                activeConnections.delete(sessionId);
                try {
                  await sock.logout();
                } catch (_) {}
                await deleteSessionData(sessionId);
                await query("DELETE FROM instance WHERE uniqueId = ? AND status = 'PENDING'", [sessionId]);
                return;
              }
            }

            await query(
              "UPDATE instance SET status = ?, number = ?, data = ?, qr = NULL WHERE uniqueId = ?",
              [
                "ACTIVE",
                phoneNumber,
                userData?.id ? JSON.stringify(userData) : null,
                sessionId,
              ],
            );

            await emitSocketToUser(sessionId, "qr_connected", {
              uniqueId: sessionId,
              number: phoneNumber,
              userData,
            });
          } catch (error) {
            newLogger.error("Database update error (open):", error);
          }
        } else if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          // Check if this was a pending session
          const isPending = pendingSessions.has(sessionId);
          if (isPending) {
            const pending = pendingSessions.get(sessionId);
            if (pending?.timer) clearTimeout(pending.timer);
            pendingSessions.delete(sessionId);
            activeConnections.delete(sessionId);

            // Clean up session storage
            await deleteSessionData(sessionId);

            // Clean up DB row
            try {
              if (pending?.isReconnect) {
                await query("UPDATE instance SET status = 'INACTIVE', qr = NULL WHERE uniqueId = ?", [sessionId]);
              } else {
                await query("DELETE FROM instance WHERE uniqueId = ? AND status = 'PENDING'", [sessionId]);
              }
            } catch (dbErr) {
              newLogger.error("DB cleanup error on pending close:", dbErr);
            }

            // Emit instance-scoped disconnect with isPending: true
            await emitSocketToUser(sessionId, "qr_disconnected", {
              uniqueId: sessionId,
              reason: statusCode,
              isPending: true,
            });

            newLogger.log(`Pending session ${sessionId} closed (code: ${statusCode}). Reconnection skipped.`);
            return; // NEVER RECONNECT PENDING UNSCANNED SESSIONS
          }

          // Authenticated (previously active) session disconnected
          await emitSocketToUser(sessionId, "qr_disconnected", {
            uniqueId: sessionId,
            reason: statusCode,
            isPending: false,
          });

          if (statusCode === DisconnectReason.loggedOut) {
            newLogger.log(`Session ${sessionId} logged out`);
            activeConnections.delete(sessionId);

            // Remove credentials based on storage method
            if (removeCreds) {
              await removeCreds();
            }
            await deleteSessionData(sessionId);

            try {
              await query("UPDATE instance SET status = ?, qr = NULL WHERE uniqueId = ?", [
                "INACTIVE",
                sessionId,
              ]);
            } catch (error) {
              newLogger.error("Database update error (logout):", error);
            }
          } else {
            // Only reconnect if this instance is still marked ACTIVE in MySQL
            try {
              const inst = await query("SELECT status FROM instance WHERE uniqueId = ? LIMIT 1", [sessionId]);
              if (inst.length && inst[0].status === "ACTIVE") {
                newLogger.log(
                  `Active session ${sessionId} disconnected (code: ${statusCode}), reconnecting...`,
                );
                setTimeout(() => createSession(sessionId, title, options), 5000);
              } else {
                newLogger.log(`Session ${sessionId} is inactive in DB, skipping reconnection.`);
                activeConnections.delete(sessionId);
              }
            } catch (err) {
              newLogger.error("Error checking instance status before reconnect:", err);
            }
          }
        }

        if (qr) {
          try {
            const qrCodeImage = await toDataURL(qr);
            try {
              await query("UPDATE instance SET qr = ? WHERE uniqueId = ?", [
                qrCodeImage,
                sessionId,
              ]);
            } catch (error) {
              newLogger.error("Database update error (qr):", error);
            }

            await emitSocketToUser(sessionId, "qr_code", {
              uniqueId: sessionId,
              qr: qrCodeImage,
            });

            if (typeof options.onQr === "function") {
              options.onQr(qrCodeImage);
            }
          } catch (error) {
            newLogger.error("QR processing error:", error);
          }
        }
      },
    );

    return "Session initiated";
  } catch (error) {
    newLogger.error(`Error creating session ${sessionId}:`, error);
    await emitSocketToUser(sessionId, "error", {
      uniqueId: sessionId,
      message: error.message || "Failed to create session",
    });
    return "Failed to create session";
  }
};

/**
 * Handle pending QR session expiration when TTL is reached
 */
const expirePendingSession = async (sessionId) => {
  try {
    const pending = pendingSessions.get(sessionId);
    if (pending?.timer) clearTimeout(pending.timer);
    pendingSessions.delete(sessionId);

    const sock = getSession(sessionId);
    if (sock) {
      try {
        sock.end();
      } catch (err) {
        newLogger.error(`Error ending expired socket ${sessionId}:`, err);
      }
      activeConnections.delete(sessionId);
    }

    await deleteSessionData(sessionId);

    try {
      if (pending?.isReconnect) {
        await query("UPDATE instance SET status = 'INACTIVE', qr = NULL WHERE uniqueId = ?", [sessionId]);
      } else {
        await query("DELETE FROM instance WHERE uniqueId = ? AND status = 'PENDING'", [sessionId]);
      }
    } catch (err) {
      newLogger.error("DB error on expirePendingSession:", err);
    }

    await emitSocketToUser(sessionId, "qr_expired", { uniqueId: sessionId });
    await emitSocketToUser(sessionId, "qr_disconnected", {
      uniqueId: sessionId,
      isPending: true,
      reason: 408,
    });

    newLogger.log(`Pending session ${sessionId} expired and cleaned up successfully.`);
    return true;
  } catch (err) {
    newLogger.error(`Error in expirePendingSession ${sessionId}:`, err);
    return false;
  }
};

/**
 * Explicitly cancel a pending QR session (e.g. user closed modal / clicked Cancel)
 */
const cancelPendingSession = async (sessionId) => {
  try {
    const pending = pendingSessions.get(sessionId);
    if (pending?.timer) clearTimeout(pending.timer);
    pendingSessions.delete(sessionId);

    const sock = getSession(sessionId);
    if (sock) {
      try {
        sock.end();
      } catch (err) {
        newLogger.error(`Error ending cancelled socket ${sessionId}:`, err);
      }
      activeConnections.delete(sessionId);
    }

    await deleteSessionData(sessionId);

    try {
      if (pending?.isReconnect) {
        await query("UPDATE instance SET status = 'INACTIVE', qr = NULL WHERE uniqueId = ?", [sessionId]);
      } else {
        await query("DELETE FROM instance WHERE uniqueId = ? AND status = 'PENDING'", [sessionId]);
      }
    } catch (err) {
      newLogger.error("DB error on cancelPendingSession:", err);
    }

    await emitSocketToUser(sessionId, "qr_disconnected", {
      uniqueId: sessionId,
      isPending: true,
      cancelled: true,
    });

    newLogger.log(`Pending session ${sessionId} cancelled by user.`);
    return true;
  } catch (err) {
    newLogger.error(`Error in cancelPendingSession ${sessionId}:`, err);
    return false;
  }
};

/**
 * Get an active session
 */
const getSession = (sessionId) => {
  return activeConnections.get(sessionId) || null;
};

/**
 * Delete a session
 */
const deleteSession = async (sessionId) => {
  try {
    const session = getSession(sessionId);
    if (session) {
      try {
        await session.logout();
      } catch (error) {
        newLogger.error(`Error logging out session ${sessionId}:`, error);
      }
      activeConnections.delete(sessionId);
    }

    // Delete session data based on storage method
    await deleteSessionData(sessionId);

    try {
      await query("UPDATE instance SET status = ? WHERE uniqueId = ?", [
        "INACTIVE",
        sessionId,
      ]);
    } catch (error) {
      newLogger.error("Database update error (deleteSession):", error);
    }
  } catch (error) {
    newLogger.error(`Error deleting session ${sessionId}:`, error);
  }
};

/**
 * Check if a phone number or group exists
 */
const isExists = async (session, jid, isGroup = false) => {
  try {
    let result;
    if (isGroup) {
      result = await session.groupMetadata(jid);
      return Boolean(result.id);
    }
    [result] = await session.onWhatsApp(jid);
    if (typeof result === "undefined") {
      const getNum = jid.replace("@s.whatsapp.net", "");
      [result] = await session.onWhatsApp(`+${getNum}`);
    }
    return result?.exists;
  } catch (err) {
    newLogger.error("isExists error:", err);
    return false;
  }
};

/**
 * Send a message
 */
const sendMessage = async (session, receiver, message) => {
  try {
    await loadBaileysIfNeeded();

    if (message?.text) {
      try {
        const linkPreview = await getUrlInfo(message.text, {
          thumbnailWidth: 1024,
          fetchOpts: { timeout: 5000 },
          uploadImage: session.waUploadToServer,
        });

        message = {
          text: message.text,
          linkPreview,
        };
      } catch (error) {
        newLogger.error("Error generating link preview:", error);
      }
    }

    await delay(1000);
    return session.sendMessage(receiver, message);
  } catch (err) {
    newLogger.error("sendMessage error:", err);
    return Promise.reject(null);
  }
};

/**
 * Get group metadata
 */
const getGroupData = async (session, jid) => {
  try {
    return await session.groupMetadata(jid);
  } catch (err) {
    newLogger.error("getGroupData error:", err);
    return Promise.reject(null);
  }
};

/**
 * Format phone number to WhatsApp JID
 */
const formatPhone = (phone) => {
  if (phone.endsWith("@s.whatsapp.net")) return phone;
  let formatted = phone.replace(/\D/g, "");
  return formatted + "@s.whatsapp.net";
};

/**
 * Format group ID to WhatsApp group JID
 */
const formatGroup = (group) => {
  if (group.endsWith("@g.us")) return group;
  let formatted = group.replace(/[^\d-]/g, "");
  return formatted + "@g.us";
};

/**
 * Cleanup function for graceful shutdown
 */
const cleanup = async () => {
  newLogger.log("Running cleanup before exit...");
  const cleanupPromises = [];

  activeConnections.forEach((session, sessionId) => {
    newLogger.log(`Closing session ${sessionId}`);
    cleanupPromises.push(
      session.end().catch((error) => {
        newLogger.error(`Error closing session ${sessionId}:`, error);
      }),
    );
  });

  await Promise.allSettled(cleanupPromises);
  newLogger.log("Cleanup completed");
};

/**
 * Initialize existing sessions from database or local files
 */
const init = async () => {
  try {
    await loadBaileysIfNeeded();
    await loadConfigFromDatabase();

    // Clean up any stale pending or unfinalized sessions in DB on startup
    await query("DELETE FROM instance WHERE status IN ('PENDING', 'GENERATING') OR status IS NULL", []);

    // ONLY initialize instances from database that are confirmed ACTIVE
    const instances = await query(
      "SELECT uniqueId, title FROM instance WHERE status = 'ACTIVE'",
      [],
    );

    const activeSet = new Set(instances.map((i) => i.uniqueId));

    if (STORAGE_METHOD === "local") {
      const sessionsPath = sessionsDir();
      try {
        await fs.promises.access(sessionsPath);
        const files = await fs.promises.readdir(sessionsPath);
        for (const file of files) {
          if (!file.startsWith("md_")) continue;
          const sessionId = file.replace("md_", "");
          // If directory is NOT in active instances, clean it up to prevent ghost sessions
          if (!activeSet.has(sessionId)) {
            newLogger.log(`Cleaning up orphaned session directory on init: ${file}`);
            await deleteSessionFiles(sessionId);
          }
        }
      } catch (err) {
        newLogger.warn("Local sessions dir access check on init:", err?.message);
      }
    }

    // Now start only the confirmed active sessions
    for (const instance of instances) {
      await createSession(instance.uniqueId, instance.title || "WhatsApp Web");
    }
  } catch (error) {
    newLogger.error("Error initializing sessions:", error);
  }
};

/**
 * Check if QR code functionality is available
 */
function checkQr() {
  return true;
}

/**
 * Get current storage configuration (for debugging/monitoring)
 */
const getStorageConfig = async () => {
  await loadConfigFromDatabase();
  return {
    method: STORAGE_METHOD,
    mongoUri: MONGODB_URI ? "***configured***" : "not set",
    mysqlHost: MYSQL_CONFIG.host,
  };
};

// Wrapper functions
const wrappedGetUrlInfo = async (...args) => {
  await loadBaileysIfNeeded();
  return getUrlInfo(...args);
};

const wrappedDownloadMediaMessage = async (...args) => {
  await loadBaileysIfNeeded();
  return downloadMediaMessage(...args);
};

const wrappedGenerateProfilePicture = async (...args) => {
  await loadBaileysIfNeeded();
  return generateProfilePicture(...args);
};

// ============= EXPORTS =============

module.exports = {
  isSessionExists,
  createSession,
  getSession,
  deleteSession,
  cancelPendingSession,
  expirePendingSession,
  isExists,
  sendMessage,
  formatPhone,
  formatGroup,
  cleanup,
  init,
  getGroupData,
  getUrlInfo: wrappedGetUrlInfo,
  downloadMediaMessage: wrappedDownloadMediaMessage,
  checkQr,
  generateProfilePicture: wrappedGenerateProfilePicture,
  getStorageConfig, // Export for debugging
};
