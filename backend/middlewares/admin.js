const jwt = require("jsonwebtoken");
const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");

const adminValidator = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, msg: "No token found", logout: true });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWTKEY, async (err, decode) => {
      if (err) {
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
      const getAdmin = await query(`SELECT * FROM admin WHERE uid = ?`, [
        decode.uid,
      ]);

      if (getAdmin.length < 1) {
        return res.status(403).json({
          success: false,
          msg: "Unauthorized: administrator privileges required",
          logout: true,
        });
      }

      const admin = getAdmin[0];

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
    });
  } catch (err) {
    logger.error("adminValidator error:", err);
    res.status(500).json({ success: false, msg: "server error" });
  }
};

module.exports = adminValidator;
