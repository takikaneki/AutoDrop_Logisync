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

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: "Server authentication configuration error." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }

  // Strictly reject temporary OTP / first-login tokens from accessing protected APIs
  if (
    (decoded.token_type && decoded.token_type !== "session") ||
    decoded.purpose ||
    decoded.otp_id
  ) {
    return res.status(401).json({
      success: false,
      message: "Temporary verification tokens cannot be used to access protected resources."
    });
  }

  try {
    // Retrieve actual user record from trusted database
    const [rows] = await pool.query(
      "SELECT user_id, name, email, role, verification_status, first_login FROM users WHERE user_id = $1",
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
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact the Coordinator."
      });
    }

    // Enforce mandatory first-time login password change on the backend
    if (Boolean(dbUser.first_login)) {
      return res.status(403).json({
        success: false,
        code: "FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED",
        message: "You must complete first-time password setup before accessing this resource."
      });
    }

    // Attach verified user info with trusted database role
    req.user = {
      ...decoded,
      user_id: dbUser.user_id,
      name: dbUser.name,
      email: dbUser.email,
      role: String(dbUser.role || "").toLowerCase(),
      first_login: false
    };
    next();
  } catch (err) {
    console.error("authenticateToken database verification error:", err?.code || err?.message);
    return res.status(503).json({
      success: false,
      message: "Authentication service is temporarily unavailable. Please try again."
    });
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
