const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

async function authenticateToken(req, res, next) {
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

  try {
    // Retrieve actual user record from trusted database
    const [rows] = await pool.query(
      "SELECT user_id, name, email, role, verification_status FROM users WHERE user_id = ?",
      [decoded.user_id]
    );

    if (!rows || !rows.length) {
      return res.status(401).json({ success: false, message: "User account no longer exists." });
    }

    const dbUser = rows[0];

    // Enforce account suspension
    if (
      (dbUser.role === "seller" || dbUser.role === "rider") &&
      String(dbUser.verification_status || "").toUpperCase() === "REJECTED"
    ) {
      return res.status(403).json({ success: false, message: "Your account has been suspended." });
    }

    // Attach verified user info with trusted database role
    req.user = {
      ...decoded,
      user_id: dbUser.user_id,
      name: dbUser.name,
      email: dbUser.email,
      role: String(dbUser.role || "").toLowerCase()
    };
    next();
  } catch {
    // Fallback to cryptographically verified decoded JWT if DB is temporarily unreachable
    req.user = {
      ...decoded,
      role: String(decoded.role || "").toLowerCase()
    };
    next();
  }
}

function authorizeRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => String(r || "").toLowerCase());
  return (req, res, next) => {
    const userRole = String(req.user?.role || "").toLowerCase();
    if (!req.user || !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource."
      });
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

