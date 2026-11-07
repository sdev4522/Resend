const jwt = require("jsonwebtoken");
const { prisma, sanitizeBigInt } = require("../database/prisma");
const logger = require("../utils/logger");

const validateUser = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        msg: "No token found",
        // logout: true,
      });
    }

    const token = authHeader.split(" ")[1];

    let decode;

    try {
      decode = jwt.verify(token, process.env.JWTKEY);
    } catch (err) {
      return res.status(401).json({
        success: false,
        msg: "Invalid token found",
        // logout: true,
      });
    }

    if (!decode?.uid || decode?.role !== "user") {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized token",
        // logout: true,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        uid: decode.uid,
        role: "user",
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        msg: "Invalid token found",
        // logout: true,
      });
    }

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        msg: "Your account has been suspended by an administrator. Please contact support.",
      });
    }

    if (!user.email_verified_at) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        logout: true,
        email_unverified: true,
        email: user.email,
        msg: "Please verify your email address before accessing the application.",
      });
    }

    if (
      typeof decode.tokenVersion === "undefined" ||
      Number(user.tokenVersion || 0) !== Number(decode.tokenVersion)
    ) {
      return res.status(401).json({
        success: false,
        msg: "Session expired. Please login again.",
        // logout: true,
      });
    }

    req.decode = {
      uid: user.uid,
      role: "user",
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
      userData: sanitizeBigInt(user),
    };

    next();
  } catch (err) {
    logger.log(err);
    return res.status(500).json({
      success: false,
      msg: "server error",
    });
  }
};

module.exports = validateUser;
