const { pool, rawPool, ensureSchema } = require("../config/database");
const { logAudit } = require("../utils/audit");
const { getPublicVapidConfig, sendAnnouncementPush } = require("../utils/webPush");

const DEFAULT_PREFERENCES = {
  dark: false,
  themeMode: "light",
  fontSize: "md",
  notificationsEnabled: true,
  inAppNotifications: true,
  inAppPopups: true,
  browserPushEnabled: false,
  notifyParcel: true,
  notifyVerification: true,
  notifyMessages: true,
  notifyAnnouncements: true,
  sound: true,
  soundVolume: 80,
  soundMessages: true,
  soundAnnouncements: true,
};

let schemaEnsured = false;
async function guaranteeSchema() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

function sanitizePreferencesPatch(raw = {}) {
  const out = {};
  const boolKeys = [
    "dark",
    "notificationsEnabled",
    "inAppNotifications",
    "inAppPopups",
    "browserPushEnabled",
    "notifyParcel",
    "notifyVerification",
    "notifyMessages",
    "notifyAnnouncements",
    "sound",
    "soundMessages",
    "soundAnnouncements",
  ];
  for (const k of boolKeys) {
    if (typeof raw[k] === "boolean") out[k] = raw[k];
  }
  if (["light", "dark", "system"].includes(raw.themeMode)) {
    out.themeMode = raw.themeMode;
  }
  if (["sm", "md", "lg"].includes(raw.fontSize)) {
    out.fontSize = raw.fontSize;
  }
  if (typeof raw.soundVolume === "number" && Number.isFinite(raw.soundVolume)) {
    out.soundVolume = Math.max(0, Math.min(100, Math.round(raw.soundVolume)));
  }
  return out;
}

async function getPreferences(req, res) {
  try {
    await guaranteeSchema();
    const userId = Number(req.user.user_id);
    const [rows] = await pool.query(
      "SELECT preferences FROM user_preferences WHERE user_id = ?",
      [userId]
    );
    const saved = rows[0]?.preferences && typeof rows[0].preferences === "object" ? rows[0].preferences : {};
    return res.json({
      success: true,
      preferences: { ...DEFAULT_PREFERENCES, ...saved },
    });
  } catch (error) {
    console.error("getPreferences error:", error);
    return res.status(500).json({ success: false, message: "Failed to load preferences." });
  }
}

async function updatePreferences(req, res) {
  try {
    await guaranteeSchema();
    const userId = Number(req.user.user_id);
    const patch = sanitizePreferencesPatch(req.body?.preferences || req.body || {});

    const [existingRows] = await pool.query(
      "SELECT preferences FROM user_preferences WHERE user_id = ?",
      [userId]
    );
    const existing =
      existingRows[0]?.preferences && typeof existingRows[0].preferences === "object"
        ? existingRows[0].preferences
        : {};
    const merged = { ...DEFAULT_PREFERENCES, ...existing, ...patch };

    await rawPool.query(
      `INSERT INTO user_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
         SET preferences = $2::jsonb,
             updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(merged)]
    );

    return res.json({
      success: true,
      preferences: merged,
    });
  } catch (error) {
    console.error("updatePreferences error:", error);
    return res.status(500).json({ success: false, message: "Failed to save preferences." });
  }
}

async function getVapidPublicKey(_req, res) {
  const config = getPublicVapidConfig();
  return res.json({
    success: true,
    configured: config.configured,
    publicKey: config.publicKey,
  });
}

async function getPushStatus(req, res) {
  try {
    await guaranteeSchema();
    const userId = Number(req.user.user_id);
    const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint.trim() : "";

    const [rows] = await pool.query(
      `SELECT subscription_id, endpoint, created_at, updated_at
       FROM push_subscriptions
       WHERE user_id = ? AND is_active = TRUE
       ORDER BY updated_at DESC`,
      [userId]
    );

    const endpointActive = endpoint ? rows.some((r) => r.endpoint === endpoint) : rows.length > 0;
    return res.json({
      success: true,
      configured: getPublicVapidConfig().configured,
      subscribed: endpointActive,
      subscriptionCount: rows.length,
    });
  } catch (error) {
    console.error("getPushStatus error:", error);
    return res.status(500).json({ success: false, message: "Failed to check push status." });
  }
}

async function subscribePush(req, res) {
  try {
    await guaranteeSchema();
    const userId = Number(req.user.user_id);
    const subscription = req.body?.subscription || req.body || {};
    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
    const p256dh = typeof subscription.keys?.p256dh === "string" ? subscription.keys.p256dh.trim() : "";
    const auth = typeof subscription.keys?.auth === "string" ? subscription.keys.auth.trim() : "";

    if (!endpoint || !/^https?:\/\//i.test(endpoint) || !p256dh || !auth) {
      return res.status(400).json({
        success: false,
        message: "Valid push subscription endpoint and encryption keys are required.",
      });
    }

    const userAgent = String(req.headers["user-agent"] || "").slice(0, 250) || null;

    await rawPool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, is_active, last_error, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent,
             is_active = TRUE,
             last_error = NULL,
             updated_at = CURRENT_TIMESTAMP`,
      [userId, endpoint, p256dh, auth, userAgent]
    );

    await rawPool.query(
      `INSERT INTO user_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
         SET preferences = user_preferences.preferences || $2::jsonb,
             updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify({ browserPushEnabled: true })]
    );

    return res.status(201).json({
      success: true,
      subscribed: true,
      message: "Browser push subscription saved.",
    });
  } catch (error) {
    console.error("subscribePush error:", error);
    return res.status(500).json({ success: false, message: "Failed to save push subscription." });
  }
}

async function unsubscribePush(req, res) {
  try {
    await guaranteeSchema();
    const userId = Number(req.user.user_id);
    const endpoint = typeof (req.body?.endpoint || req.query?.endpoint) === "string"
      ? String(req.body?.endpoint || req.query?.endpoint).trim()
      : "";

    if (endpoint) {
      await pool.query(
        `UPDATE push_subscriptions
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND endpoint = ?`,
        [userId, endpoint]
      );
    } else {
      await pool.query(
        `UPDATE push_subscriptions
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?`,
        [userId]
      );
    }

    const [remaining] = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM push_subscriptions WHERE user_id = ? AND is_active = TRUE`,
      [userId]
    );
    const hasRemaining = Number(remaining[0]?.cnt || 0) > 0;
    const disableInPrefs = !endpoint || !hasRemaining;

    if (disableInPrefs) {
      await rawPool.query(
        `INSERT INTO user_preferences (user_id, preferences, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
           SET preferences = user_preferences.preferences || $2::jsonb,
               updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify({ browserPushEnabled: false })]
      );
    }

    return res.json({
      success: true,
      subscribed: hasRemaining,
      message: "Browser push notifications disabled.",
    });
  } catch (error) {
    console.error("unsubscribePush error:", error);
    return res.status(500).json({ success: false, message: "Failed to unsubscribe from browser push." });
  }
}

async function listAnnouncements(req, res) {
  try {
    await guaranteeSchema();
    const role = String(req.user?.role || "").toLowerCase();

    let query = `
      SELECT announcement_id, client_id, coordinator_id, coordinator_name, title, message, to_riders, to_sellers, created_at
      FROM hub_announcements
    `;
    if (role === "rider") {
      query += " WHERE to_riders = TRUE";
    } else if (role === "seller") {
      query += " WHERE to_sellers = TRUE";
    }
    query += " ORDER BY created_at DESC, announcement_id DESC LIMIT 100";

    const [rows] = await pool.query(query);
    return res.json({
      success: true,
      announcements: rows.map((r) => ({
        id: r.client_id || `an-db-${r.announcement_id}`,
        announcementId: r.announcement_id,
        title: r.title,
        message: r.message,
        toRiders: Boolean(r.to_riders),
        toSellers: Boolean(r.to_sellers),
        coordinatorName: r.coordinator_name,
        ts: new Date(r.created_at).getTime() || Date.now(),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error("listAnnouncements error:", error);
    return res.status(500).json({ success: false, message: "Failed to load announcements." });
  }
}

async function createAnnouncement(req, res) {
  try {
    await guaranteeSchema();
    const title = String(req.body?.title || "").trim() || "Delivery Announcement";
    const message = String(req.body?.message || "").trim();
    const toRiders = req.body?.toRiders !== undefined ? Boolean(req.body.toRiders) : Boolean(req.body?.to_riders);
    const toSellers = req.body?.toSellers !== undefined ? Boolean(req.body.toSellers) : Boolean(req.body?.to_sellers);
    const clientId = req.body?.clientId ? String(req.body.clientId).trim().slice(0, 80) : null;

    if (!message) {
      return res.status(400).json({ success: false, message: "Announcement message is required." });
    }
    if (!toRiders && !toSellers) {
      return res.status(400).json({ success: false, message: "Select at least one recipient role (Riders or Sellers)." });
    }

    let row = null;
    let isDuplicate = false;

    if (clientId) {
      const [existing] = await pool.query(
        `SELECT announcement_id, client_id, coordinator_id, coordinator_name, title, message, to_riders, to_sellers, created_at
         FROM hub_announcements WHERE client_id = ?`,
        [clientId]
      );
      if (existing.length) {
        row = existing[0];
        isDuplicate = true;
      }
    }

    if (!row) {
      const [inserted] = await pool.query(
        `INSERT INTO hub_announcements (client_id, coordinator_id, coordinator_name, title, message, to_riders, to_sellers)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          req.user.user_id,
          req.user.name || "Coordinator",
          title.slice(0, 200),
          message,
          toRiders,
          toSellers,
        ]
      );
      row = inserted[0];
      await logAudit(req.user, {
        category: "Announcements",
        action: "Sent announcement",
        target: [toRiders && "Riders", toSellers && "Sellers"].filter(Boolean).join(" & "),
        detail: title.slice(0, 200),
      });
    }

    const pushSummary = await sendAnnouncementPush(row);

    return res.status(isDuplicate ? 200 : 201).json({
      success: true,
      duplicate: isDuplicate,
      announcement: {
        id: row.client_id || `an-db-${row.announcement_id}`,
        announcementId: row.announcement_id,
        title: row.title,
        message: row.message,
        toRiders: Boolean(row.to_riders),
        toSellers: Boolean(row.to_sellers),
        coordinatorName: row.coordinator_name,
        ts: new Date(row.created_at).getTime() || Date.now(),
        createdAt: row.created_at,
      },
      pushSummary,
    });
  } catch (error) {
    console.error("createAnnouncement error:", error);
    return res.status(500).json({ success: false, message: "Failed to publish announcement." });
  }
}

module.exports = {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences,
  getVapidPublicKey,
  getPushStatus,
  subscribePush,
  unsubscribePush,
  listAnnouncements,
  createAnnouncement,
};
