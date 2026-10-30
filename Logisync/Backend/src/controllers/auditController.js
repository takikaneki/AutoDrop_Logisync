const { pool } = require("../config/database");

// GET /api/audit-logs?limit=&offset=&category=&q=
// Sino ang nakakakita ng ano:
//   coordinator -> lahat
//   seller      -> sariling ginawa + mga nangyari sa sarili niyang parcel
//   rider       -> sariling ginawa + mga nangyari sa parcel na hawak niya
async function listAuditLogs(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const where = [];
    const params = [];

    const { role, user_id } = req.user;
    if (role === "seller") {
      where.push("(actor_id = ? OR seller_id = ?)");
      params.push(user_id, user_id);
    } else if (role === "rider") {
      where.push("(actor_id = ? OR rider_id = ?)");
      params.push(user_id, user_id);
    }

    if (req.query.category) {
      where.push("category = ?");
      params.push(String(req.query.category));
    }

    const q = String(req.query.q || "").trim();
    if (q) {
      where.push("(action LIKE ? OR target LIKE ? OR detail LIKE ? OR actor_name LIKE ?)");
      params.push(...Array(4).fill(`%${q}%`));
    }

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

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
