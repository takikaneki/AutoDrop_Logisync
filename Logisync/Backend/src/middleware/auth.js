const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
  req.user = decoded;

  // Inactive (deactivated) sellers/riders lose access immediately, even with an existing session.
  if (decoded.role === "seller" || decoded.role === "rider") {
    const { pool } = require("../config/database");
    pool
      .query("SELECT verification_status FROM users WHERE user_id = ?", [decoded.user_id])
      .then(([rows]) => {
        if (rows.length && String(rows[0].verification_status).toUpperCase() === "REJECTED") {
          return res.status(403).json({
            success: false,
            message: "Your account is inactive. Please contact the Coordinator."
          });
        }
        next();
      })
      .catch(() => next());
    return;
  }
  next();
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You are not authorized to access this resource." });
    }
    next();
  };
}

// Rider classification guard. FM = First Mile (seller pickups), LM = Last Mile (buyer deliveries).
// Binabasa ang rider_type sa database (hindi sa token) para hindi malusutan.
function requireRiderType(...allowedTypes) {
  return async (req, res, next) => {
    if (!req.user || req.user.role !== "rider") return next();
    try {
      const { pool } = require("../config/database");
      const [rows] = await pool.query("SELECT rider_type FROM users WHERE user_id = ?", [req.user.user_id]);
      const type = String(rows[0]?.rider_type || "LM").toUpperCase();
      if (!allowedTypes.includes(type)) {
        return res.status(403).json({
          success: false,
          message:
            type === "FM"
              ? "First Mile (FM) riders handle seller pickups only. Delivery actions are for Last Mile (LM) riders."
              : "Last Mile (LM) riders handle buyer deliveries only. Pickup actions are for First Mile (FM) riders."
        });
      }
      next();
    } catch (err) {
      next();
    }
  };
}

module.exports = { authenticateToken, authorizeRoles, requireRiderType };