const { pool, rawPool, ensureSchema } = require("../config/database");
const { logAudit } = require("../utils/audit");
const { sendEmergencyAlertPush } = require("../utils/webPush");

const VALID_STATUSES = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"];

let emergencySchemaReady = false;

async function ensureEmergencySchema() {
  if (emergencySchemaReady) return;
  await ensureSchema();
  emergencySchemaReady = true;
}

function parseHistory(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatReport(row) {
  if (!row) return null;
  return {
    report_id: row.report_id,
    report_code: row.report_code,
    user_id: row.user_id,
    reporter_role: row.reporter_role,
    reporter_name: row.reporter_name,
    reporter_identifier: row.reporter_identifier || null,
    category: row.category,
    subject: row.subject,
    description: row.description,
    location: row.location,
    photo_data_url: row.photo_data_url || null,
    status: row.status || "NEW",
    acknowledged_at: row.acknowledged_at || null,
    acknowledged_by: row.acknowledged_by || null,
    acknowledged_by_name: row.acknowledged_by_name || null,
    resolved_at: row.resolved_at || null,
    resolved_by: row.resolved_by || null,
    resolved_by_name: row.resolved_by_name || null,
    history: parseHistory(row.history),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// POST /api/emergency-reports  (seller or rider)
async function createEmergencyReport(req, res) {
  try {
    await ensureEmergencySchema();
    const role = String(req.user?.role || "").toLowerCase();
    if (!["seller", "rider"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only Seller and Rider accounts can submit emergency reports.",
      });
    }

    const {
      category,
      subject,
      description,
      location,
      photo_data_url = null,
      client_submission_id = null,
    } = req.body || {};

    const cleanCategory = String(category || "").trim().slice(0, 100);
    const cleanSubject = String(subject || "").trim().slice(0, 200);
    const cleanDescription = String(description || "").trim().slice(0, 3000);
    const cleanLocation = String(location || "").trim().slice(0, 300);
    const cleanClientId = client_submission_id
      ? String(client_submission_id).trim().slice(0, 80)
      : null;

    if (!cleanCategory) {
      return res.status(400).json({ success: false, message: "Please select an emergency category." });
    }
    if (!cleanSubject) {
      return res.status(400).json({ success: false, message: "Please enter a short subject or title." });
    }
    if (!cleanDescription) {
      return res.status(400).json({ success: false, message: "Please describe the emergency." });
    }
    if (!cleanLocation) {
      return res.status(400).json({ success: false, message: "Please enter the location or relevant address." });
    }

    let cleanPhoto = null;
    if (photo_data_url) {
      const s = String(photo_data_url).trim();
      if (!s.startsWith("data:image/")) {
        return res.status(400).json({ success: false, message: "Photo attachment must be a valid image." });
      }
      if (s.length > 900000) {
        return res.status(400).json({
          success: false,
          message: "Photo attachment is too large. Please select a smaller image.",
        });
      }
      cleanPhoto = s;
    }

    // Prevent accidental duplicate submissions using client_submission_id
    if (cleanClientId) {
      const [existing] = await pool.query(
        `SELECT * FROM emergency_reports WHERE client_submission_id = ? AND user_id = ? LIMIT 1`,
        [cleanClientId, req.user.user_id]
      );
      if (existing.length > 0) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: `Emergency report ${existing[0].report_code} was already submitted.`,
          report: formatReport(existing[0]),
        });
      }
    }

    // Look up reporter code (SEL-xxxx / RID-xxxx) for durable identification
    const [uRows] = await pool.query(
      "SELECT name, seller_code, rider_code FROM users WHERE user_id = ? LIMIT 1",
      [req.user.user_id]
    );
    const dbUser = uRows[0] || {};
    const reporterName = String(dbUser.name || req.user.name || (role === "seller" ? "Seller" : "Rider")).trim();
    const reporterIdentifier =
      role === "seller"
        ? dbUser.seller_code || `SEL-${String(req.user.user_id).padStart(4, "0")}`
        : dbUser.rider_code || `RID-${String(req.user.user_id).padStart(4, "0")}`;

    const initialHistory = [
      {
        at: new Date().toISOString(),
        actor_id: req.user.user_id,
        actor_name: reporterName,
        actor_role: role,
        action: "Emergency report submitted",
        status: "NEW",
        note: `${cleanCategory}: ${cleanSubject}`,
      },
    ];

    const { rows: insertedRows } = await rawPool.query(
      `INSERT INTO emergency_reports (
         report_code,
         client_submission_id,
         user_id,
         reporter_role,
         reporter_name,
         reporter_identifier,
         category,
         subject,
         description,
         location,
         photo_data_url,
         status,
         history
       )
       VALUES (
         'EMR-' || LPAD(nextval('emergency_report_seq')::text, 4, '0'),
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'NEW', $11::jsonb
       )
       RETURNING *`,
      [
        cleanClientId,
        req.user.user_id,
        role,
        reporterName,
        reporterIdentifier,
        cleanCategory,
        cleanSubject,
        cleanDescription,
        cleanLocation,
        cleanPhoto,
        JSON.stringify(initialHistory),
      ]
    );

    const savedRow = insertedRows[0];

    await logAudit(req.user, {
      category: "Emergency",
      action: "Submitted emergency report",
      target: savedRow.report_code,
      detail: `${role === "seller" ? "Seller" : "Rider"} (${reporterIdentifier}) · ${cleanCategory}: ${cleanSubject}`,
      sellerId: role === "seller" ? req.user.user_id : null,
      riderId: role === "rider" ? req.user.user_id : null,
    });

    // High-priority Web Push to eligible Coordinators.
    // Failure to deliver browser push NEVER rolls back or loses the saved report.
    let pushSummary = { configured: false, attempted: 0, sent: 0, skipped: 0, deactivated: 0, failed: 0 };
    try {
      pushSummary = await sendEmergencyAlertPush(savedRow);
    } catch (pushErr) {
      console.warn("sendEmergencyAlertPush non-fatal error:", pushErr?.message || pushErr);
    }

    return res.status(201).json({
      success: true,
      message: `Emergency report ${savedRow.report_code} submitted. Coordinators have been alerted.`,
      report: formatReport(savedRow),
      pushSummary,
    });
  } catch (error) {
    console.error("createEmergencyReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit emergency report. Please try again.",
    });
  }
}

// GET /api/emergency-reports
async function listEmergencyReports(req, res) {
  try {
    await ensureEmergencySchema();
    const role = String(req.user?.role || "").toLowerCase();
    const statusFilter = String(req.query?.status || "").trim().toUpperCase();

    const where = [];
    const params = [];

    if (role !== "coordinator") {
      where.push("user_id = ?");
      params.push(req.user.user_id);
    }

    if (VALID_STATUSES.includes(statusFilter)) {
      where.push("status = ?");
      params.push(statusFilter);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT *
         FROM emergency_reports
         ${whereSql}
        ORDER BY
          CASE status
            WHEN 'NEW' THEN 0
            WHEN 'ACKNOWLEDGED' THEN 1
            WHEN 'IN_PROGRESS' THEN 2
            ELSE 3
          END,
          created_at DESC,
          report_id DESC
        LIMIT 250`,
      params
    );

    const reports = rows.map(formatReport);
    const counts = {
      all: reports.length,
      new: reports.filter((r) => r.status === "NEW").length,
      acknowledged: reports.filter((r) => r.status === "ACKNOWLEDGED" || r.status === "IN_PROGRESS").length,
      resolved: reports.filter((r) => r.status === "RESOLVED").length,
    };

    return res.json({
      success: true,
      reports,
      counts,
    });
  } catch (error) {
    console.error("listEmergencyReports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load emergency reports.",
    });
  }
}

// GET /api/emergency-reports/unreviewed-count (coordinator)
async function getUnreviewedEmergencyCount(req, res) {
  try {
    await ensureEmergencySchema();
    const [rows] = await pool.query(
      `SELECT COUNT(*)::int AS count FROM emergency_reports WHERE status = 'NEW'`
    );
    return res.json({
      success: true,
      count: Number(rows[0]?.count || 0),
    });
  } catch (error) {
    console.error("getUnreviewedEmergencyCount error:", error);
    return res.status(500).json({ success: false, count: 0 });
  }
}

// GET /api/emergency-reports/:id
async function getEmergencyReport(req, res) {
  try {
    await ensureEmergencySchema();
    const idParam = String(req.params.id || "").trim();
    const numericId = /^\d+$/.test(idParam) ? Number(idParam) : null;

    const [rows] = numericId
      ? await pool.query(`SELECT * FROM emergency_reports WHERE report_id = ? LIMIT 1`, [numericId])
      : await pool.query(`SELECT * FROM emergency_reports WHERE UPPER(report_code) = UPPER(?) LIMIT 1`, [idParam]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Emergency report not found." });
    }

    const report = rows[0];
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "coordinator" && Number(report.user_id) !== Number(req.user.user_id)) {
      return res.status(403).json({ success: false, message: "You are not authorized to view this report." });
    }

    return res.json({ success: true, report: formatReport(report) });
  } catch (error) {
    console.error("getEmergencyReport error:", error);
    return res.status(500).json({ success: false, message: "Failed to load emergency report." });
  }
}

// PATCH /api/emergency-reports/:id (coordinator only)
async function updateEmergencyReport(req, res) {
  try {
    await ensureEmergencySchema();
    const idParam = String(req.params.id || "").trim();
    const numericId = /^\d+$/.test(idParam) ? Number(idParam) : null;

    const [foundRows] = numericId
      ? await pool.query(`SELECT * FROM emergency_reports WHERE report_id = ? LIMIT 1`, [numericId])
      : await pool.query(`SELECT * FROM emergency_reports WHERE UPPER(report_code) = UPPER(?) LIMIT 1`, [idParam]);

    if (!foundRows.length) {
      return res.status(404).json({ success: false, message: "Emergency report not found." });
    }

    const existing = foundRows[0];
    const rawStatus = req.body?.status ? String(req.body.status).trim().toUpperCase() : "";
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 1000) : "";

    if (rawStatus && !VALID_STATUSES.includes(rawStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be NEW, ACKNOWLEDGED, IN_PROGRESS, or RESOLVED.",
      });
    }

    if (!rawStatus && !note) {
      return res.status(400).json({
        success: false,
        message: "Provide a status update or coordinator note.",
      });
    }

    const nextStatus = rawStatus || existing.status;
    const history = parseHistory(existing.history);

    let actionLabel = "Updated emergency report";
    if (nextStatus === "ACKNOWLEDGED" && existing.status !== "ACKNOWLEDGED") {
      actionLabel = "Acknowledged emergency report";
    } else if (nextStatus === "RESOLVED" && existing.status !== "RESOLVED") {
      actionLabel = "Resolved emergency report";
    } else if (nextStatus === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
      actionLabel = "Marked emergency report in progress";
    } else if (note && nextStatus === existing.status) {
      actionLabel = "Added coordinator update";
    }

    history.push({
      at: new Date().toISOString(),
      actor_id: req.user.user_id,
      actor_name: req.user.name || "Coordinator",
      actor_role: "coordinator",
      action: actionLabel,
      status: nextStatus,
      note: note || null,
    });

    const sets = ["status = $1", "history = $2::jsonb", "updated_at = NOW()"];
    const vals = [nextStatus, JSON.stringify(history)];
    let idx = 3;

    if (
      (nextStatus === "ACKNOWLEDGED" || nextStatus === "IN_PROGRESS" || nextStatus === "RESOLVED") &&
      !existing.acknowledged_at
    ) {
      sets.push(`acknowledged_at = NOW()`);
      sets.push(`acknowledged_by = $${idx++}`);
      vals.push(req.user.user_id);
      sets.push(`acknowledged_by_name = $${idx++}`);
      vals.push(req.user.name || "Coordinator");
    }

    if (nextStatus === "RESOLVED") {
      sets.push(`resolved_at = COALESCE(resolved_at, NOW())`);
      sets.push(`resolved_by = $${idx++}`);
      vals.push(req.user.user_id);
      sets.push(`resolved_by_name = $${idx++}`);
      vals.push(req.user.name || "Coordinator");
    }

    vals.push(existing.report_id);
    const { rows: updatedRows } = await rawPool.query(
      `UPDATE emergency_reports
          SET ${sets.join(", ")}
        WHERE report_id = $${idx}
        RETURNING *`,
      vals
    );

    const updated = updatedRows[0];

    await logAudit(req.user, {
      category: "Emergency",
      action: actionLabel,
      target: updated.report_code,
      detail: note || `Status changed to ${nextStatus}`,
      sellerId: updated.reporter_role === "seller" ? updated.user_id : null,
      riderId: updated.reporter_role === "rider" ? updated.user_id : null,
    });

    return res.json({
      success: true,
      message: `${actionLabel} (${updated.report_code}).`,
      report: formatReport(updated),
    });
  } catch (error) {
    console.error("updateEmergencyReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update emergency report.",
    });
  }
}

module.exports = {
  ensureEmergencySchema,
  createEmergencyReport,
  listEmergencyReports,
  getUnreviewedEmergencyCount,
  getEmergencyReport,
  updateEmergencyReport,
};
