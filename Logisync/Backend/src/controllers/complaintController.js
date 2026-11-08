const { pool } = require("../config/database");

/**
 * GET /api/complaints
 * Coordinator: fetches all complaints.
 * Seller/Rider: fetches only their own submitted complaints.
 */
async function listComplaints(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.user_id;

    let rows;
    if (role === "coordinator") {
      const [allRows] = await pool.query(
        `SELECT complaint_id, user_id, complainant_name, complainant_role, complaint_kind,
                category, subject, description, priority, status, is_read, read_at, notes,
                created_at, updated_at
         FROM complaints
         ORDER BY created_at DESC`
      );
      rows = allRows;
    } else {
      const [userRows] = await pool.query(
        `SELECT complaint_id, user_id, complainant_name, complainant_role, complaint_kind,
                category, subject, description, priority, status, is_read, read_at, notes,
                created_at, updated_at
         FROM complaints
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );
      rows = userRows;
    }

    return res.json({
      success: true,
      complaints: Array.isArray(rows) ? rows : [],
    });
  } catch (error) {
    console.error("listComplaints error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve complaints.",
    });
  }
}

/**
 * POST /api/complaints
 * Accessible to Coordinator, Seller, and Rider.
 * Newly submitted complaints are marked is_read = FALSE.
 */
async function createComplaint(req, res) {
  try {
    const { category, subject, description, priority = "Medium", kind = "Complaint" } = req.body || {};

    if (!category || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: "Category, subject, and description are required.",
      });
    }

    const userId = req.user?.user_id || null;
    const complainantName = req.user?.name || "Anonymous";
    const complainantRole = req.user?.role || "user";

    const [result] = await pool.query(
      `INSERT INTO complaints
       (user_id, complainant_name, complainant_role, complaint_kind, category, subject, description, priority, status, is_read, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', FALSE, '[]'::jsonb)`,
      [
        userId,
        complainantName,
        complainantRole,
        kind,
        String(category).trim().slice(0, 100),
        String(subject).trim().slice(0, 255),
        String(description).trim(),
        String(priority).trim().slice(0, 20),
      ]
    );

    const newId = result.insertId;

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      complaint_id: newId,
    });
  } catch (error) {
    console.error("createComplaint error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create complaint.",
    });
  }
}

/**
 * POST /api/complaints/mark-read
 * Coordinator: Marks specific or all viewed complaints as READ in database.
 */
async function markComplaintsRead(req, res) {
  try {
    const { complaintIds } = req.body || {};

    if (Array.isArray(complaintIds) && complaintIds.length > 0) {
      // Validate numeric IDs
      const validIds = complaintIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
      if (validIds.length > 0) {
        // Build placeholders for IN clause
        const placeholders = validIds.map(() => "?").join(", ");
        await pool.query(
          `UPDATE complaints
           SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE is_read = FALSE AND complaint_id IN (${placeholders})`,
          validIds
        );
      }
    } else {
      // Mark all unread complaints as read
      await pool.query(
        `UPDATE complaints
         SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE is_read = FALSE`
      );
    }

    return res.json({
      success: true,
      message: "Complaints marked as read.",
    });
  } catch (error) {
    console.error("markComplaintsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark complaints as read.",
    });
  }
}

/**
 * PATCH /api/complaints/:id
 * Update complaint status and/or append internal notes.
 */
async function updateComplaint(req, res) {
  try {
    const complaintId = Number(req.params.id);
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid complaint ID." });
    }

    const { status, note } = req.body || {};

    const [rows] = await pool.query(
      `SELECT complaint_id, notes FROM complaints WHERE complaint_id = ?`,
      [complaintId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Complaint not found." });
    }

    let currentNotes = [];
    try {
      currentNotes = Array.isArray(rows[0].notes)
        ? rows[0].notes
        : typeof rows[0].notes === "string"
        ? JSON.parse(rows[0].notes)
        : [];
    } catch {
      currentNotes = [];
    }

    if (note && typeof note === "string" && note.trim()) {
      currentNotes.push({
        id: `cn_${Date.now()}`,
        by: req.user?.name || "Coordinator",
        role: req.user?.role || "coordinator",
        text: note.trim(),
        ts: Date.now(),
      });
    }

    const newStatus = status ? String(status).trim() : undefined;

    if (newStatus) {
      await pool.query(
        `UPDATE complaints
         SET status = ?, notes = ?::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE complaint_id = ?`,
        [newStatus, JSON.stringify(currentNotes), complaintId]
      );
    } else {
      await pool.query(
        `UPDATE complaints
         SET notes = ?::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE complaint_id = ?`,
        [JSON.stringify(currentNotes), complaintId]
      );
    }

    return res.json({
      success: true,
      message: "Complaint updated successfully.",
    });
  } catch (error) {
    console.error("updateComplaint error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update complaint.",
    });
  }
}

/**
 * GET /api/complaints/unread-count
 * Returns unread complaint count for badges.
 */
async function getUnreadCount(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM complaints WHERE is_read = FALSE`
    );
    const count = Number(rows?.[0]?.unread_count || 0);
    return res.json({ success: true, count });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    return res.json({ success: true, count: 0 });
  }
}

module.exports = {
  listComplaints,
  createComplaint,
  markComplaintsRead,
  updateComplaint,
  getUnreadCount,
};
