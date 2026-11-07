const jwt = require("jsonwebtoken");
const { prisma } = require("../database/prisma");
const logger = require("../utils/logger");

const adminValidator = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, msg: "No token found", logout: true });
    }

    const token = authHeader.split(" ")[1];

    let decode;
    try {
      decode = jwt.verify(token, process.env.JWTKEY);
    } catch (err) {
      return res.status(401).json({
        success: false,
        msg: "Invalid token found",
        logout: true,
      });
    }

    if (!decode?.uid || decode.role !== "admin") {
      return res.status(403).json({
        success: false,
        msg: "Unauthorized: administrator role required",
        logout: true,
      });
    }

    // Fetch admin by uid only — no password in DB query
    const admin = await prisma.admin.findFirst({
      where: { uid: decode.uid },
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        msg: "Unauthorized: administrator privileges required",
        logout: true,
      });
    }

    // tokenVersion check — invalidates all old tokens on password change or logout
    if (
      typeof decode.tokenVersion !== "undefined" &&
      Number(admin.tokenVersion || 0) !== Number(decode.tokenVersion)
    ) {
      return res.status(401).json({
        success: false,
        msg: "Session expired. Please login again.",
        logout: true,
      });
    }

    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        msg: "Unauthorized: administrator role required",
        logout: true,
      });
    }

    req.decode = decode;
    next();
  } catch (err) {
    logger.error("adminValidator error:", err);
    res.status(500).json({ success: false, msg: "server error" });
  }
};

module.exports = adminValidator;
