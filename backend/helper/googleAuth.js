const { OAuth2Client } = require("google-auth-library");
const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");

/**
 * Retrieves the authoritative Google OAuth configuration.
 * Merges persisted database settings (web_public & web_private) with environment variables.
 */
async function getGoogleAuthConfig() {
  try {
    const [webPublic] = await query(
      "SELECT google_client_id, google_login_active FROM web_public LIMIT 1"
    );
    const [webPrivate] = await query(
      "SELECT google_client_secret FROM web_private LIMIT 1"
    );

    const clientId = (
      webPublic?.google_client_id ||
      process.env.GOOGLE_CLIENT_ID ||
      ""
    ).trim();

    const clientSecret = (
      webPrivate?.google_client_secret ||
      process.env.GOOGLE_CLIENT_SECRET ||
      ""
    ).trim();

    // Default to active unless explicitly set to 0 in DB or "false" in env
    const isDbActive = webPublic?.google_login_active !== undefined ? Number(webPublic.google_login_active) === 1 : true;
    const isEnvActive = process.env.GOOGLE_LOGIN_ACTIVE !== "false";
    const isActive = isDbActive && isEnvActive;

    return {
      clientId,
      clientSecret,
      isActive,
      isConfigured: Boolean(clientId),
    };
  } catch (err) {
    logger.error("Error reading Google OAuth configuration:", err);
    return {
      clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      isActive: false,
      isConfigured: false,
    };
  }
}

/**
 * Verifies a Google ID token cryptographically against the configured Google Client ID.
 * Returns the verified user payload { sub, email, email_verified, name, picture }.
 *
 * @param {Object} params
 * @param {string} params.idToken - The raw Google ID token (JWT)
 * @param {string} params.clientId - The expected Google Client ID (audience)
 * @returns {Promise<{ success: boolean, payload?: Object, error?: string, code?: string }>}
 */
async function verifyGoogleIdToken({ idToken, clientId }) {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    return {
      success: false,
      code: "TOKEN_MISSING",
      error: "Google ID token is required.",
    };
  }

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return {
      success: false,
      code: "GOOGLE_NOT_CONFIGURED",
      error: "Google Client ID is not configured on the server.",
    };
  }

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return {
        success: false,
        code: "INVALID_TOKEN",
        error: "Failed to extract payload from Google token.",
      };
    }

    // Verify audience matches configured clientId
    const aud = payload.aud;
    if (aud !== clientId) {
      return {
        success: false,
        code: "AUDIENCE_MISMATCH",
        error: "Token audience does not match configured Google Client ID.",
      };
    }

    // Verify issuer is Google
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!validIssuers.includes(payload.iss)) {
      return {
        success: false,
        code: "INVALID_ISSUER",
        error: "Token issuer is not accounts.google.com.",
      };
    }

    // Verify email is present
    if (!payload.email || typeof payload.email !== "string") {
      return {
        success: false,
        code: "EMAIL_MISSING",
        error: "Google account does not have an associated email address.",
      };
    }

    // Require verified email
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      return {
        success: false,
        code: "GOOGLE_EMAIL_NOT_VERIFIED",
        error: "Google email address is not verified. Please verify it with Google before signing in.",
      };
    }

    return {
      success: true,
      payload: {
        sub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        email_verified: true,
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture || null,
      },
    };
  } catch (err) {
    logger.error("Google ID token verification failed:", err.message);
    return {
      success: false,
      code: "TOKEN_VERIFICATION_FAILED",
      error: "Google token verification failed: " + (err.message || "Invalid or expired token."),
    };
  }
}

/**
 * Exchanges an authorization code for tokens and verifies the ID token.
 * Used when client performs server-side authorization code flow.
 *
 * @param {Object} params
 * @param {string} params.code - Authorization code from Google OAuth
 * @param {string} params.redirectUri - Redirect URI configured in Google Cloud Console
 * @param {string} params.clientId - Google Client ID
 * @param {string} params.clientSecret - Google Client Secret
 */
async function exchangeGoogleCode({ code, redirectUri, clientId, clientSecret }) {
  if (!code || !clientId || !clientSecret) {
    return {
      success: false,
      code: "MISSING_PARAMETERS",
      error: "Authorization code, client ID, and client secret are required.",
    };
  }

  try {
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri || "postmessage");
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens || !tokens.id_token) {
      return {
        success: false,
        code: "NO_ID_TOKEN",
        error: "Google did not return an ID token.",
      };
    }

    return await verifyGoogleIdToken({ idToken: tokens.id_token, clientId });
  } catch (err) {
    logger.error("Google authorization code exchange failed:", err.message);
    return {
      success: false,
      code: "CODE_EXCHANGE_FAILED",
      error: "Failed to exchange authorization code: " + (err.message || "Invalid code."),
    };
  }
}

module.exports = {
  getGoogleAuthConfig,
  verifyGoogleIdToken,
  exchangeGoogleCode,
};
