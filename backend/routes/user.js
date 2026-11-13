const router = require("express").Router();
const dbpromise = require("../database/dbpromise.js");
const query = (...args) => dbpromise.query(...args);
const { prisma, sanitizeBigInt } = require("../database/prisma.js");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  getFileExtension,
  getBusinessPhoneNumber,
  createMetaTemplet,
  getAllTempletsMeta,
  delMetaTemplet,
  getFileInfo,
  getSessionUploadMediaMeta,
  uploadFileMeta,
  updateUserPlan,
  getUserOrderssByMonth,
  sendEmail,
  fetchProfileFun,
  returnWidget,
  generateWhatsAppURL,
  rzCapturePayment,
  validateFacebookToken,
  getAllTempletsMetaBeta,
  extractTemplateVariablesBeta,
  sendTemplateMessage,
  sendFCMNotification,
  removeTokenFromAll,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const Stripe = require("stripe");
const {
  checkPlan,
  checkNote,
  checkTags,
  checkContactLimit,
  checkWaWArmer,
} = require("../middlewares/plan.js");
const crypto = require("crypto");
const { recoverEmail, verificationOtpEmail } = require("../emails/returnEmails.js");
const { authRateLimiter, signupRateLimiter, getClientIp } = require("../middlewares/rateLimiter.js");
const { verifyTurnstileToken } = require("../utils/turnstile.js");
const moment = require("moment");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const { checkQr } = require("../helper/addon/qr/index.js");
const { addON } = require("../env.js");
const { checkWebhook } = require("../helper/addon/webhook/index.js");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const {
  exchangeEmbedToken,
  checkEmbed,
} = require("../helper/addon/embed/index.js");
const { executeSafeJs } = require("../services/sandbox/safeJsRunner.js");
const { returnAddons } = require("../utils/addons.js");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const axios = require("axios");
const logger = require("../utils/logger.js");
const {
  getGoogleAuthConfig,
  verifyGoogleIdToken,
  exchangeGoogleCode,
} = require("../helper/googleAuth.js");
const {
  sendCarouselTemplateMessage,
  sendCatalogTemplateMessage,
} = require("../loops/campaignBeta.js");
const {
  resolveUserPlan,
  getLimit,
  getUsage,
  getAllEntitlements,
} = require("../helper/entitlements.js");

const META_API_VERSION = "v20.0";

function formatPhoneNumber(phone) {
  if (!phone) return phone;
  const cleaned = String(phone).replace(/\D/g, "");
  return cleaned;
}

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/webm;codecs=opus",
  "application/pdf",
  "application/json",
  "text/json",
];

const allowedExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "mp3",
  "ogg",
  "wav",
  "pdf",
  "json",
  "webm",
];

const validateUploadFile = (file) => {
  if (!file) return false;

  const ext = getFileExtension(file.name)?.toLowerCase();

  if (!allowedExtensions.includes(ext)) return false;
  if (!allowedMimeTypes.includes(file.mimetype)) return false;

  return true;
};

// facebook login (disabled for security reasons — SEC-05)
router.post("/login_with_facebook", (req, res) => {
  return res.status(403).json({
    success: false,
    msg: "Facebook login is disabled. Please use Google login or email/password.",
  });
});

// public google auth config
router.get("/google_auth_config", async (req, res) => {
  try {
    const config = await getGoogleAuthConfig();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({
      success: true,
      enabled: Boolean(config.isActive && config.isConfigured),
      client_id: config.isActive ? config.clientId : "",
    });
  } catch (err) {
    logger.error("Error in google_auth_config:", err);
    return res.json({ success: false, enabled: false, client_id: "" });
  }
});

// google login & signup
router.post("/login_with_google", authRateLimiter({ limit: 15, prefix: "google_login" }), async (req, res) => {
  try {
    const { token, idToken, code, redirect_uri, redirectUri } = req.body;

    const rawToken = idToken || token;
    if (!rawToken && !code) {
      return res.status(400).json({
        success: false,
        code: "TOKEN_MISSING",
        msg: "Google credential token or authorization code is required.",
      });
    }

    const config = await getGoogleAuthConfig();
    if (!config.isActive || !config.isConfigured) {
      return res.status(403).json({
        success: false,
        code: "GOOGLE_AUTH_DISABLED",
        msg: "Google authentication is currently disabled by administrator.",
      });
    }

    let verifiedResult;
    if (code) {
      verifiedResult = await exchangeGoogleCode({
        code,
        redirectUri: redirect_uri || redirectUri || "postmessage",
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
    } else {
      verifiedResult = await verifyGoogleIdToken({
        idToken: rawToken,
        clientId: config.clientId,
      });
    }

    if (!verifiedResult.success) {
      return res.status(401).json({
        success: false,
        code: verifiedResult.code || "INVALID_TOKEN",
        msg: verifiedResult.error || "Google identity verification failed.",
      });
    }

    const { email: verifiedEmail, sub: googleSub, name: verifiedName } = verifiedResult.payload;
    const cleanEmail = (verifiedEmail || "").toLowerCase().trim();

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_MISSING",
        msg: "Verified email address not found in Google token.",
      });
    }

    // 1. Strict Administrator Protection:
    // Never allow administrator privileges or admin authentication via public Google sign-in.
    const adminFind = await query(
      "SELECT id, email FROM admin WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [cleanEmail]
    );
    if (adminFind.length > 0) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_NOT_ALLOWED",
        msg: "Administrator accounts cannot authenticate via public Google sign-in.",
      });
    }

    // 2. Lookup existing user in user table
    const userFind = await query(
      "SELECT * FROM user WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [cleanEmail]
    );

    if (userFind.length > 0) {
      const existingUser = userFind[0];

      // Check if user is suspended / blocked
      if (existingUser.is_blocked) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_BLOCKED",
          msg: "This account has been suspended. Please contact support.",
        });
      }

      // Safe identity linking check (Edge Case 13):
      // If account is already linked to a different Google Subject ID, reject to prevent account hijacking
      if (existingUser.google_id && existingUser.google_id !== googleSub) {
        return res.status(409).json({
          success: false,
          code: "ACCOUNT_LINKED_TO_DIFFERENT_GOOGLE",
          msg: "This account is linked to a different Google account.",
        });
      }

      // Link Google ID if not yet linked, and mark email as verified (Google verified it)
      let currentTokenVersion = existingUser.tokenVersion || 0;
      if (!existingUser.email_verified_at) {
        // Pre-hijack mitigation (AUTH-01): account had unverified password registration before real Google owner logged in
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashPass = await bcrypt.hash(randomPassword, 10);
        currentTokenVersion += 1;
        await prisma.user.update({
          where: { uid: existingUser.uid },
          data: {
            google_id: existingUser.google_id || googleSub,
            email_verified_at: new Date(),
            password: hashPass,
            tokenVersion: currentTokenVersion,
          },
        });
      } else if (!existingUser.google_id) {
        await prisma.user.update({
          where: { uid: existingUser.uid },
          data: {
            google_id: googleSub,
          },
        });
      }

      const loginToken = sign(
        {
          uid: existingUser.uid,
          role: "user",
          email: cleanEmail,
          tokenVersion: currentTokenVersion,
          emailVerified: true,
        },
        process.env.JWTKEY,
        {
          expiresIn: "7d",
        }
      );

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json({
        success: true,
        token: loginToken,
        role: "user",
        is_new_user: false,
        msg: "Login successful",
      });
    }

    // 3. Lookup in agents table (if user account does not exist)
    const agentFind = await query(
      "SELECT * FROM agents WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [cleanEmail]
    );

    if (agentFind.length > 0) {
      const existingAgent = agentFind[0];

      if (existingAgent.is_active !== 1) {
        return res.status(403).json({
          success: false,
          code: "AGENT_DEACTIVATED",
          msg: "Your agent account has been deactivated. Please contact your workspace administrator.",
        });
      }

      const loginToken = sign(
        {
          uid: existingAgent.uid,
          role: "agent",
          email: existingAgent.email,
          owner_uid: existingAgent.owner_uid,
          tokenVersion: existingAgent.tokenVersion ?? 0,
          emailVerified: true,
        },
        process.env.JWTKEY,
        {
          expiresIn: "24h",
        }
      );

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json({
        success: true,
        token: loginToken,
        role: "agent",
        is_new_user: false,
        msg: "Agent login successful",
      });
    }

    // 4. New User Registration with Google Identity
    // Prevent duplicate Google ID collision across different email addresses
    const existingGoogleUser = await query(
      "SELECT id, email FROM user WHERE google_id = ? LIMIT 1",
      [googleSub]
    );
    if (existingGoogleUser.length > 0) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_GOOGLE_ID",
        msg: "This Google identity is already associated with another account.",
      });
    }

    const newUid = randomstring.generate(16);
    const randomPassword = randomstring.generate(32);
    const hasPass = await bcrypt.hash(randomPassword, 10);
    const resolvedName = (verifiedName || "").trim() || cleanEmail.split("@")[0];

    await query(
      `INSERT INTO user (name, uid, email, password, tokenVersion, email_verified_at, terms_accepted_at, google_id)
       VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [resolvedName, newUid, cleanEmail, hasPass, googleSub]
    );

    // Assign standard 14-day Free Trial plan (matching POST /signup)
    const getPlan = await query(
      "SELECT * FROM plan WHERE is_trial = 1 OR title LIKE '%Trial%' ORDER BY id ASC LIMIT 1"
    );
    if (getPlan.length > 0) {
      await updateUserPlan(getPlan[0], newUid, 14);
    }

    const loginToken = sign(
      {
        uid: newUid,
        role: "user",
        email: cleanEmail,
        tokenVersion: 0,
        emailVerified: true,
      },
      process.env.JWTKEY,
      {
        expiresIn: "7d",
      }
    );

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({
      success: true,
      token: loginToken,
      role: "user",
      is_new_user: true,
      msg: "Account created and logged in successfully",
    });
  } catch (err) {
    logger.error("Error in login_with_google:", err);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      msg: "Internal server error during Google authentication.",
    });
  }
});

// signup user with Turnstile protection & signup rate limits
router.post("/signup", signupRateLimiter(), async (req, res) => {
  try {
    const { email, name, password, mobile_with_country_code, acceptPolicy, turnstileToken } =
      req.body;

    const clientIp = getClientIp(req);

    // 1. Mandatory Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken({
      token: turnstileToken,
      clientIp,
      action: "signup",
    });

    if (!turnstileCheck.success) {
      return res.status(400).json({
        success: false,
        code: turnstileCheck.code || "SECURITY_VERIFICATION_FAILED",
        msg: turnstileCheck.msg || "Security verification failed. Please try again.",
      });
    }

    if (!email || !password || !mobile_with_country_code) {
      return res.json({ msg: "Please fill the details", success: false });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.json({ msg: "Password must be at least 8 characters", success: false });
    }

    if (!acceptPolicy) {
      return res.json({
        msg: "You did not click on checkbox of Privacy & Terms",
        success: false,
      });
    }

    if (!isValidEmail(email)) {
      return res.json({ msg: "Please enter a valid email", success: false });
    }

    const cleanPhone = (mobile_with_country_code || "").trim();
    if (!/^\+[0-9]{8,16}$/.test(cleanPhone)) {
      return res.json({
        success: false,
        msg: "Please provide a valid phone number with country calling code (e.g. +91XXXXXXXXXX)",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    // check if email already exists across all identity tables (MED-09)
    const [userEx, adminEx, agentEx] = await Promise.all([
      prisma.user.findFirst({ where: { email: cleanEmail } }),
      prisma.admin.findFirst({ where: { email: cleanEmail } }),
      prisma.agents.findFirst({ where: { email: cleanEmail } }),
    ]);
    if (userEx || adminEx || agentEx) {
      return res.json({ msg: "A user already exist with this email", success: false });
    }

    const haspass = await bcrypt.hash(password, 10);
    const uid = randomstring.generate();
    const resolvedName = name && typeof name === "string" && name.trim() ? name.trim() : null;

    await prisma.user.create({
      data: {
        name: resolvedName,
        uid,
        email: cleanEmail,
        password: haspass,
        mobile_with_country_code: cleanPhone,
        email_verified_at: null,
        terms_accepted_at: new Date(),
        tokenVersion: 0,
      },
    });

    // Assign 14-day trial plan via is_trial = 1 only (MED-09)
    const trialPlan = await prisma.plan.findFirst({
      where: { is_trial: 1 },
      orderBy: { id: "asc" },
    });
    if (trialPlan) {
      await updateUserPlan(trialPlan, uid, 14);
    }

    // Generate 6-digit verification OTP
    const otpCode = Math.floor(100000 + crypto.randomInt(900000)).toString();
    const tokenHash = crypto
      .createHash("sha256")
      .update(`${cleanEmail}_${otpCode}`)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.email_verification.create({
      data: {
        uid,
        email: cleanEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Send verification email via SMTP
    try {
      const getWeb = await query(`SELECT * FROM web_public`, []);
      const appName = getWeb[0]?.app_name || "Resend";
      const getHtml = verificationOtpEmail(appName, otpCode);

      const smtp = await query(`SELECT * FROM smtp`, []);
      if (
        smtp[0]?.email &&
        smtp[0]?.host &&
        smtp[0]?.port &&
        smtp[0]?.password &&
        smtp[0]?.username
      ) {
        await sendEmail(
          smtp[0]?.host,
          smtp[0]?.port,
          smtp[0]?.email,
          smtp[0]?.password,
          getHtml,
          `Your Verification Code: ${otpCode} - ${appName}`,
          appName,
          email.toLowerCase().trim(),
          smtp[0]?.username
        );
      } else {
        logger.log(`[SMTP Notice] Verification OTP for ${email}: ${otpCode}`);
      }
    } catch (mailErr) {
      logger.log(`Error sending verification email to ${email}:`, mailErr);
    }

    res.json({
      msg: "Signup Success. Please enter the 6-digit verification code sent to your email.",
      success: true,
      email_verification_required: true,
      email: email.toLowerCase().trim(),
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// verify email code / OTP (SEC-03: rate limited, no token for already-verified, atomic Prisma tx)
router.post("/verify_email", authRateLimiter({ limit: 10, prefix: "verify_email" }), async (req, res) => {
  try {
    const { email, otp, code, token } = req.body;
    const verificationCode = (otp || code || token || "").toString().trim();
    const userEmail = (email || "").toString().toLowerCase().trim();

    if (!userEmail || !verificationCode) {
      return res.status(400).json({
        success: false,
        msg: "Email and verification code are required",
      });
    }

    const user = await prisma.user.findFirst({
      where: { email: userEmail },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        msg: "No account found with this email address",
      });
    }

    // SEC-03: NEVER issue an authentication token for an already-verified user without password!
    if (user.email_verified_at) {
      return res.status(400).json({
        success: false,
        code: "ALREADY_VERIFIED",
        msg: "Email is already verified. Please log in directly.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(`${userEmail}_${verificationCode}`)
      .digest("hex");

    const record = await prisma.email_verification.findFirst({
      where: { email: userEmail, token_hash: tokenHash },
      orderBy: { id: "desc" },
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CODE",
        msg: "Invalid verification code. Please check and try again.",
      });
    }

    if (record.used_at) {
      return res.status(400).json({
        success: false,
        code: "ALREADY_USED",
        msg: "This verification code has already been used.",
      });
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        code: "EXPIRED_CODE",
        msg: "Verification code has expired. Please request a new one.",
      });
    }

    const now = new Date();
    // Atomic check-then-burn inside Prisma transaction
    const [_, updatedUser] = await prisma.$transaction([
      prisma.email_verification.updateMany({
        where: { email: userEmail, used_at: null },
        data: { used_at: now },
      }),
      prisma.user.update({
        where: { uid: user.uid },
        data: { email_verified_at: now },
      }),
    ]);

    const authToken = sign(
      {
        uid: updatedUser.uid,
        role: "user",
        tokenVersion: updatedUser.tokenVersion || 0,
        emailVerified: true,
      },
      process.env.JWTKEY,
      { expiresIn: "7d" }
    );

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({
      success: true,
      token: authToken,
      user: {
        uid: updatedUser.uid,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile_with_country_code: updatedUser.mobile_with_country_code,
        role: "user",
        timezone: updatedUser.timezone,
        email_verified_at: updatedUser.email_verified_at,
      },
      msg: "Email verified successfully.",
    });
  } catch (err) {
    logger.error("verify_email error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong during verification" });
  }
});

// resend verification code
router.post("/resend_verification", async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = (email || "").toString().toLowerCase().trim();

    if (!userEmail || !isValidEmail(userEmail)) {
      return res.status(400).json({ success: false, msg: "Please enter a valid email address" });
    }

    const userFind = await query(`SELECT * FROM user WHERE email = ?`, [userEmail]);
    if (userFind.length === 0) {
      return res.json({
        success: true,
        cooldown: 60,
        msg: "If an account exists with this email, a verification code has been sent.",
      });
    }

    const user = userFind[0];
    if (user.email_verified_at) {
      return res.status(400).json({
        success: false,
        code: "ALREADY_VERIFIED",
        msg: "This email address is already verified.",
      });
    }

    // Rate limit check: 60 seconds
    const recent = await query(
      `SELECT * FROM email_verification WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY id DESC LIMIT 1`,
      [userEmail]
    );

    if (recent.length > 0) {
      const elapsedSec = Math.floor((Date.now() - new Date(recent[0].created_at).getTime()) / 1000);
      const remaining = Math.max(1, 60 - elapsedSec);
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        cooldown: remaining,
        msg: `Please wait ${remaining} seconds before requesting another code.`,
      });
    }

    // Invalidate previous outstanding tokens for this email
    await query(
      `UPDATE email_verification SET expires_at = NOW() WHERE email = ? AND used_at IS NULL AND expires_at > NOW()`,
      [userEmail]
    );

    const otpCode = Math.floor(100000 + crypto.randomInt(900000)).toString();
    const tokenHash = crypto
      .createHash("sha256")
      .update(`${userEmail}_${otpCode}`)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await query(
      `INSERT INTO email_verification (uid, email, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      [user.uid, userEmail, tokenHash, expiresAt]
    );

    try {
      const getWeb = await query(`SELECT * FROM web_public`, []);
      const appName = getWeb[0]?.app_name || "Resend";
      const getHtml = verificationOtpEmail(appName, otpCode);
      const smtp = await query(`SELECT * FROM smtp`, []);
      if (
        smtp[0]?.email &&
        smtp[0]?.host &&
        smtp[0]?.port &&
        smtp[0]?.password &&
        smtp[0]?.username
      ) {
        await sendEmail(
          smtp[0]?.host,
          smtp[0]?.port,
          smtp[0]?.email,
          smtp[0]?.password,
          getHtml,
          `Your Verification Code: ${otpCode} - ${appName}`,
          appName,
          userEmail,
          smtp[0]?.username
        );
      } else {
        logger.log(`[SMTP Notice] Resent Verification OTP for ${userEmail}: ${otpCode}`);
      }
    } catch (mailErr) {
      logger.log(`Error resending verification email to ${userEmail}:`, mailErr);
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({
      success: true,
      cooldown: 60,
      msg: "Verification code sent.",
    });
  } catch (err) {
    logger.error("Resend verification code error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

// login user
router.post("/login", authRateLimiter({ limit: 15, prefix: "login_user" }), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Please provide email and password",
      });
    }

    const cleanEmail = email.toString().toLowerCase().trim();

    // check for user
    const userFind = await query(`SELECT * FROM user WHERE email = ?`, [cleanEmail]);
    if (userFind.length < 1) {
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", msg: "Invalid credentials" });
    }

    const compare = await bcrypt.compare(password, userFind[0].password);

    if (!compare) {
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", msg: "Invalid credentials" });
    } else if (userFind[0].is_blocked) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        msg: "Your account has been suspended by an administrator. Please contact support.",
      });
    } else if (!userFind[0].email_verified_at) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        email_unverified: true,
        email: userFind[0].email,
        msg: "Please verify your email address before logging in.",
      });
    } else {
      const token = sign(
        {
          uid: userFind[0].uid,
          role: "user",
          tokenVersion: userFind[0].tokenVersion || 0,
          emailVerified: true,
        },
        process.env.JWTKEY,
        {
          expiresIn: "7d",
        },
      );
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.json({
        success: true,
        token,
      });
    }
  } catch (err) {
    logger.error("User login error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

// user logout: invalidates session server-side immediately
router.post("/logout", validateUser, async (req, res) => {
  try {
    await query(
      `UPDATE user SET tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE uid = ?`,
      [req.decode.uid]
    );
    res.json({ success: true, msg: "Logged out successfully" });
  } catch (err) {
    logger.error("User logout error:", err);
    res.status(500).json({ success: false, msg: "Server error during logout" });
  }
});

// return image url
router.post("/return_media_url", validateUser, async (req, res) => {
  let randomString;
  let file;

  try {
    ffmpeg.setFfmpegPath(ffmpegStatic);
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.json({ success: false, msg: "No files were uploaded" });
    }

    randomString = randomstring.generate();
    file = req.files.file;

    if (!validateUploadFile(file)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid file type",
      });
    }

    const shouldConvert = req.body.convert === "YES";
    const target = req.body.target; // 'baileys' or other values

    let filename = `${randomString}.${getFileExtension(file.name)}`;
    const tempPath = `${__dirname}/../client/public/media/temp_${filename}`;
    const finalPath = `${__dirname}/../client/public/media/${filename}`;

    // Move file to temp location first
    await new Promise((resolve, reject) => {
      file.mv(tempPath, (err) => {
        if (err) {
          logger.log("File move error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // If conversion is requested and it's an audio file
    if (shouldConvert && file.mimetype.startsWith("audio/")) {
      try {
        // logger.log(
        //   `Converting audio file for ${
        //     target === "baileys" ? "WhatsApp Baileys" : "MP3"
        //   } using fluent-ffmpeg...`
        // );

        if (target === "baileys") {
          // Baileys conversion: OGG format with specific settings
          filename = `${randomString}.ogg`;
          const convertedPath = `${__dirname}/../client/public/media/${filename}`;

          await new Promise((resolve, reject) => {
            ffmpeg(tempPath)
              .noVideo()
              .audioFrequency(48000)
              .audioChannels(1)
              .audioCodec("libopus")
              .audioBitrate(64)
              .outputOptions([
                "-application voip",
                "-avoid_negative_ts make_zero",
                "-map_metadata -1",
              ])
              .format("ogg")
              .on("start", (commandLine) => {
                // logger.log("FFmpeg started with command:", commandLine);
              })
              .on("progress", (progress) => {
                // logger.log("Processing: " + progress.percent + "% done");
              })
              .on("end", () => {
                // logger.log("Audio conversion to OGG completed successfully");
                resolve();
              })
              .on("error", (err) => {
                logger.error("FFmpeg conversion error:", err);
                reject(err);
              })
              .save(convertedPath);
          });
        } else if (target === "meta" || !target) {
          // Default conversion: MP3 format
          filename = `${randomString}.mp3`;
          const convertedPath = `${__dirname}/../client/public/media/${filename}`;

          await new Promise((resolve, reject) => {
            ffmpeg(tempPath)
              .noVideo()
              .audioCodec("libmp3lame")
              .audioBitrate(128)
              .audioChannels(2)
              .audioFrequency(44100)
              .outputOptions(["-write_xing 0", "-id3v2_version", "3"])
              .format("mp3")
              .on("start", (commandLine) => {
                logger.log("FFmpeg started with command:", commandLine);
              })
              .on("progress", (progress) => {
                logger.log("Processing: " + progress.percent + "% done");
              })
              .on("end", () => {
                logger.log("Audio conversion to MP3 completed successfully");
                resolve();
              })
              .on("error", (err) => {
                logger.error("FFmpeg conversion error:", err);
                reject(err);
              })
              .save(convertedPath);
          });
        }

        // Delete temp file after successful conversion
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        // Verify the converted file exists and has content
        const finalConvertedPath = `${__dirname}/../client/public/media/${filename}`;
        if (
          !fs.existsSync(finalConvertedPath) ||
          fs.statSync(finalConvertedPath).size === 0
        ) {
          throw new Error("Conversion produced empty or missing file");
        }
      } catch (conversionError) {
        logger.error("Audio conversion failed:", conversionError);

        // If conversion fails, use original file
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, finalPath);
        }

        // Reset filename to original extension
        filename = `${randomString}.${getFileExtension(file.name)}`;

        logger.log("Using original file due to conversion failure");
      }
    } else {
      // No conversion needed, just move from temp to final location
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, finalPath);
      }
    }

    const url = `${process.env.FRONTENDURI}/media/${filename}`;

    res.json({
      success: true,
      url,
      converted: shouldConvert && file.mimetype.startsWith("audio/"),
      format:
        shouldConvert && file.mimetype.startsWith("audio/")
          ? target === "baileys"
            ? "ogg"
            : "mp3"
          : getFileExtension(file.name),
      target: target || "default",
    });
  } catch (err) {
    logger.error("Media upload error:", err);

    // Clean up temp file if it exists
    if (randomString && file) {
      const tempPath = `${__dirname}/../client/public/media/temp_${randomString}.${getFileExtension(
        file.name,
      )}`;
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          logger.error("Error cleaning up temp file:", cleanupError);
        }
      }
    }

    logger.error("Return media URL error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

router.post("/convert_audio", validateUser, async (req, res) => {
  try {
    ffmpeg.setFfmpegPath(ffmpegStatic);

    const { msgId, audioUrl } = req.body;

    if (!audioUrl) {
      return res.json({ success: false, msg: "Audio URL is required" });
    }

    // Extract filename from URL (works with any domain)
    const urlObj = new URL(audioUrl);
    const pathname = urlObj.pathname;
    const originalFilename = pathname.split("/").pop(); // Gets last part of path
    const filenameWithoutExt =
      originalFilename.substring(0, originalFilename.lastIndexOf(".")) ||
      originalFilename;
    const currentExt = originalFilename.substring(
      originalFilename.lastIndexOf(".") + 1,
    );

    // Check if already MP3
    if (currentExt.toLowerCase() === "mp3") {
      return res.json({
        success: true,
        newUrl: audioUrl,
        msg: "Already in MP3 format",
      });
    }

    // Extract the directory from pathname (e.g., /meta-media/)
    const pathParts = pathname.split("/");
    pathParts.pop(); // Remove filename
    const directory = pathParts.join("/").replace(/^\//, ""); // Remove leading slash

    // Define paths
    const oldFilePath = `${__dirname}/../client/public/${directory}/${originalFilename}`;
    const newFilename = `${filenameWithoutExt}.mp3`;
    const newFilePath = `${__dirname}/../client/public/${directory}/${newFilename}`;

    // Check if original file exists
    if (!fs.existsSync(oldFilePath)) {
      return res.json({
        success: false,
        msg: "Original audio file not found on server",
      });
    }

    // Convert audio to MP3 using fluent-ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(oldFilePath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .audioFrequency(44100)
        .outputOptions(["-write_xing 0", "-id3v2_version", "3"])
        .format("mp3")
        .on("start", (commandLine) => {
          logger.log("FFmpeg conversion started:", commandLine);
        })
        .on("progress", (progress) => {
          logger.log("Processing: " + (progress.percent || 0) + "% done");
        })
        .on("end", () => {
          logger.log("Audio conversion to MP3 completed successfully");
          resolve();
        })
        .on("error", (err) => {
          logger.error("FFmpeg conversion error:", err);
          reject(err);
        })
        .save(newFilePath);
    });

    // Verify the converted file exists and has content
    if (!fs.existsSync(newFilePath) || fs.statSync(newFilePath).size === 0) {
      return res.json({
        success: false,
        msg: "Conversion produced empty or missing file",
      });
    }

    // Update database with new URL
    const [getMsg] = await query(
      `SELECT * FROM beta_conversation WHERE id = ?`,
      [msgId],
    );

    if (getMsg) {
      const msgCon = getMsg?.msgContext ? JSON.parse(getMsg.msgContext) : {};
      const newUrl = `${urlObj.origin}/${directory}/${newFilename}`;

      const updatedMsgCon = {
        ...msgCon,
        type: "audio",
        audio: {
          ...msgCon.audio,
          link: newUrl,
        },
      };

      await query(`UPDATE beta_conversation SET msgContext = ? WHERE id = ?`, [
        JSON.stringify(updatedMsgCon),
        msgId,
      ]);

      logger.log("Database updated with new MP3 URL");
    }

    // Delete old file (non-MP3)
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
      logger.log("Old audio file deleted:", originalFilename);
    }

    // Construct new URL
    const newUrl = `${urlObj.origin}/${directory}/${newFilename}`;

    res.json({
      success: true,
      newUrl,
      oldFile: originalFilename,
      newFile: newFilename,
      msg: "Audio converted to MP3 successfully",
    });
  } catch (err) {
    logger.error("Audio conversion error:", err);
    res.json({
      success: false,
      msg: "Something went wrong during conversion",
      err: err.message,
    });
  }
});

// get user
router.get("/get_me", validateUser, async (req, res) => {
  try {
    const { userOnly } = req.query;
    const user = await prisma.user.findFirst({
      where: { uid: req.decode.uid },
    });

    const finalAddon = returnAddons();

    let contactCount = 0;

    if (!userOnly) {
      // getting phonebook
      contactCount = await prisma.contact.count({
        where: { uid: req.decode.uid },
      });
    }

    // Never send credentials to the browser
    const { password: _pw, api_key: _apiKey, tokenVersion: _tv, ...safeUser } = user || {};

    res.json({
      data: sanitizeBigInt({ ...safeUser, contact: contactCount }),
      success: true,
      addon: finalAddon,
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// update notes
router.post(
  "/save_note",
  validateUser,
  checkPlan,
  checkNote,
  async (req, res) => {
    try {
      const { chatId, note } = req.body;

      await query(
        `UPDATE chats SET chat_note = ? WHERE chat_id = ? AND uid = ?`,
        [note, chatId, req.decode.uid],
      );
      res.json({ success: true, msg: "Notes were updated" });
    } catch (err) {
      logger.error("User route error:", err);
      res.status(500).json({ success: false, msg: "something went wrong" });
    }
  },
);

// update tags
router.post(
  "/push_tag",
  validateUser,
  checkPlan,
  checkTags,
  async (req, res) => {
    try {
      const { tag, chatId } = req.body;

      if (!tag) {
        return res.json({ success: false, msg: "Please type a tag" });
      }

      const getChat = await query(
        `SELECT * FROM chats WHERE chat_id = ? AND uid = ?`,
        [chatId, req.decode.uid],
      );

      if (getChat.length < 1) {
        return res.json({ success: false, msg: "Chat not found" });
      }
      const getTags = getChat[0]?.chat_tags
        ? JSON.parse(getChat[0]?.chat_tags)
        : [];
      const addNew = [...getTags, tag];

      await query(
        `UPDATE chats SET chat_tags = ? WHERE chat_id = ? AND uid = ?`,
        [JSON.stringify(addNew), chatId, req.decode.uid],
      );

      res.json({ success: true, msg: "Tag was added" });
    } catch (err) {
      logger.error("User route error:", err);
      res.status(500).json({ success: false, msg: "something went wrong" });
    }
  },
);

// del a tag
router.post("/del_tag", validateUser, async (req, res) => {
  try {
    const { tag, chatId } = req.body;

    const getAll = await query(
      `SELECT * FROM chats WHERE chat_id = ? AND uid = ?`,
      [chatId, req.decode.uid],
    );
    if (getAll.length < 1) {
      return res.json({ success: false, msg: "Chat not found" });
    }

    const getAllTags = getAll[0]?.chat_tags
      ? JSON.parse(getAll[0]?.chat_tags)
      : [];

    const newOne = getAllTags?.filter((i) => i !== tag);

    logger.log({ newOne });

    await query(
      `UPDATE chats SET chat_tags = ? WHERE chat_id = ? AND uid = ?`,
      [JSON.stringify(newOne), chatId, req.decode.uid],
    );

    res.json({ success: true, msg: "Tag was deleted" });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// check contact exist
router.post("/check_contact", validateUser, async (req, res) => {
  try {
    const { mobile } = req.body;

    const findFirst = await query(
      `SELECT * FROM contact WHERE mobile = ? AND uid = ? `,
      [mobile, req.decode.uid],
    );
    const getAllPhonebook = await query(
      `SELECT * FROM phonebook WHERE uid = ?`,
      [req.decode.uid],
    );

    if (findFirst.length < 1) {
      return res.json({
        success: false,
        msg: "Contact not found in phonebook",
        phonebook: getAllPhonebook,
      });
    }

    res.json({
      success: true,
      phonebook: getAllPhonebook,
      contact: findFirst[0],
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// save the contact
router.post(
  "/save_contact",
  validateUser,
  checkPlan,
  checkContactLimit,
  async (req, res) => {
    try {
      const {
        phoneBookName,
        phoneBookId,
        phoneNumber,
        contactName,
        var1,
        var2,
        var3,
        var4,
        var5,
      } = req.body;

      if (!phoneBookName || !phoneBookId || !phoneNumber || !contactName) {
        return res.json({ success: false, msg: "incomplete input provided" });
      }

      const findExist = await query(
        `SELECT * FROM contact WHERE mobile = ? AND uid = ?`,
        [phoneNumber, req.decode.uid],
      );
      if (findExist.length > 0) {
        return res.json({ success: false, msg: "Contact already existed" });
      }

      await query(
        `INSERT INTO contact (uid, phonebook_id, phonebook_name, name, mobile, var1, var2, var3, var4, var5) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          req.decode.uid,
          phoneBookId,
          phoneBookName,
          contactName,
          phoneNumber,
          var1 || "",
          var2 || "",
          var3 || "",
          var4 || "",
          var5 || "",
        ],
      );

      res.json({ success: true, msg: "Contact was added" });
    } catch (err) {
      logger.error("User route error:", err);
      res.status(500).json({ success: false, msg: "something went wrong" });
    }
  },
);

// del contact
router.post("/del_contact", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM contact WHERE id = ? AND uid = ?`, [
      id,
      req.decode.uid,
    ]);
    res.json({ success: true, msg: "Contact was deleted" });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

router.post("/update_meta", validateUser, async (req, res) => {
  try {
    const { waba_id, access_token, business_phone_number_id, app_id } =
      req.body;

    if (!waba_id || !access_token || !app_id || !business_phone_number_id) {
      return res.json({ success: false, msg: "Please fill all the fields" });
    }

    const resp = await getBusinessPhoneNumber(
      "v20.0",
      business_phone_number_id,
      access_token,
    );

    if (resp?.error) {
      return res.json({
        success: false,
        msg:
          resp?.error?.message ||
          "Please check your details — Phone Number ID or Token may be incorrect",
      });
    }

    const findOne = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);

    if (findOne.length > 0) {
      await query(
        `UPDATE meta_api 
         SET waba_id = ?, 
             access_token = ?, 
             business_phone_number_id = ?, 
             app_id = ?, 
             login_type = ?,
             embed_data = NULL,
             is_coexistence = 0,
             platform_type = NULL
         WHERE uid = ?`,
        [
          waba_id,
          access_token,
          business_phone_number_id,
          app_id,
          "manual",
          req.decode.uid,
        ],
      );
    } else {
      await query(
        `INSERT INTO meta_api (uid, waba_id, access_token, business_phone_number_id, app_id, login_type) VALUES (?,?,?,?,?,?)`,
        [
          req.decode.uid,
          waba_id,
          access_token,
          business_phone_number_id,
          app_id,
          "manual",
        ],
      );
    }

    res.json({
      success: true,
      msg: "Your meta settings were updated successfully!",
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// update embed meta
router.post("/update_embed_meta", validateUser, async (req, res) => {
  try {
    const { embed_meta } = req.body;
    if (!embed_meta?.waba?.id) {
      return res.json({ success: false, msg: "Please click Login first" });
    }

    const findOne = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (findOne.length > 0) {
      await query(
        `UPDATE meta_api SET embed_data = ?, login_type = ? WHERE uid = ?`,
        [JSON.stringify(embed_meta), "embed", req.decode.uid],
      );
    } else {
      await query(
        `INSERT INTO meta_api (uid, embed_data, login_type) VALUES (?,?,?)`,
        [req.decode.uid, JSON.stringify(embed_meta), "embed"],
      );
    }

    res.json({
      success: true,
      msg: "Your meta settings were updated successfully!",
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get meta keys
router.get("/get_meta_keys", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (data.length < 1) {
      res.json({ success: true, data: {} });
    } else {
      res.json({ success: true, data: data[0] });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// add meta templet
router.post("/add_meta_templet", validateUser, checkPlan, async (req, res) => {
  try {
    const getAPIKEYS = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);

    if (getAPIKEYS.length < 1) {
      return res.json({
        success: false,
        msg: "Please fill your meta API keys",
      });
    }

    const resp = await createMetaTemplet(
      "v20.0",
      getAPIKEYS[0]?.waba_id,
      getAPIKEYS[0]?.access_token,
      req.body,
    );

    if (resp.error) {
      res.json({ msg: resp?.error?.error_user_msg || resp?.error?.message });
    } else {
      logger.log(resp);
      res.json({
        msg: "Templet was added and waiting for the review",
        success: true,
      });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get user meta templet
router.get("/get_my_meta_templets", validateUser, async (req, res) => {
  try {
    const getMETA = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (getMETA.length < 1) {
      return res.json({
        success: false,
        msg: "Please check your meta API keys",
      });
    }

    const resp = await getAllTempletsMeta(
      "v20.0",
      getMETA[0]?.waba_id,
      getMETA[0]?.access_token,
    );

    if (resp?.error) {
      res.json({
        success: false,
        msg: resp?.error?.message || "Please check your API",
      });
    } else {
      res.json({ success: true, data: resp?.data || [] });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// del meta templet
router.post("/del_meta_templet", validateUser, async (req, res) => {
  try {
    const { name } = req.body;

    const getMETA = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (getMETA.length < 1) {
      return res.json({
        success: false,
        msg: "Please check your meta API keys",
      });
    }

    const resp = await delMetaTemplet(
      "v20.0",
      getMETA[0]?.waba_id,
      getMETA[0]?.access_token,
      name,
    );

    if (resp.error) {
      return res.json({
        success: false,
        msg: resp?.error?.error_user_title || "Please check your API",
      });
    } else {
      res.json({
        success: true,
        data: resp?.data || [],
        msg: "Templet was deleted",
      });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// return meta media url
router.post("/return_media_url_meta", validateUser, async (req, res) => {
  try {
    if (!req.body?.templet_name) {
      return res.json({
        success: false,
        msg: "Please give a templet name first ",
      });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.json({ success: false, msg: "No files were uploaded" });
    }

    const getMETA = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (getMETA.length < 1) {
      return res.json({
        success: false,
        msg: "Please check your meta API keys",
      });
    }

    const randomString = randomstring.generate();
    const file = req.files.file;

    if (!validateUploadFile(file)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid file type",
      });
    }

    const filename = `${randomString}.${getFileExtension(file.name)}`;

    // Move the file and wait for it to complete
    await new Promise((resolve, reject) => {
      file.mv(`${__dirname}/../client/public/media/${filename}`, (err) => {
        if (err) {
          logger.log(err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    setTimeout(async () => {
      const { fileSizeInBytes, mimeType } = await getFileInfo(
        `${__dirname}/../client/public/media/${filename}`,
      );

      const getSession = await getSessionUploadMediaMeta(
        "v20.0",
        getMETA[0]?.app_id,
        getMETA[0]?.access_token,
        fileSizeInBytes,
        mimeType,
      );

      const uploadFile = await uploadFileMeta(
        getSession?.id,
        `${__dirname}/../client/public/media/${filename}`,
        "v20.0",
        getMETA[0]?.access_token,
      );

      if (!uploadFile?.success) {
        return res.json({ success: false, msg: "Please check your meta API" });
      }

      const url = `${process.env.FRONTENDURI}/media/${filename}`;

      await query(
        `INSERT INTO meta_templet_media (uid, templet_name, meta_hash, file_name) VALUES (?,?,?,?)`,
        [req.decode.uid, req.body?.templet_name, uploadFile?.data?.h, filename],
      );

      res.json({ success: true, url, hash: uploadFile?.data?.h });
    }, 1000);
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get plan detail
router.post("/get_plan_details", validateUser, async (req, res) => {
  try {
    const { id } = req.body;

    const data = await query(`SELECT * FROM plan WHERE id = ?`, [id]);
    if (data.length < 1) {
      return res.json({ success: false, data: null });
    } else {
      res.json({ success: true, data: data[0] });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get payment gateway (SEC-02: return public keys and flags only, never secrets)
router.get("/get_payment_details", validateUser, async (req, res) => {
  try {
    const web = await prisma.web_private.findFirst({
      select: {
        pay_offline_id: true,
        offline_active: true,
        pay_stripe_id: true,
        stripe_active: true,
        pay_paypal_id: true,
        paypal_active: true,
        rz_id: true,
        rz_active: true,
        pay_paystack_id: true,
        paystack_active: true,
        pay_mercadopago_public_key: true,
        mercadopago_active: true,
      },
    });
    const userData = await prisma.user.findFirst({
      where: { uid: req.decode.uid },
      select: {
        id: true,
        uid: true,
        name: true,
        email: true,
        mobile: true,
        mobile_with_country_code: true,
        timezone: true,
        role: true,
        email_verified_at: true,
      },
    });

    res.json({ data: web || {}, userData: userData || {}, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "something went wrong" });
  }
});

// SEC-07: Legacy payment gateways retired in favor of /api/billing
const retiredPaymentHandler = (req, res) => {
  return res.status(410).json({
    success: false,
    msg: "This legacy payment gateway endpoint has been retired. Please use /api/billing checkout.",
  });
};

router.post("/create_stripe_session", validateUser, retiredPaymentHandler);
router.post("/pay_with_rz", validateUser, retiredPaymentHandler);
router.post("/pay_with_paypal", validateUser, retiredPaymentHandler);
router.get("/stripe_payment", retiredPaymentHandler);
router.post("/pay_with_paystack", validateUser, retiredPaymentHandler);

// update profile (AUTH-02: requires currentPassword for password changes, validates email uniqueness)
router.post("/update_profile", validateUser, async (req, res) => {
  try {
    let mobile_with_country_code;
    const {
      newPassword,
      currentPassword,
      name,
      mobile: mobileFromBody,
      mobile_with_country_code: mobile_with_country_codeNew,
      email,
      timezone,
    } = req.body;

    if (mobileFromBody) {
      mobile_with_country_code = mobileFromBody;
    }

    if (mobile_with_country_codeNew) {
      mobile_with_country_code = mobile_with_country_codeNew;
    }

    if (!name || !mobile_with_country_code || !email || !timezone) {
      return res.status(400).json({
        success: false,
        msg: "Name, Mobile, Email, Timezone are required fields",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, msg: "Please enter a valid email" });
    }

    const currentUser = await prisma.user.findFirst({
      where: { uid: req.decode.uid },
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, msg: "User account not found" });
    }

    let emailVerifiedAt = currentUser.email_verified_at;
    // Email uniqueness check across user, admin, and agents (AUTH-02)
    if (cleanEmail !== (currentUser.email || "").toLowerCase().trim()) {
      const [userConflict, adminConflict, agentConflict] = await Promise.all([
        prisma.user.findFirst({
          where: { email: cleanEmail, NOT: { uid: req.decode.uid } },
        }),
        prisma.admin.findFirst({ where: { email: cleanEmail } }),
        prisma.agents.findFirst({ where: { email: cleanEmail } }),
      ]);
      if (userConflict || adminConflict || agentConflict) {
        return res.status(400).json({
          success: false,
          msg: "Email is already in use by another account",
        });
      }
      emailVerifiedAt = null;
    }

    let newHashedPassword = currentUser.password;
    let nextTokenVersion = currentUser.tokenVersion || 0;

    // Password change verification (AUTH-02)
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          msg: "Current password is required to set a new password",
        });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          msg: "New password must be at least 8 characters long",
        });
      }
      const isMatch = await bcrypt.compare(currentPassword, currentUser.password || "");
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          msg: "Current password does not match",
        });
      }
      newHashedPassword = await bcrypt.hash(newPassword, 10);
      nextTokenVersion += 1;
    }

    await prisma.user.update({
      where: { uid: req.decode.uid },
      data: {
        name,
        email: cleanEmail,
        password: newHashedPassword,
        mobile_with_country_code,
        timezone,
        tokenVersion: nextTokenVersion,
        email_verified_at: emailVerifiedAt,
      },
    });

    res.json({ success: true, msg: "Profile was updated" });
  } catch (err) {
    logger.log(err);
    res.status(500).json({ msg: "Something went wrong", success: false });
  }
});

// get dashboard
router.get("/get_dashboard_old", validateUser, async (req, res) => {
  try {
    const getOpenChat = await query(
      `SELECT * FROM chats WHERE uid = ? AND chat_status = ?`,
      [req.decode.uid, "open"],
    );
    const getOpenPending = await query(
      `SELECT * FROM chats WHERE uid = ? AND chat_status = ?`,
      [req.decode.uid, "pending"],
    );
    const getOpenResolved = await query(
      `SELECT * FROM chats WHERE uid = ? AND chat_status = ?`,
      [req.decode.uid, "solved"],
    );

    const getActiveChatbots = await query(
      `SELECT * FROM chatbot WHERE active = ? AND uid = ?`,
      [1, req.decode.uid],
    );
    const getDActiveChatbots = await query(
      `SELECT * FROM chatbot WHERE active = ? AND uid = ?`,
      [0, req.decode.uid],
    );

    const opened = getUserOrderssByMonth(getOpenChat);
    const pending = getUserOrderssByMonth(getOpenPending);
    const resolved = getUserOrderssByMonth(getOpenResolved);
    const activeBot = getUserOrderssByMonth(getActiveChatbots);
    const dActiveBot = getUserOrderssByMonth(getDActiveChatbots);

    // get total chats
    const totalChats = await query(`SELECT * FROM chats WHERE uid = ?`, [
      req.decode.uid,
    ]);
    const totalChatbots = await query(`SELECT * FROM chatbot WHERE uid = ?`, [
      req.decode.uid,
    ]);
    const totalContacts = await query(`SELECT * FROM contact WHERE uid = ?`, [
      req.decode.uid,
    ]);
    const totalFlows = await query(`SELECT * FROM flow WHERE uid = ?`, [
      req.decode.uid,
    ]);
    const totalBroadcast = await query(
      `SELECT * FROM broadcast WHERE uid = ?`,
      [req.decode.uid],
    );
    const totalTemplets = await query(`SELECT * FROM templets WHERE uid = ?`, [
      req.decode.uid,
    ]);

    res.json({
      success: true,
      opened,
      pending,
      resolved,
      activeBot,
      dActiveBot,
      totalChats: totalChats.length,
      totalChatbots: totalChatbots?.length,
      totalContacts: totalContacts?.length,
      totalFlows: totalFlows?.length,
      totalBroadcast: totalBroadcast?.length,
      totalTemplets: totalTemplets?.length,
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "Something went wrong", success: false });
  }
});

router.get("/get_dashboard", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;

    // 1. User Profile Data
    const user = await query("SELECT * FROM user WHERE uid = ?", [uid]);

    // 2. Statistics
    const [agents, activeChats, completedTasks, activeInstances] =
      await Promise.all([
        query("SELECT COUNT(*) as count FROM agents WHERE owner_uid = ?", [
          uid,
        ]),
        query(
          "SELECT COUNT(*) as count FROM beta_chats WHERE uid = ? AND unread_count > 0",
          [uid],
        ),
        query(
          "SELECT COUNT(*) as count FROM agent_task WHERE owner_uid = ? AND status = 'COMPLETED'",
          [uid],
        ),
        query(
          "SELECT COUNT(*) as count FROM instance WHERE uid = ? AND status = 'ACTIVE'",
          [uid],
        ),
      ]);

    // 3. Recent Conversations (from beta_conversation)
    const recentConversations = [];

    // 4. Unread Messages Summary
    const unreadSummary = [];

    // 5. Active Chatbots
    const activeChatbots = await query(
      `
      SELECT title, flow_id 
      FROM beta_chatbot 
      WHERE uid = ? AND active = 1
      LIMIT 3
    `,
      [uid],
    );

    // 6. Performance Metrics (last 7 days)
    const performanceData = await query(
      `
      SELECT 
        DATE(createdAt) as date,
        COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incoming,
        COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoing
      FROM beta_conversation
      WHERE uid = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `,
      [uid],
    );

    const data = {
      user: user[0],
      stats: {
        agents: agents[0].count,
        activeChats: activeChats[0].count,
        completedTasks: completedTasks[0].count,
        activeInstances: activeInstances[0].count,
      },
      recentConversations,
      unreadSummary,
      activeChatbots,
      performanceData,
      lastUpdated: new Date().toISOString(),
    };

    res.json({ success: true, data });
  } catch (err) {
    logger.error("Dashboard error:", err);
    res
      .status(500)
      .json({ success: false, msg: "Failed to load dashboard data" });
  }
});

// enroll free plan (ONB-02: deprecated in favor of /api/billing/activate_trial)
router.post("/start_free_trial", validateUser, async (req, res) => {
  return res.status(410).json({
    success: false,
    msg: "Deprecated endpoint. Please use /api/billing/activate_trial",
  });
});

// send recover (SEC-04: Prisma conversion & purpose verification)
router.post("/send_resovery", authRateLimiter({ limit: 5, prefix: "recovery_user" }), async (req, res) => {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, msg: "Please enter a valid email" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const checkEmailValid = await prisma.user.findFirst({
      where: { email: cleanEmail },
    });
    if (!checkEmailValid) {
      return res.json({
        success: true,
        msg: "We have sent a recovery link if this email is associated with user account.",
      });
    }

    const webPub = await prisma.web_public.findFirst();
    const appName = webPub?.app_name || "Resend";

    // Secure token: does NOT contain user password hash; includes purpose and tokenVersion for single-use (SEC-04)
    const jsontoken = sign(
      {
        uid: checkEmailValid.uid,
        email: checkEmailValid.email,
        purpose: "password_reset",
        tokenVersion: checkEmailValid.tokenVersion || 0,
      },
      process.env.JWTKEY,
      { expiresIn: "1h" },
    );

    const recpveryUrl = `${process.env.FRONTENDURI || "http://localhost:3000"}/recovery-user/${jsontoken}`;
    const getHtml = recoverEmail(appName, recpveryUrl);

    // getting smtp via Prisma
    const smtp = await prisma.smtp.findFirst();
    if (
      !smtp?.email ||
      !smtp?.host ||
      !smtp?.port ||
      !smtp?.password ||
      !smtp?.username
    ) {
      return res.json({
        success: false,
        msg: "SMTP connections not found! Unable to send recovery link",
      });
    }

    await sendEmail(
      smtp.host,
      smtp.port,
      smtp.email,
      smtp.password,
      getHtml,
      `${appName} - Password Recovery`,
      smtp.email,
      cleanEmail,
      smtp.username,
    );

    res.json({
      success: true,
      msg: "We have sent your a password recovery link. Please check your email",
    });
  } catch (err) {
    logger.error("send_resovery error:", err);
    res.status(500).json({ msg: "Something went wrong", success: false });
  }
});

// modify recovery password handler (SEC-04: POST only, purpose check, tokenVersion required, min 8 chars)
const handleModifyPassword = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, msg: "Method not allowed. Use POST." });
    }

    const pass = req.body?.password || req.body?.pass;
    const authHeader = req.get("Authorization");
    const token =
      req.body?.token ||
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);

    if (!pass || typeof pass !== "string" || pass.length < 8) {
      return res.status(400).json({ success: false, msg: "Password must be at least 8 characters long" });
    }

    if (!token) {
      return res.status(400).json({ success: false, msg: "Reset token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWTKEY);
    } catch (e) {
      return res.status(400).json({ success: false, msg: "Reset token has expired or is invalid." });
    }

    // SEC-04: Require purpose === 'password_reset'
    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({
        success: false,
        msg: "Invalid reset token purpose",
      });
    }

    // SEC-04: Require defined tokenVersion
    if (typeof decoded.tokenVersion === "undefined") {
      return res.status(400).json({
        success: false,
        msg: "Malformed reset token: missing version",
      });
    }

    const uid = decoded.uid;
    const email = decoded.email;

    const user = uid
      ? await prisma.user.findFirst({ where: { uid } })
      : email
      ? await prisma.user.findFirst({ where: { email } })
      : null;

    if (!user) {
      return res.status(404).json({ success: false, msg: "User account not found" });
    }

    // Single-use token verification:
    if (Number(user.tokenVersion || 0) !== Number(decoded.tokenVersion)) {
      return res.status(400).json({
        success: false,
        msg: "This reset link has already been used or has expired. Please request a new one.",
      });
    }

    const hashpassword = await bcrypt.hash(pass, 10);
    const nextVersion = (user.tokenVersion || 0) + 1;

    await prisma.user.update({
      where: { uid: user.uid },
      data: {
        password: hashpassword,
        tokenVersion: nextVersion,
        email_verified_at: user.email_verified_at || new Date(),
      },
    });

    res.json({
      success: true,
      msg: "Your password has been changed. You may login now! Redirecting...",
    });
  } catch (err) {
    logger.error("modify_password error:", err);
    res.status(500).json({ msg: "Something went wrong", success: false });
  }
};

// POST only route for password reset (SEC-04)
router.post("/modify_password", authRateLimiter({ limit: 10, prefix: "reset_user" }), handleModifyPassword);

// generate api keys (SEC-04: purpose 'api_key' prevents token misuse as password reset)
router.get("/generate_api_keys", validateUser, async (req, res) => {
  try {
    const token = sign(
      { uid: req.decode.uid, role: "user", purpose: "api_key" },
      process.env.JWTKEY,
      {},
    );

    // saving keys to user via Prisma
    await prisma.user.update({
      where: { uid: req.decode.uid },
      data: { api_key: token },
    });

    res.json({ success: true, token, msg: "New keys has been generated" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// Dodo Payments webhook reconciliation endpoint (PAY-04)
router.post("/dodo_payment_success", async (req, res) => {
  try {
    const internalSecret = req.headers["x-internal-secret"];
    const expectedKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    if (expectedKey && internalSecret !== expectedKey) {
      return res.status(401).json({ success: false, msg: "Unauthorized webhook relay" });
    }

    const { webhookId, eventType, paymentId, subscriptionId, customerEmail, metadata, amount, currency } = req.body;

    if (!webhookId) {
      return res.status(400).json({ success: false, msg: "webhookId is required" });
    }

    // Atomic DB-backed idempotency check
    const existing = await prisma.processed_webhook_events.findUnique({
      where: { event_id: webhookId },
    });
    if (existing) {
      return res.json({ success: true, duplicate: true, msg: "Event already processed" });
    }

    // Insert idempotency record
    await prisma.processed_webhook_events.create({
      data: {
        event_id: webhookId,
        provider: "dodo",
      },
    });

    // Resolve user
    let uid = metadata?.uid;
    if (!uid && customerEmail) {
      const user = await prisma.user.findFirst({
        where: { email: customerEmail.toLowerCase().trim() },
        select: { uid: true },
      });
      uid = user?.uid;
    }

    if (!uid) {
      logger.warn(`[Dodo Webhook] No matching user found for event ${webhookId}`);
      return res.json({ success: true, warning: "User not found" });
    }

    // Resolve plan
    const planId = parseInt(metadata?.planId, 10);
    const plan = planId
      ? await prisma.plan.findFirst({ where: { id: planId } })
      : await prisma.plan.findFirst({ where: { price: { gt: 0 } }, orderBy: { id: "asc" } });

    if (plan) {
      await updateUserPlan(plan, uid);
      await prisma.orders.create({
        data: {
          uid,
          payment_mode: "DODO",
          amount: String(amount || plan.price || 0),
          data: JSON.stringify({ paymentId, subscriptionId, eventType, metadata, currency }),
          status: "paid",
          s_token: paymentId || subscriptionId || webhookId,
        },
      });
    }

    return res.json({ success: true, msg: "Payment processed and plan updated" });
  } catch (err) {
    logger.error("[Dodo Webhook Relay] Error:", err);
    return res.status(500).json({ success: false, msg: "Failed to process payment event" });
  }
});

router.get("/fetch_profile", validateUser, async (req, res) => {
  try {
    // const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])

    const metaKeys = await query("SELECT * FROM meta_api WHERE uid = ?", [
      req.decode?.uid,
    ]);

    if (!metaKeys[0]?.access_token || !metaKeys[0]?.business_phone_number_id) {
      return res.json({
        success: false,
        msg: "Please fill the meta token and mobile id",
      });
    }
    const fetchProfile = await fetchProfileFun(
      metaKeys[0]?.business_phone_number_id,
      metaKeys[0]?.access_token,
    );

    res.json(fetchProfile);
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// adding task for agent
router.post("/add_task_for_agent", validateUser, async (req, res) => {
  try {
    const { title, des, agent_uid } = req.body;
    if (!title || !des) {
      return res.json({ msg: "Please give title and description" });
    }

    if (!agent_uid) {
      return res.json({ msg: "Please select an agent" });
    }

    await query(
      `INSERT INTO agent_task (owner_uid, uid, title, description, status) VALUES (?,?,?,?,?)`,
      [req.decode.uid, agent_uid, title, des, "PENDING"],
    );

    res.json({ success: true, msg: "Task was added" });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// get my agent tasks
router.get("/get_my_agent_tasks", validateUser, async (req, res) => {
  try {
    const data = await query(
      `
            SELECT agent_task.*, agents.email AS agent_email
            FROM agent_task
            JOIN agents ON agents.uid = agent_task.uid
            WHERE agent_task.owner_uid = ?
        `,
      [req.decode.uid],
    );

    res.json({ data, success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// delete task for agent
router.post("/del_task_for_agent", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM agent_task WHERE id = ? AND owner_uid = ?`, [
      id,
      req.decode.uid,
    ]);

    res.json({ msg: "Task was deleted", success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// add widget
router.post("/add_widget", validateUser, async (req, res) => {
  try {
    const { title, whatsapp_number, place, selectedIcon, logoType, size } =
      req.body;

    if (!title || !whatsapp_number || !place) {
      return res.json({ msg: "Please fill the details" });
    }

    let filename;

    if (logoType === "UPLOAD") {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.json({ success: false, msg: "Please upload a logo" });
      }

      const randomString = randomstring.generate();
      const file = req.files.file;

      if (!validateUploadFile(file)) {
        return res.status(400).json({
          success: false,
          msg: "Invalid file type",
        });
      }

      if (file.size > 20 * 1024 * 1024) {
        return res.json({
          success: false,
          msg: "File too large",
        });
      }

      filename = `${randomString}.${getFileExtension(file.name)}`;

      file.mv(`${__dirname}/../client/public/media/${filename}`, (err) => {
        if (err) {
          logger.error("File upload error:", err);
          return res.status(500).json({ success: false, msg: "Failed to upload file" });
        }
      });
    } else {
      filename = selectedIcon;
    }

    const unique_id = randomstring.generate(10);

    await query(
      `INSERT INTO chat_widget (unique_id, uid, title, whatsapp_number, logo, place, size) VALUES (?,?,?,?,?,?,?)`,
      [
        unique_id,
        req.decode.uid,
        title,
        whatsapp_number,
        filename,
        place,
        size || 50,
      ],
    );

    res.json({
      msg: "Widget was added",
      success: true,
    });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// get my widget
router.get("/get_my_widget", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM chat_widget WHERE uid = ?`, [
      req.decode.uid,
    ]);

    res.json({ data, success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// del widget
router.post("/del_widget", validateUser, async (req, res) => {
  try {
    const { id } = req.body;

    await query(`DELETE FROM chat_widget WHERE id = ? AND uid = ?`, [
      id,
      req.decode.uid,
    ]);

    res.json({ msg: "Widget was deleted", success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

router.get("/widget", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.send(``);
    }

    const getWidget = await query(
      `SELECT * FROM chat_widget WHERE unique_id = ?`,
      [id],
    );

    if (getWidget.length < 1) {
      return res.send(``);
    }

    const url = generateWhatsAppURL(
      getWidget[0]?.whatsapp_number,
      getWidget[0]?.title,
    );

    res.send(
      returnWidget(
        `${process.env.FRONTENDURI}/media/${getWidget[0]?.logo}`,
        getWidget[0]?.size,
        url,
        getWidget[0]?.place,
      ),
    );
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// update agent profile
router.post("/update_agent_profile", validateUser, async (req, res) => {
  try {
    const { email, name, mobile, newPas, uid } = req.body;

    if (!uid || !email || !name || !mobile) {
      return res.json({
        success: false,
        msg: "You cannot remove any detail of agent",
      });
    }

    const [agent] = await query(
      `SELECT * FROM agents WHERE uid = ? AND owner_uid = ?`,
      [uid, req.decode.uid],
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        msg: "Agent not found",
      });
    }

    if (newPas) {
      const hasPas = await bcrypt.hash(newPas, 10);

      await query(
        `UPDATE agents 
         SET email = ?, name = ?, mobile = ?, password = ? 
         WHERE uid = ? AND owner_uid = ?`,
        [email, name, mobile, hasPas, uid, req.decode.uid],
      );
    } else {
      await query(
        `UPDATE agents 
         SET email = ?, name = ?, mobile = ? 
         WHERE uid = ? AND owner_uid = ?`,
        [email, name, mobile, uid, req.decode.uid],
      );
    }

    res.json({
      success: true,
      msg: "Agent profile was updated",
    });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "something went wrong",
    });
  }
});

// auto login agent
router.post("/auto_agent_login", validateUser, async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.json({
        success: false,
        msg: "Agent uid is required",
      });
    }

    const agentFind = await query(
      `SELECT * FROM agents WHERE uid = ? AND owner_uid = ?`,
      [uid, req.decode.uid],
    );

    if (agentFind.length < 1) {
      return res.status(404).json({
        success: false,
        msg: "Agent not found",
      });
    }

    const token = sign(
      {
        uid: agentFind[0].uid,
        role: "agent",
        email: agentFind[0].email,
        owner_uid: agentFind[0].owner_uid,
        tokenVersion: agentFind[0]?.tokenVersion ?? 0,
      },
      process.env.JWTKEY,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      token,
      success: true,
    });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "something went wrong",
    });
  }
});

// add warmer message
router.post("/add_warmer_message", validateUser, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.json({ msg: "Please enter a message to add" });
    }

    await query(`INSERT INTO warmer_script (uid, message) VALUES (?,?)`, [
      req.decode.uid,
      message,
    ]);

    res.json({ msg: "Warmer message was added", success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// get my warmer script
router.get("/get_warmer_script", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM warmer_script WHERE uid = ?`, [
      req.decode.uid,
    ]);
    res.json({ data, success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// del a message
router.post("/del_warmer_msg", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM warmer_script WHERE id = ? AND uid = ?`, [
      id,
      req.decode.uid,
    ]);
    res.json({ msg: "Message was deleted", success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ msg: "something went wrong" });
  }
});

// add to warmer
router.post(
  "/add_ins_to_warm",
  validateUser,
  checkPlan,
  checkWaWArmer,
  async (req, res) => {
    try {
      const { instance } = req.body;

      const getWarm = await query(`SELECT * FROM warmers WHERE uid = ?`, [
        req.decode.uid,
      ]);

      const addedIns = JSON.parse(getWarm[0]?.instances);

      if (addedIns.includes(instance)) {
        const finalIns = addedIns.filter((i) => i !== instance);

        await query(`UPDATE warmers SET instances = ? WHERE uid = ?`, [
          JSON.stringify(finalIns),
          req.decode.uid,
        ]);
      } else {
        const fiIns = [...addedIns, instance];
        await query(`UPDATE warmers SET instances = ? WHERE uid = ?`, [
          JSON.stringify(fiIns),
          req.decode.uid,
        ]);
      }

      res.json({
        msg: "Warmer updated",
        success: true,
      });
    } catch (err) {
      logger.error("User route error:", err);
      res.status(500).json({ msg: "something went wrong" });
    }
  },
);

// get my warmer
router.get("/get_my_warmer", validateUser, async (req, res) => {
  try {
    const { uid } = req.decode;

    const getWarmer = await query(`SELECT * FROM warmers WHERE uid = ?`, [uid]);

    if (getWarmer?.length < 1) {
      await query(
        `INSERT INTO warmers (uid, instances, is_active) VALUES (?,?,?)`,
        [uid, JSON.stringify([]), 1],
      );

      // getting warmer again
      const warmer = await query(`SELECT * FROM warmers WHERE uid = ?`, [uid]);

      warmer[0].instances = JSON.parse(warmer[0].instances);
      res.json({ data: warmer[0], success: true });
    } else {
      getWarmer[0].instances = JSON.parse(getWarmer[0].instances);

      res.json({ data: getWarmer[0], success: true });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// change warmer status
router.post("/change_warmer_status", validateUser, async (req, res) => {
  try {
    const { status } = req.body;

    await query(`UPDATE warmers SET is_active = ? WHERE uid = ?`, [
      status ? 1 : 0,
      req.decode.uid,
    ]);

    res.json({ msg: "Status updated", success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// add google auth
router.post("/add_g_auth", validateUser, checkPlan, async (req, res) => {
  try {
    const { label, url } = req.body;
    logger.log(req.body);
    if (!url || !label) {
      return res.json({
        msg: "Please upload and file and give a label to the auth",
      });
    }

    await query(`INSERT INTO g_auth (uid, label, url) VALUES (?,?,?)`, [
      req.decode.uid,
      label,
      url,
    ]);

    res.json({ success: true, msg: "Credentials uploaded" });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// get my creds
router.get("/get_my_g_creds", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM g_auth WHERE uid = ?`, [
      req.decode.uid,
    ]);
    res.json({ data, success: true });
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

router.post("/get_agent_report_old", validateUser, async (req, res) => {
  try {
    let { agentUid, startDate, endDate } = req.body;

    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        msg: "Start date and end date are required",
      });
    }

    // 1. Get agent data (including logs)
    const [agentData] = await query(`SELECT * FROM agents WHERE uid = ?`, [
      agentUid,
    ]);
    if (!agentData) {
      return res.status(404).json({
        success: false,
        msg: "Agent not found",
      });
    }

    // Parse agent logs
    const agentLogs = agentData.logs ? JSON.parse(agentData.logs) : {};

    // 2. Get all chats assigned to this agent
    const agentChats = await query(
      `SELECT * FROM beta_chats WHERE assigned_agent LIKE ? AND createdAt BETWEEN ? AND ?`,
      [`%${agentUid}%`, startDate, endDate],
    );

    // 3. Get all conversations for these chats
    const chatIds = agentChats.map((chat) => chat.chat_id);
    let allConvos = [];
    if (chatIds.length > 0) {
      allConvos = await query(
        `SELECT * FROM beta_conversation WHERE chat_id IN (?) ORDER BY timestamp ASC`,
        [chatIds],
      );
    }

    // Calculate metrics
    const metrics = {
      // Total chats assigned to agent
      totalChats: agentChats.length,

      // Time spent in panel (from logs)
      timeSpent: calculateTimeSpent(agentLogs, startDate, endDate),

      // Average response time
      avgResponseTime: calculateAvgResponseTime(allConvos),

      // Unread messages count
      unreadMessages: agentChats.reduce(
        (sum, chat) => sum + (chat.unread_count || 0),
        0,
      ),

      // Chat status breakdown
      chatStatus: calculateChatStatus(agentChats),

      // Total messages count
      totalMessages: allConvos.length,

      // Incoming/outgoing breakdown
      messageDirection: calculateMessageDirection(allConvos),

      // Last login/logout
      lastActivity: getLastActivity(agentLogs),

      // Daily breakdown for table
      dailyMetrics: calculateDailyMetrics(
        agentChats,
        allConvos,
        agentLogs,
        startDate,
        endDate,
      ),
    };

    res.json({
      success: true,
      data: {
        agentInfo: {
          name: agentData.name,
          email: agentData.email,
          mobile: agentData.mobile,
        },
        metrics,
      },
    });
  } catch (err) {
    logger.error("Error fetching agent report:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch agent report",
      error: err.message,
    });
  }
});

// Helper functions
function calculateTimeSpent(logs, startDate, endDate) {
  let totalSeconds = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date in logs.spendTime) {
    const currentDate = new Date(date);
    if (currentDate >= start && currentDate <= end) {
      totalSeconds += logs.spendTime[date] || 0;
    }
  }

  // Convert to hours and minutes
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function calculateAvgResponseTime(conversations) {
  let totalResponseTime = 0;
  let responseCount = 0;

  for (let i = 0; i < conversations.length - 1; i++) {
    const current = conversations[i];
    const next = conversations[i + 1];

    if (current.route === "INCOMING" && next.route === "OUTGOING") {
      const currentTime = new Date(current.createdAt).getTime();
      const nextTime = new Date(next.createdAt).getTime();
      totalResponseTime += (nextTime - currentTime) / 1000; // in seconds
      responseCount++;
    }
  }

  if (responseCount === 0) return "N/A";

  const avgSeconds = Math.round(totalResponseTime / responseCount);
  const minutes = Math.floor(avgSeconds / 60);
  const seconds = avgSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function calculateChatStatus(chats) {
  const statusCounts = {
    pending: 0,
    open: 0,
    resolved: 0,
    other: 0,
  };

  chats.forEach((chat) => {
    const label = chat.chat_label ? chat.chat_label.toLowerCase() : "other";
    if (label.includes("pending")) {
      statusCounts.pending++;
    } else if (label.includes("open")) {
      statusCounts.open++;
    } else if (label.includes("resolved")) {
      statusCounts.resolved++;
    } else {
      statusCounts.other++;
    }
  });

  return statusCounts;
}

function calculateMessageDirection(conversations) {
  return conversations.reduce(
    (acc, msg) => {
      acc[msg.route === "INCOMING" ? "incoming" : "outgoing"]++;
      return acc;
    },
    { incoming: 0, outgoing: 0 },
  );
}

function getLastActivity(logs) {
  if (!logs.dateTracking) return { lastLogin: "N/A", lastLogout: "N/A" };

  let lastLogin = null;
  let lastLogout = null;

  for (const date in logs.dateTracking) {
    const dayData = logs.dateTracking[date];
    if (
      dayData.lastLogin &&
      (!lastLogin || new Date(dayData.lastLogin) > new Date(lastLogin))
    ) {
      lastLogin = dayData.lastLogin;
    }
    if (
      dayData.lastLogout &&
      (!lastLogout || new Date(dayData.lastLogout) > new Date(lastLogout))
    ) {
      lastLogout = dayData.lastLogout;
    }
  }

  return {
    lastLogin: lastLogin ? formatDate(lastLogin) : "N/A",
    lastLogout: lastLogout ? formatDate(lastLogout) : "N/A",
  };
}

function calculateDailyMetrics(chats, convos, logs, startDate, endDate) {
  const dailyData = {};
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Initialize all dates in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    dailyData[dateStr] = {
      date: dateStr,
      totalChats: 0,
      avgResponseTime: 0,
      incomingMessages: 0,
      outgoingMessages: 0,
      timeSpent: logs.spendTime?.[dateStr] || 0,
    };
  }

  // Count chats per day
  chats.forEach((chat) => {
    const chatDate = new Date(chat.createdAt).toISOString().split("T")[0];
    if (dailyData[chatDate]) {
      dailyData[chatDate].totalChats++;
    }
  });

  // Calculate response times and message counts per day
  const dailyConvos = {};
  convos.forEach((convo) => {
    const convoDate = new Date(convo.createdAt).toISOString().split("T")[0];
    if (!dailyConvos[convoDate]) {
      dailyConvos[convoDate] = [];
    }
    dailyConvos[convoDate].push(convo);
  });

  for (const date in dailyConvos) {
    if (dailyData[date]) {
      const dayConvos = dailyConvos[date];
      dailyData[date].incomingMessages = dayConvos.filter(
        (c) => c.route === "INCOMING",
      ).length;
      dailyData[date].outgoingMessages = dayConvos.filter(
        (c) => c.route === "OUTGOING",
      ).length;
      dailyData[date].avgResponseTime = calculateDailyResponseTime(dayConvos);
    }
  }

  return Object.values(dailyData);
}

function calculateDailyResponseTime(conversations) {
  let totalResponseTime = 0;
  let responseCount = 0;

  for (let i = 0; i < conversations.length - 1; i++) {
    const current = conversations[i];
    const next = conversations[i + 1];

    if (current.route === "INCOMING" && next.route === "OUTGOING") {
      const currentTime = new Date(current.createdAt).getTime();
      const nextTime = new Date(next.createdAt).getTime();
      totalResponseTime += (nextTime - currentTime) / 1000; // in seconds
      responseCount++;
    }
  }

  if (responseCount === 0) return 0;
  return Math.round(totalResponseTime / responseCount / 60); // in minutes
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

router.post("/get_agent_report", validateUser, async (req, res) => {
  try {
    const { uid, startDate, endDate } = req.body;

    logger.log({ uid, startDate, endDate });

    // Date validation and formatting
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.chatDate = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    // Get agent's chats with optional date filtering
    let agentChatsQuery = `SELECT * FROM beta_chats WHERE assigned_agent LIKE ?`;
    const agentChatsParams = [`%${uid}%`];

    if (dateFilter.chatDate) {
      agentChatsQuery += ` AND createdAt BETWEEN ? AND ?`;
      agentChatsParams.push(dateFilter.chatDate.start, dateFilter.chatDate.end);
    }

    const agentChats = await query(agentChatsQuery, agentChatsParams);

    // Get agent data including logs
    const agentData = await query(`SELECT * FROM agents WHERE uid = ?`, [uid]);

    // Calculate time spent in panel
    let totalTimeSpent = 0;
    let lastLogin = null;
    let lastLogout = null;

    if (agentData[0]?.logs) {
      const logs = JSON.parse(agentData[0].logs);
      if (logs.spendTime) {
        totalTimeSpent = Object.values(logs.spendTime).reduce(
          (sum, time) => sum + time,
          0,
        );
      }
      if (logs.dateTracking) {
        const dates = Object.values(logs.dateTracking);
        if (dates.length > 0) {
          lastLogin = dates[dates.length - 1].lastLogin;
          lastLogout = dates[dates.length - 1].lastLogout;
        }
      }
    }

    // Get chat IDs for conversation query
    const chatIds = agentChats.map((chat) => chat.chat_id);

    // Initialize empty conversations array
    let conversations = [];

    // Only query conversations if we have chat IDs
    if (chatIds.length > 0) {
      // Get conversations with optional date filtering
      let conversationsQuery = `SELECT * FROM beta_conversation WHERE chat_id IN (?)`;
      const conversationsParams = [chatIds];

      if (dateFilter.chatDate) {
        conversationsQuery += ` AND createdAt BETWEEN ? AND ?`;
        conversationsParams.push(
          dateFilter.chatDate.start,
          dateFilter.chatDate.end,
        );
      }

      conversationsQuery += ` ORDER BY createdAt ASC`; // Sort from oldest to newest
      conversations = await query(conversationsQuery, conversationsParams);
    }

    // Calculate metrics
    const metrics = {
      totalChats: agentChats.length,
      timeSpentInPanel: totalTimeSpent, // in minutes
      lastLogin,
      lastLogout,
      unreadMessages: agentChats.reduce(
        (sum, chat) => sum + (chat.unread_count || 0),
        0,
      ),
      totalConversations: conversations.length,
      incomingMessages: conversations.filter((msg) => msg.route === "INCOMING")
        .length,
      outgoingMessages: conversations.filter((msg) => msg.route === "OUTGOING")
        .length,
    };

    // Calculate average response time
    let responseTimes = [];
    let lastIncoming = null;

    conversations.forEach((msg) => {
      if (msg.route === "INCOMING") {
        lastIncoming = new Date(msg.timestamp);
      } else if (msg.route === "OUTGOING" && lastIncoming) {
        const outgoingTime = new Date(msg.timestamp);
        const diff = (outgoingTime - lastIncoming) / 1000; // in seconds
        responseTimes.push(diff);
        lastIncoming = null;
      }
    });

    metrics.avgResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length,
          )
        : 0;

    // Calculate chat status counts
    const statusCounts = {
      open: 0,
      pending: 0,
      unresolved: 0,
      important: 0,
    };

    agentChats.forEach((chat) => {
      if (chat.chat_label) {
        const label = JSON.parse(chat.chat_label);
        if (label.title === "Important") statusCounts.important++;
        // Add more status checks as needed
      }
      // Add other status checks based on your business logic
    });

    metrics.statusCounts = statusCounts;

    res.json({
      success: true,
      data: {
        metrics,
        agentData: agentData[0],
        conversations: conversations.slice(0, 100), // Limit to 100 most recent
        agentChats: agentChats.slice(0, 100), // Limit to 100 most recent
      },
    });
  } catch (err) {
    logger.error(err);
    res.json({
      success: false,
      msg: "Failed to generate agent report",
      err: err.message,
    });
  }
});

router.get("/get_my_meta_templets_beta", validateUser, async (req, res) => {
  try {
    const getMETA = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (getMETA.length < 1) {
      return res.json({
        success: false,
        msg: "Please check your meta API keys",
      });
    }

    // Add pagination and filtering options
    const limit = req.query.limit || 9;
    const after = req.query.after || null;
    const before = req.query.before || null;
    const status = req.query.status || "APPROVED";

    const resp = await getAllTempletsMetaBeta(
      "v21.0", // Use your API version
      getMETA[0]?.waba_id,
      getMETA[0]?.access_token,
      limit,
      after,
      before,
      status,
    );

    if (resp?.error) {
      res.json({
        success: false,
        msg: resp?.error?.message || "Please check your API",
      });
    } else {
      // Process templates to extract variable information
      const templatesWithVars =
        resp?.data?.map((template) => {
          const variables = extractTemplateVariablesBeta(template);
          return {
            ...template,
            variables,
          };
        }) || [];

      res.json({
        success: true,
        data: templatesWithVars,
        paging: resp?.paging || {},
      });
    }
  } catch (err) {
    logger.error("User route error:", err);
    res.status(500).json({ success: false, msg: "something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/user/send_template_message
// ─────────────────────────────────────────────────────────────
router.post("/send_template_message", validateUser, async (req, res) => {
  try {
    const {
      template_name,
      template_language = "en_US",
      recipient_phone,
      body_variables = [],
      header_variable = null,
      button_variables = [],
      template_type = "STANDARD",
    } = req.body;

    if (!template_name || !recipient_phone) {
      return res.json({
        success: false,
        msg: "Template name and recipient phone are required",
      });
    }

    const formattedPhone = formatPhoneNumber(recipient_phone);

    const getMETA = await query(
      `SELECT * FROM meta_api WHERE uid = ? LIMIT 1`,
      [req.decode.uid],
    );

    if (!getMETA || getMETA.length < 1) {
      return res.json({
        success: false,
        msg: "Please check your meta API keys",
      });
    }

    const { business_phone_number_id, access_token, waba_id } = getMETA[0];

    let response;

    if (template_type === "CAROUSEL") {
      const cards = header_variable?.cards || [];
      if (cards.length < 2) {
        return res.json({
          success: false,
          msg: "Carousel templates require at least 2 cards",
        });
      }
      response = await sendCarouselTemplateMessage(
        META_API_VERSION,
        business_phone_number_id,
        access_token,
        template_name,
        template_language,
        formattedPhone,
        body_variables,
        cards,
      );
    } else if (template_type === "CATALOG") {
      response = await sendCatalogTemplateMessage(
        META_API_VERSION,
        business_phone_number_id,
        access_token,
        template_name,
        template_language,
        formattedPhone,
        body_variables,
        header_variable?.thumbnail || null,
      );
    } else {
      // ── Fetch the actual template from Meta to know its structure ──
      let templateDef = null;
      try {
        const tplRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${waba_id}/message_templates?name=${encodeURIComponent(template_name)}&fields=name,components,language,status`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          },
        );
        const tplData = await tplRes.json();
        templateDef =
          (tplData?.data || []).find(
            (t) =>
              t.name === template_name &&
              (t.language === template_language ||
                t.language === template_language.replace("_", "-")),
          ) ||
          tplData?.data?.[0] ||
          null;
      } catch (e) {
        logger.warn("Could not fetch template definition:", e.message);
      }

      const flowBtn = (button_variables || []).find(
        (bv) => bv.sub_type === "flow",
      );
      const flowButtonToken = flowBtn?.flow_token || null;
      const regularButtonVars = (button_variables || []).filter(
        (bv) => bv.sub_type !== "flow",
      );

      response = await sendTemplateMessage(
        META_API_VERSION,
        business_phone_number_id,
        access_token,
        template_name,
        template_language,
        formattedPhone,
        body_variables,
        header_variable,
        regularButtonVars,
        flowButtonToken,
        templateDef, // ✅ pass template definition
      );
    }

    if (response?.error) {
      return res.json({
        success: false,
        msg: response?.error?.message || "Failed to send template message",
        code: response?.error?.code,
        error: response.error,
      });
    }

    return res.json({
      success: true,
      msg: "Template message sent successfully",
      data: response,
    });
  } catch (err) {
    logger.error("Error sending template message:", err);
    return res.json({
      success: false,
      msg: "Something went wrong while sending the template",
      error: err.message,
    });
  }
});

// add quick reply
router.post("/add_quick_reply", validateUser, async (req, res) => {
  try {
    const { msg } = req.body;
    if (!msg) return res.json({ msg: "Please enter message to add" });

    await prisma.quick_reply.create({
      data: {
        uid: req.decode.uid,
        msg,
      },
    });

    res.json({ success: true, msg: "Quick reply added" });
  } catch (err) {
    logger.error("Error adding quick reply:", err);
    res.json({
      success: false,
      msg: "something went wrong",
      err: err,
    });
  }
});

// get all quick reply
router.get("/get_all_quick_reply", validateUser, async (req, res) => {
  try {
    const data = await prisma.quick_reply.findMany({
      where: {
        uid: req.decode.uid,
      },
    });
    res.json({ data: sanitizeBigInt(data), success: true });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "something went wrong",
      err: err,
    });
  }
});

// del one quick repl
router.post("/del_quick_r", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.quick_reply.deleteMany({
      where: {
        uid: req.decode.uid,
        id: parseInt(id, 10),
      },
    });
    res.json({
      success: true,
      msg: "Quick reply deleted",
    });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "something went wrong",
      err: err,
    });
  }
});

router.post("/update_fcm_token", validateUser, async (req, res) => {
  try {
    const { other, token } = req.body;
    const user = req.decode.userData;

    // 1️⃣ Remove token everywhere first
    await removeTokenFromAll(token);

    // 2️⃣ Parse CURRENT USER fcm_data safely
    let fcmData;
    try {
      fcmData = JSON.parse(user?.fcm_data || "{}");
    } catch {
      fcmData = {};
    }

    const existingTokens = Array.isArray(fcmData.tokens) ? fcmData.tokens : [];
    const existingOther =
      typeof fcmData.other === "object" && fcmData.other !== null
        ? fcmData.other
        : {};

    // 3️⃣ Add token to current user (no duplicates)
    // const newTokens = existingTokens.includes(token)
    //   ? existingTokens
    //   : [...existingTokens, token];

    const newTokens = [token];

    const newUpdated = {
      tokens: newTokens,
      other: { ...existingOther, ...other },
    };

    // 4️⃣ Save final data
    await query(`UPDATE user SET fcm_data = ? WHERE uid = ?`, [
      JSON.stringify(newUpdated),
      req.decode.uid,
    ]);

    res.json({ success: true, fcm_data: newUpdated });
  } catch (err) {
    logger.error("❌ USER FCM update error:", err);
    res.status(500).json({
      success: false,
      msg: "Something went wrong",
      err: err.message,
    });
  }
});

router.post("/exchange_embed_token", validateUser, async (req, res) => {
  try {
    const { authCode, wabaId, phoneNumId, businessId, isCoexistence } =
      req.body;

    // 🔥 CRITICAL: Log what we received
    logger.log("📥 /exchange_embed_token received:", {
      authCode: authCode ? "✅ present" : "❌ missing",
      wabaId,
      phoneNumId,
      businessId,
      isCoexistence, // 🔥 CHECK THIS VALUE
      uid: req.decode.uid,
    });

    const [web] = await query(`SELECT * FROM web_private`, []);

    if (!web || !web?.embed_app_id || !web?.embed_app_sec) {
      return res.json({
        success: false,
        msg: "Embed app is not configured. Please configure it from admin panel",
      });
    }

    const appId = web?.embed_app_id;
    const appSecret = web?.embed_app_sec;

    // 🔥 CRITICAL: Pass isCoexistence correctly
    const genToken = await exchangeEmbedToken({
      appId,
      appSecret,
      authCode,
      wabaId,
      phoneNumId,
      businessId,
      isCoexistence: isCoexistence === true || isCoexistence === "true", // 🔥 Handle both boolean and string
    });

    logger.log("🔄 exchangeEmbedToken result:", {
      success: genToken?.success,
      isCoexistence: genToken?.data?.isCoexistence,
      msg: genToken?.msg,
    });

    if (genToken?.success) {
      const waba_id = genToken?.data?.waba?.id || null;
      const access_token = genToken?.data?.token || null;
      const business_phone_number_id = genToken?.data?.phoneNumId || null;
      const app_id = appId || null;
      const is_coexistence = genToken?.data?.isCoexistence || false;
      const platform_type = genToken?.data?.platformType || null;

      // Guard: if critical fields are missing, return error
      if (!waba_id || !access_token || !business_phone_number_id) {
        logger.error("❌ exchange_embed_token: missing critical fields", {
          waba_id,
          access_token: access_token ? "present" : "missing",
          business_phone_number_id,
        });
        return res.json({
          success: false,
          msg: "Token exchange succeeded but returned incomplete data. Please try again.",
        });
      }

      const findOne = await query(`SELECT * FROM meta_api WHERE uid = ?`, [
        req.decode.uid,
      ]);

      if (findOne.length > 0) {
        // ✅ Explicit full update — nothing left stale
        const updateResult = await query(
          `UPDATE meta_api SET 
        embed_data = ?, 
        login_type = ?, 
        waba_id = ?, 
        access_token = ?, 
        business_phone_number_id = ?, 
        app_id = ?, 
        is_coexistence = ?, 
        platform_type = ?
      WHERE uid = ?`,
          [
            JSON.stringify(genToken?.data),
            "embed",
            waba_id,
            access_token,
            business_phone_number_id,
            app_id,
            is_coexistence ? 1 : 0,
            platform_type,
            req.decode.uid,
          ],
        );

        logger.log("✅ embed UPDATE result:", updateResult);
      } else {
        await query(
          `INSERT INTO meta_api 
        (uid, embed_data, login_type, waba_id, access_token, business_phone_number_id, app_id, is_coexistence, platform_type) 
      VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            req.decode.uid,
            JSON.stringify(genToken?.data),
            "embed",
            waba_id,
            access_token,
            business_phone_number_id,
            app_id,
            is_coexistence ? 1 : 0,
            platform_type,
          ],
        );

        logger.log("✅ embed INSERT done");
      }
    }

    res.json(genToken);
  } catch (err) {
    logger.error("❌ /exchange_embed_token error:", err);
    logger.error("Return media URL error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

router.get("/get_embed_keys", validateUser, async (req, res) => {
  try {
    const [web] = await query(`SELECT * FROM web_private`, []);
    const hasConfig = Boolean(web?.embed_app_id && web?.embed_app_config && web?.embed_app_sec);
    res.json({
      success: true,
      data: {
        embed_app_id: web?.embed_app_id || null,
        embed_app_config: web?.embed_app_config || null,
        graph_version: "v21.0",
        configured: hasConfig,
      },
    });
  } catch (err) {
    logger.error("Meta config error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

// disconnect / delete meta connection for authenticated user
router.post("/disconnect_meta", validateUser, async (req, res) => {
  try {
    await query(`DELETE FROM meta_api WHERE uid = ?`, [req.decode.uid]);
    res.json({
      success: true,
      msg: "WhatsApp Business connection removed successfully",
    });
  } catch (err) {
    logger.error("disconnect_meta error:", err);
    res.status(500).json({ success: false, msg: "Failed to disconnect Meta account" });
  }
});

router.post("/try_js", validateUser, async (req, res) => {
  const { code, previousResponse, allResponses } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      error: "Invalid code",
    });
  }

  if (code.length > 5000) {
    return res.status(400).json({
      success: false,
      error: "Code is too long",
    });
  }

  try {
    const runResult = await executeSafeJs(code, {
      response: previousResponse || null,
      allResponses: allResponses || {},
    }, 5000);

    if (!runResult.success) {
      return res.json({
        success: false,
        error: runResult.error,
        logs: runResult.logs || [],
      });
    }

    res.json({
      success: true,
      data: runResult.result !== undefined ? runResult.result : null,
      logs: runResult.logs || [],
      warning:
        runResult.result === null ? "No return statement found in code" : null,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      errorType: error.name,
    });
  }
});

// MercadoPago endpoints retired in favor of /api/billing (SEC-07)
router.post("/create_mercadopago_preference", validateUser, retiredPaymentHandler);
router.get("/mercadopago_payment", retiredPaymentHandler);
router.post("/mercadopago_webhook", retiredPaymentHandler);

// get fcm data admin
router.get("/get_fcm_data", validateUser, async (req, res) => {
  try {
    const [data] = await query(
      `SELECT fcm_apiKey, 
      fcm_authDomain, 
      fcm_projectId, 
      fcm_storageBucket, 
      fcm_messagingSenderId, 
      fcm_appId, 
      fcm_measurementId, 
      fcm_vapidKey FROM web_private`,
      [],
    );
    res.json({ data, success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

router.post("/update_web_fcm_token", validateUser, async (req, res) => {
  try {
    const { token, otherMetaData } = req.body;

    const rows = await query(`SELECT * FROM fcm_tokens WHERE uid = ?`, [
      req.decode.uid,
    ]);

    const existing = rows[0];

    if (!token) {
      await query(`DELETE FROM fcm_tokens WHERE uid = ?`, [req.decode.uid]);
      return res.json({ success: true });
    }

    if (existing) {
      await query(`UPDATE fcm_tokens SET token = ?, other = ? WHERE uid = ?`, [
        token,
        JSON.stringify(otherMetaData),
        req.decode.uid,
      ]);
    } else {
      logger.log("➕ INSERTING new token");
      await query(
        `INSERT INTO fcm_tokens (uid, token, other) VALUES (?, ?, ?)`,
        [req.decode.uid, token, JSON.stringify(otherMetaData)],
      );
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false });
  }
});

// ─── Route 2: Only update fcm_inbox preference (called on switch toggle) ───
router.post("/update_fcm_choice", validateUser, async (req, res) => {
  try {
    const { fcm_inbox } = req.body;

    await query(`UPDATE user SET fcm_inbox = ? WHERE uid = ?`, [
      fcm_inbox ? 1 : 0,
      req.decode.uid,
    ]);

    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false });
  }
});

// GET all tags (already exists)
router.get("/get_chat_tags", validateUser, async (req, res) => {
  try {
    const data = await prisma.chat_tags.findMany({
      where: {
        uid: req.decode.uid,
      },
    });
    res.json({ success: true, data: sanitizeBigInt(data) });
  } catch (err) {
    logger.error(err);
    res.json({ success: false });
  }
});

// POST create new tag
router.post("/add_chat_tag", validateUser, async (req, res) => {
  try {
    const { title, hex } = req.body;
    if (!title || title.length > 12)
      return res.json({ success: false, msg: "Invalid title" });

    await prisma.chat_tags.create({
      data: {
        uid: req.decode.uid,
        title,
        hex: hex || "#6366F1",
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false });
  }
});

// POST delete tag
router.post("/delete_chat_tag", validateUser, async (req, res) => {
  try {
    const { labelId } = req.body;
    await prisma.chat_tags.deleteMany({
      where: {
        id: parseInt(labelId, 10),
        uid: req.decode.uid,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ success: false });
  }
});

// GET /api/user/get_phonebook_for_inbox
// Search contacts for inbox new chat (user side)
router.get("/get_phonebook_for_inbox", validateUser, async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM contact 
       WHERE uid = ? AND (name LIKE ? OR mobile LIKE ?)`,
      [req.decode.uid, searchTerm, searchTerm],
    );

    const data = await query(
      `SELECT id, name, mobile, phonebook_name, var1, var2 
       FROM contact 
       WHERE uid = ? AND (name LIKE ? OR mobile LIKE ?)
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [req.decode.uid, searchTerm, searchTerm, parseInt(limit), offset],
    );

    res.json({
      success: true,
      data,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: offset + data.length < countResult.total,
    });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

// Get current user plan, live entitlements, and usage limits
router.get("/get_plan_details", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const users = await query("SELECT * FROM user WHERE uid = ?", [uid]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const user = users[0];
    const resolution = await resolveUserPlan(user);
    const plan = resolution.plan;

    const [contactUsage, qrUsage] = await Promise.all([
      getUsage(uid, "contacts"),
      getUsage(uid, "qr_accounts"),
    ]);

    const contactLimit = getLimit(plan, "contacts");
    const qrLimit = getLimit(plan, "qr_accounts");

    res.json({
      success: true,
      data: {
        isValid: resolution.isValid,
        isExpired: resolution.isExpired,
        daysLeft: resolution.daysLeft ?? 0,
        plan_expire: user.plan_expire,
        plan: plan,
        usage: {
          contacts: {
            used: contactUsage,
            limit: contactLimit,
            remaining: Math.max(0, contactLimit - contactUsage),
            percentage:
              contactLimit > 0
                ? Math.min(100, Math.round((contactUsage / contactLimit) * 100))
                : 0,
          },
          qr_accounts: {
            used: qrUsage,
            limit: qrLimit,
            remaining: Math.max(0, qrLimit - qrUsage),
            percentage:
              qrLimit > 0
                ? Math.min(100, Math.round((qrUsage / qrLimit) * 100))
                : 0,
          },
        },
        entitlements: getAllEntitlements(plan),
      },
    });
  } catch (err) {
    logger.error("Error in /get_plan_details:", err);
    res
      .status(500)
      .json({ success: false, msg: "Failed to fetch plan details" });
  }
});

// ─── USER WORKSPACE ANALYTICS (REAL DATABASE METRICS ONLY) ───────────────────
const { getUserWorkspaceAnalytics } = require("../services/analytics/analyticsService.js");

router.get("/analytics", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { range, startDate, endDate, instanceId } = req.query;

    const data = await getUserWorkspaceAnalytics(uid, {
      range,
      startDate,
      endDate,
      instanceId,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error("User analytics error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      msg: err.message || "Failed to generate analytics",
    });
  }
});

// ─── IN-APP USER NOTIFICATIONS ───────────────────────────────────────────────
router.get("/notifications", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const notifications = await prisma.in_app_notifications.findMany({
      where: {
        OR: [{ uid }, { uid: "ALL" }],
      },
      orderBy: { created_at: "desc" },
      take: 30,
    });

    const unreadCount = await prisma.in_app_notifications.count({
      where: {
        OR: [{ uid }, { uid: "ALL" }],
        is_read: false,
      },
    });

    res.json({
      success: true,
      data: sanitizeBigInt(notifications) || [],
      unreadCount: unreadCount || 0,
    });
  } catch (err) {
    logger.error("Fetch notifications error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch notifications" });
  }
});

router.post("/mark_notification_read", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const { id, all } = req.body;

    if (all) {
      await prisma.in_app_notifications.updateMany({
        where: {
          OR: [{ uid }, { uid: "ALL" }],
        },
        data: { is_read: true },
      });
      return res.json({ success: true, msg: "All notifications marked as read" });
    }

    if (!id) {
      return res.status(400).json({ success: false, msg: "Notification ID required" });
    }

    await prisma.in_app_notifications.updateMany({
      where: {
        id: parseInt(id, 10),
        OR: [{ uid }, { uid: "ALL" }],
      },
      data: { is_read: true },
    });

    res.json({ success: true, msg: "Notification marked as read" });
  } catch (err) {
    logger.error("Mark read error:", err);
    res.status(500).json({ success: false, msg: "Failed to update notification" });
  }
});

module.exports = router;
