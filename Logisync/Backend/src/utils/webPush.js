const { pool, rawPool } = require("../config/database");

let webpushPromise = null;
let overridePushClient = null;
let vapidConfigured = false;

function setPushClientForTesting(client) {
  overridePushClient = client || null;
}

async function resolvePushClient(explicitClient) {
  if (explicitClient) return explicitClient;
  if (overridePushClient) return overridePushClient;
  if (!webpushPromise) {
    webpushPromise = import("web-push").then((mod) =>
      mod.default && typeof mod.default.sendNotification === "function" ? mod.default : mod
    );
  }
  return webpushPromise;
}

async function ensureVapidConfigured(client) {
  const targetClient = client || (await resolvePushClient());
  const subject = process.env.VAPID_SUBJECT || "mailto:no-reply@logisync.example";
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();

  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }

  if (!vapidConfigured || overridePushClient || (client && client !== targetClient)) {
    targetClient.setVapidDetails(subject, publicKey, privateKey);
    if (!overridePushClient) vapidConfigured = true;
  }
  return true;
}

function getPublicVapidConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const configured = Boolean(publicKey && privateKey);
  return {
    configured,
    publicKey: configured ? publicKey : null,
  };
}

function portalUrlForRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "seller") return "/seller/notifications";
  if (r === "rider") return "/rider/notifications";
  return "/notifications";
}

function buildAnnouncementPushPayload(announcement, role) {
  const headline = String(announcement?.title || "Hub Announcement").trim().slice(0, 100);
  // Do not include sensitive customer or parcel details in OS push previews.
  return JSON.stringify({
    type: "hub_announcement",
    category: "announcements",
    announcementId: announcement.announcement_id,
    title: "LogiSync Hub Announcement",
    body: headline || "A new coordinator announcement has been posted.",
    url: portalUrlForRole(role),
    ts: Date.now(),
  });
}

/**
 * Sends Web Push notifications strictly for Coordinator Hub Announcements.
 * Respects role-based visibility (to_riders / to_sellers), user notification
 * preferences, duplicate prevention, and deactivates 404/410 expired endpoints.
 */
async function sendAnnouncementPush(announcement, { pushClient = null, skipVapidInit = false } = {}) {
  const summary = {
    configured: true,
    attempted: 0,
    sent: 0,
    skipped: 0,
    deactivated: 0,
    failed: 0,
  };

  if (!announcement || !announcement.announcement_id) {
    return summary;
  }

  const client = await resolvePushClient(pushClient);

  if (!skipVapidInit && !(await ensureVapidConfigured(client))) {
    summary.configured = false;
    return summary;
  }

  const targetRoles = [];
  if (announcement.to_riders) targetRoles.push("rider");
  if (announcement.to_sellers) targetRoles.push("seller");
  if (targetRoles.length === 0) {
    return summary;
  }

  const { rows: subscriptions } = await rawPool.query(
    `SELECT
       ps.subscription_id,
       ps.user_id,
       ps.endpoint,
       ps.p256dh,
       ps.auth,
       u.role,
       u.verification_status,
       up.preferences
     FROM push_subscriptions ps
     JOIN users u ON u.user_id = ps.user_id
     LEFT JOIN user_preferences up ON up.user_id = ps.user_id
     WHERE ps.is_active = TRUE
       AND LOWER(u.role) = ANY($1::text[])
       AND COALESCE(UPPER(u.verification_status), 'APPROVED') <> 'REJECTED'`,
    [targetRoles]
  );

  const seenEndpoints = new Set();

  for (const sub of subscriptions) {
    if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) {
      summary.skipped += 1;
      continue;
    }
    seenEndpoints.add(sub.endpoint);

    const prefs = sub.preferences && typeof sub.preferences === "object" ? sub.preferences : {};
    // Respect Master toggle, Hub Announcements category toggle, and Browser Push opt-in.
    // Sound preferences remain completely independent of Browser Push delivery.
    if (
      prefs.notificationsEnabled === false ||
      prefs.notifyAnnouncements === false ||
      prefs.browserPushEnabled === false
    ) {
      summary.skipped += 1;
      continue;
    }

    // Atomic duplicate guard per (announcement_id, subscription_id)
    const [insertRes] = await pool.query(
      `INSERT INTO push_delivery_logs (announcement_id, subscription_id, user_id, status)
       VALUES (?, ?, ?, 'PENDING')
       ON CONFLICT (announcement_id, subscription_id) DO NOTHING`,
      [announcement.announcement_id, sub.subscription_id, sub.user_id]
    );

    if (!insertRes.length) {
      summary.skipped += 1;
      continue;
    }

    const deliveryId = insertRes[0].delivery_id;
    summary.attempted += 1;

    try {
      await client.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        buildAnnouncementPushPayload(announcement, sub.role),
        { timeout: 5000 }
      );

      await pool.query(
        `UPDATE push_delivery_logs SET status = 'SENT' WHERE delivery_id = ?`,
        [deliveryId]
      );
      summary.sent += 1;
    } catch (err) {
      const code = Number(err?.statusCode || 0);
      const errMsg = String(err?.message || "Push delivery error").slice(0, 240);

      if (code === 404 || code === 410) {
        await pool.query(
          `UPDATE push_subscriptions
             SET is_active = FALSE, last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE subscription_id = ?`,
          [errMsg, sub.subscription_id]
        );
        await pool.query(
          `UPDATE push_delivery_logs SET status = 'EXPIRED' WHERE delivery_id = ?`,
          [deliveryId]
        );
        summary.deactivated += 1;
      } else {
        await pool.query(
          `UPDATE push_subscriptions
             SET last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE subscription_id = ?`,
          [errMsg, sub.subscription_id]
        );
        await pool.query(
          `UPDATE push_delivery_logs SET status = 'FAILED' WHERE delivery_id = ?`,
          [deliveryId]
        );
        summary.failed += 1;
      }
    }
  }

  return summary;
}

function buildEmergencyAlertPushPayload(report) {
  const roleLabel =
    String(report?.reporter_role || "").toLowerCase() === "seller" ? "Seller" : "Rider";
  const category = String(report?.category || "Emergency").trim().slice(0, 60);
  const reportCode = String(report?.report_code || `EMR-${report?.report_id || ""}`).trim();

  // Privacy-safe preview: exclude full address, personal phone/contact, and detailed private description.
  const body = `New ${roleLabel} emergency (${reportCode}) — ${category}. Open LOGISYNC to review immediately.`;

  return JSON.stringify({
    type: "emergency_alert",
    category: "emergency",
    priority: "high",
    reportId: report.report_id,
    reportCode,
    title: `EMERGENCY ALERT · ${reportCode}`,
    body,
    url: `/emergency-reports?report=${encodeURIComponent(reportCode)}`,
    ts: Date.now(),
  });
}

/**
 * Sends high-priority desktop Browser Push notifications to eligible Coordinator accounts
 * when a Seller or Rider submits an Emergency Report.
 * - Does NOT suppress alerts when ordinary notification categories are disabled.
 * - Respects browser push subscription status, prevents duplicate delivery per subscription,
 *   and deactivates expired/invalid (404/410) subscriptions.
 */
async function sendEmergencyAlertPush(report, { pushClient = null, skipVapidInit = false } = {}) {
  const summary = {
    configured: true,
    attempted: 0,
    sent: 0,
    skipped: 0,
    deactivated: 0,
    failed: 0,
  };

  if (!report || !report.report_id) {
    return summary;
  }

  const client = await resolvePushClient(pushClient);

  if (!skipVapidInit && !(await ensureVapidConfigured(client))) {
    summary.configured = false;
    return summary;
  }

  const { rows: subscriptions } = await rawPool.query(
    `SELECT
       ps.subscription_id,
       ps.user_id,
       ps.endpoint,
       ps.p256dh,
       ps.auth,
       u.role,
       u.verification_status,
       up.preferences
     FROM push_subscriptions ps
     JOIN users u ON u.user_id = ps.user_id
     LEFT JOIN user_preferences up ON up.user_id = ps.user_id
     WHERE ps.is_active = TRUE
       AND LOWER(u.role) = 'coordinator'
       AND COALESCE(u.is_deleted, FALSE) = FALSE
       AND COALESCE(UPPER(u.verification_status), 'APPROVED') <> 'REJECTED'`
  );

  const seenEndpoints = new Set();
  const payload = buildEmergencyAlertPushPayload(report);

  for (const sub of subscriptions) {
    if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) {
      summary.skipped += 1;
      continue;
    }
    seenEndpoints.add(sub.endpoint);

    const prefs = sub.preferences && typeof sub.preferences === "object" ? sub.preferences : {};
    // High-priority Emergency Alerts are NEVER suppressed by ordinary category toggles
    // (notifyParcel, notifyVerification, notifyMessages, notifyAnnouncements).
    // Only honor explicit Browser Push opt-out.
    if (prefs.browserPushEnabled === false) {
      summary.skipped += 1;
      continue;
    }

    // Atomic duplicate guard per (report_id, subscription_id)
    const [insertRes] = await pool.query(
      `INSERT INTO emergency_push_delivery_logs (report_id, subscription_id, user_id, status)
       VALUES (?, ?, ?, 'PENDING')
       ON CONFLICT (report_id, subscription_id) DO NOTHING`,
      [report.report_id, sub.subscription_id, sub.user_id]
    );

    if (!insertRes.length) {
      summary.skipped += 1;
      continue;
    }

    const deliveryId = insertRes[0].delivery_id;
    summary.attempted += 1;

    try {
      await client.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
        { timeout: 5000, urgency: "high" }
      );

      await pool.query(
        `UPDATE emergency_push_delivery_logs SET status = 'SENT' WHERE delivery_id = ?`,
        [deliveryId]
      );
      summary.sent += 1;
    } catch (err) {
      const code = Number(err?.statusCode || 0);
      const errMsg = String(err?.message || "Push delivery error").slice(0, 240);

      if (code === 404 || code === 410) {
        await pool.query(
          `UPDATE push_subscriptions
              SET is_active = FALSE, last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ?`,
          [errMsg, sub.subscription_id]
        );
        await pool.query(
          `UPDATE emergency_push_delivery_logs SET status = 'EXPIRED' WHERE delivery_id = ?`,
          [deliveryId]
        );
        summary.deactivated += 1;
      } else {
        await pool.query(
          `UPDATE push_subscriptions
              SET last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ?`,
          [errMsg, sub.subscription_id]
        );
        await pool.query(
          `UPDATE emergency_push_delivery_logs SET status = 'FAILED' WHERE delivery_id = ?`,
          [deliveryId]
        );
        summary.failed += 1;
      }
    }
  }

  return summary;
}

module.exports = {
  ensureVapidConfigured,
  getPublicVapidConfig,
  buildAnnouncementPushPayload,
  sendAnnouncementPush,
  buildEmergencyAlertPushPayload,
  sendEmergencyAlertPush,
  setPushClientForTesting,
};
