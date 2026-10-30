const { pool } = require("../config/database");

// Nagsusulat sa audit_logs. HINDI ito kailanman nagpapabagsak ng request: kapag nag-error
// (hal. wala pa ang table), nagpi-print lang ng babala at nagpapatuloy ang pangunahing gawain.
//   actor   = req.user (user_id, name, role)
//   sellerId / riderId = sino ang apektado, para makita ng seller/rider ang mga nangyari sa parcel nila
async function logAudit(actor, { category, action, target = null, detail = null, sellerId = null, riderId = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs
       (actor_id, actor_name, actor_role, category, action, target, detail, seller_id, rider_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.user_id ?? null,
        actor.name || "Unknown",
        actor.role,
        category,
        action,
        target,
        detail == null ? null : String(detail).slice(0, 500),
        sellerId,
        riderId
      ]
    );
  } catch (error) {
    console.error("Audit log failed (run database/migration-v2.sql?):", error.message);
  }
}

module.exports = { logAudit };
