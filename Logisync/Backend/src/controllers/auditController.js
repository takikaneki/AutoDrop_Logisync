const { pool } = require("../config/database");

// GET /api/audit-logs?limit=&offset=&category=&q=
// Strict personal visibility across ALL roles (Coordinator, Seller, Rider):
// every authenticated user sees ONLY activity logs where actor_id matches their own user_id.
async function listAuditLogs(req, res) {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // Reject attempts to request another user's logs or system-wide logs via query/body parameters.
    const requestedActor =
      req.query.actor_id ?? req.query.actorId ?? req.query.user_id ?? req.query.userId ?? null;
    if (requestedActor !== null && String(requestedActor).trim() !== "" && Number(requestedActor) !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access another user's activity logs.",
      });
    }
    if (
      String(req.query.all || "").toLowerCase() === "true" ||
      String(req.query.scope || "").toLowerCase() === "all" ||
      (req.query.role && String(req.query.role).toLowerCase() !== String(req.user?.role || "").toLowerCase())
    ) {
      return res.status(403).json({
        success: false,
        message: "System-wide or cross-role activity log access is not permitted.",
      });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const where = ["actor_id = ?"];
    const params = [userId];

    if (req.query.category) {
      where.push("category = ?");
      params.push(String(req.query.category));
    }

    const q = String(req.query.q || "").trim();
    if (q) {
      where.push("(LOWER(action) LIKE LOWER(?) OR LOWER(COALESCE(target, '')) LIKE LOWER(?) OR LOWER(COALESCE(detail, '')) LIKE LOWER(?) OR LOWER(actor_name) LIKE LOWER(?))");
      params.push(...Array(4).fill(`%${q}%`));
    }

    const clause = `WHERE ${where.join(" AND ")}`;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${clause}`, params);
    const [logs] = await pool.query(
      `SELECT log_id, actor_id, actor_name, actor_role, category, action, target, detail, created_at
       FROM audit_logs ${clause}
       ORDER BY created_at DESC, log_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, logs, total });
  } catch (error) {
    console.error("listAuditLogs error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve the activity log. Has database/migration-v2.sql been run?" });
  }
}

module.exports = { listAuditLogs };
