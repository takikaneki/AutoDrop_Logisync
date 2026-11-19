const assert = require("assert");
const crypto = require("crypto");
const http = require("http");
const jwt = require("jsonwebtoken");

function makeSubKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: crypto.randomBytes(16).toString("base64url"),
  };
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";
process.env.VAPID_SUBJECT = "mailto:test@logisync.example";

const { pool, rawPool, testConnection } = require("./src/config/database");
const { setPushClientForTesting } = require("./src/utils/webPush");

// In-memory PostgreSQL simulation for deterministic API & push unit verification
const users = [
  { user_id: 201, name: "Seller One", email: "seller1@example.com", role: "seller", verification_status: "APPROVED" },
  { user_id: 202, name: "Rider One", email: "rider1@example.com", role: "rider", verification_status: "APPROVED" },
  { user_id: 203, name: "Coordinator One", email: "coord1@example.com", role: "coordinator", verification_status: "APPROVED" },
  { user_id: 204, name: "Rider Two", email: "rider2@example.com", role: "rider", verification_status: "APPROVED" },
];
const prefsStore = new Map();
const announcementsStore = [];
const subscriptionsStore = [];
const deliveryLogsStore = [];
let nextAnnId = 1;
let nextSubId = 1;
let nextLogId = 1;

async function fakeQuery(sql, params = []) {
  const s = String(sql).trim();
  if (/SELECT user_id, name, email, role, verification_status FROM users/i.test(s)) {
    const uid = Number(params[0]);
    const u = users.find((x) => x.user_id === uid);
    return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
  }
  if (/SELECT preferences FROM user_preferences WHERE user_id/i.test(s)) {
    const uid = Number(params[0]);
    const p = prefsStore.get(uid);
    return { rows: p ? [{ preferences: p }] : [], rowCount: p ? 1 : 0 };
  }
  if (/INSERT INTO user_preferences/i.test(s)) {
    const uid = Number(params[0]);
    const incoming = JSON.parse(params[1]);
    if (s.includes("user_preferences.preferences ||")) {
      prefsStore.set(uid, { ...(prefsStore.get(uid) || {}), ...incoming });
    } else {
      prefsStore.set(uid, incoming);
    }
    return { rows: [{ user_id: uid, preferences: prefsStore.get(uid) }], rowCount: 1 };
  }
  if (/INSERT INTO push_subscriptions/i.test(s)) {
    const [user_id, endpoint, p256dh, auth, user_agent] = params;
    let existing = subscriptionsStore.find((x) => x.endpoint === endpoint);
    if (existing) {
      Object.assign(existing, { user_id, p256dh, auth, user_agent, is_active: true, last_error: null, updated_at: new Date().toISOString() });
    } else {
      existing = {
        subscription_id: nextSubId++,
        user_id: Number(user_id),
        endpoint,
        p256dh,
        auth,
        user_agent,
        is_active: true,
        last_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      subscriptionsStore.push(existing);
    }
    return { rows: [existing], rowCount: 1 };
  }
  if (/SELECT subscription_id, endpoint, created_at, updated_at\s+FROM push_subscriptions/i.test(s)) {
    const uid = Number(params[0]);
    const rows = subscriptionsStore.filter((x) => x.user_id === uid && x.is_active);
    return { rows, rowCount: rows.length };
  }
  if (/SELECT COUNT\(\*\)::int AS cnt FROM push_subscriptions/i.test(s)) {
    const uid = Number(params[0]);
    const cnt = subscriptionsStore.filter((x) => x.user_id === uid && x.is_active).length;
    return { rows: [{ cnt }], rowCount: 1 };
  }
  if (/UPDATE push_subscriptions\s+SET is_active = FALSE, updated_at/i.test(s)) {
    const uid = Number(params[0]);
    const endpoint = params[1];
    let count = 0;
    for (const sub of subscriptionsStore) {
      if (sub.user_id === uid && (!endpoint || sub.endpoint === endpoint)) {
        sub.is_active = false;
        count++;
      }
    }
    return { rows: [], rowCount: count };
  }
  if (/UPDATE push_subscriptions\s+SET is_active = FALSE, last_error/i.test(s)) {
    const [last_error, subscription_id] = params;
    const sub = subscriptionsStore.find((x) => x.subscription_id === Number(subscription_id));
    if (sub) {
      sub.is_active = false;
      sub.last_error = last_error;
    }
    return { rows: [], rowCount: sub ? 1 : 0 };
  }
  if (/INSERT INTO hub_announcements/i.test(s)) {
    const [client_id, coordinator_id, coordinator_name, title, message, to_riders, to_sellers] = params;
    const row = {
      announcement_id: nextAnnId++,
      client_id,
      coordinator_id,
      coordinator_name,
      title,
      message,
      to_riders: Boolean(to_riders),
      to_sellers: Boolean(to_sellers),
      created_at: new Date().toISOString(),
    };
    announcementsStore.unshift(row);
    return { rows: [row], rowCount: 1 };
  }
  if (/FROM hub_announcements WHERE client_id/i.test(s)) {
    const row = announcementsStore.find((a) => a.client_id === params[0]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }
  if (/FROM hub_announcements/i.test(s)) {
    let rows = [...announcementsStore];
    if (s.includes("WHERE to_riders = TRUE")) rows = rows.filter((a) => a.to_riders);
    else if (s.includes("WHERE to_sellers = TRUE")) rows = rows.filter((a) => a.to_sellers);
    return { rows, rowCount: rows.length };
  }
  if (/FROM push_subscriptions ps/i.test(s)) {
    const targetRoles = params[0] || [];
    const rows = subscriptionsStore
      .filter((ps) => ps.is_active)
      .map((ps) => {
        const u = users.find((x) => x.user_id === ps.user_id);
        return {
          ...ps,
          role: u?.role,
          verification_status: u?.verification_status,
          preferences: prefsStore.get(ps.user_id) || null,
        };
      })
      .filter((r) => targetRoles.includes(String(r.role).toLowerCase()) && r.verification_status !== "REJECTED");
    return { rows, rowCount: rows.length };
  }
  if (/INSERT INTO push_delivery_logs/i.test(s)) {
    const [announcement_id, subscription_id, user_id] = params;
    const dup = deliveryLogsStore.find(
      (d) => d.announcement_id === Number(announcement_id) && d.subscription_id === Number(subscription_id)
    );
    if (dup) return { rows: [], rowCount: 0 };
    const row = {
      delivery_id: nextLogId++,
      announcement_id: Number(announcement_id),
      subscription_id: Number(subscription_id),
      user_id: Number(user_id),
      status: "PENDING",
    };
    deliveryLogsStore.push(row);
    return { rows: [row], rowCount: 1 };
  }
  if (/UPDATE push_delivery_logs SET status/i.test(s)) {
    const match = s.match(/status = '([A-Z]+)'/);
    const row = deliveryLogsStore.find((d) => d.delivery_id === Number(params[0]));
    if (row && match) row.status = match[1];
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  return { rows: [], rowCount: 0 };
}

rawPool.query = fakeQuery;
pool.query = async (sql, params) => {
  const res = await fakeQuery(sql, params);
  return [res.rows, { rowCount: res.rowCount, insertId: res.rows[0]?.announcement_id || null }];
};

// Stub real testConnection/ensureSchema so routes don't wait on TCP socket inside mocked test
const dbMod = require("./src/config/database");
dbMod.ensureSchema = async () => {};

const app = require("./src/app");

function tokenFor(u) {
  return jwt.sign({ user_id: u.user_id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function req(server, method, path, token, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  const webpushMod = await import("web-push");
  const webpush = webpushMod.default || webpushMod;
  const testKeys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = testKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = testKeys.privateKey;

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const sellerToken = tokenFor(users[0]);
    const riderToken = tokenFor(users[1]);
    const coordToken = tokenFor(users[2]);
    const rider2Token = tokenFor(users[3]);

    // 1. Public VAPID key check (must never expose private key)
    const vapidRes = await req(server, "GET", "/api/notifications/push/vapid-public-key", sellerToken);
    assert.strictEqual(vapidRes.status, 200);
    assert.strictEqual(vapidRes.data.configured, true);
    assert.strictEqual(vapidRes.data.publicKey, testKeys.publicKey);
    assert.ok(!JSON.stringify(vapidRes.data).includes(testKeys.privateKey), "VAPID private key leaked!");

    // 2. Per-user preference persistence across portals & simulated re-login
    const putSeller = await req(server, "PUT", "/api/notifications/preferences", sellerToken, {
      preferences: { soundMessages: false, inAppNotifications: false, fontSize: "lg" },
    });
    assert.strictEqual(putSeller.status, 200);
    assert.strictEqual(putSeller.data.preferences.soundMessages, false);
    assert.strictEqual(putSeller.data.preferences.fontSize, "lg");

    const getRider = await req(server, "GET", "/api/notifications/preferences", riderToken);
    assert.strictEqual(getRider.data.preferences.soundMessages, true, "Rider prefs should stay isolated from Seller");

    // 3. Push subscription creation & validation
    const badSub = await req(server, "POST", "/api/notifications/push/subscribe", riderToken, { endpoint: "invalid" });
    assert.strictEqual(badSub.status, 400);

    const riderSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/rider-1-endpoint",
      keys: makeSubKeys(),
    };
    const subRes = await req(server, "POST", "/api/notifications/push/subscribe", riderToken, { subscription: riderSub });
    assert.strictEqual(subRes.status, 201);
    assert.strictEqual(subRes.data.subscribed, true);

    const sellerSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/seller-1-endpoint",
      keys: makeSubKeys(),
    };
    await req(server, "POST", "/api/notifications/push/subscribe", sellerToken, { subscription: sellerSub });

    // Rider 2 subscribed, but has expired endpoint to test 410 deactivation
    const rider2Sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/rider-2-expired",
      keys: makeSubKeys(),
    };
    await req(server, "POST", "/api/notifications/push/subscribe", rider2Token, { subscription: rider2Sub });

    // Rider 1 disables Sound & Popup but KEEPS Browser Push ON (verify independence!)
    await req(server, "PUT", "/api/notifications/preferences", riderToken, {
      preferences: { soundAnnouncements: false, sound: false, inAppPopups: false, browserPushEnabled: true },
    });

    // 4. Role permission check: Seller/Rider CANNOT create Hub Announcements
    const forbidSeller = await req(server, "POST", "/api/announcements", sellerToken, {
      title: "Fake",
      message: "Nope",
      toSellers: true,
    });
    assert.strictEqual(forbidSeller.status, 403);

    // 5. Coordinator creates Hub Announcement targeted ONLY to Riders (not Sellers)
    const sentNotifications = [];
    setPushClientForTesting({
      setVapidDetails: () => {},
      sendNotification: async (subscription, payloadStr) => {
        // Verify real web-push ECDH + VAPID cryptographic encryption succeeds
        const encrypted = webpush.generateRequestDetails(subscription, payloadStr, {
          vapidDetails: {
            subject: process.env.VAPID_SUBJECT,
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY,
          },
        });
        assert.ok(encrypted.headers.Authorization && encrypted.body?.length > 0);
        const payload = JSON.parse(payloadStr);
        if (subscription.endpoint.includes("expired")) {
          const err = new Error("Gone");
          err.statusCode = 410;
          throw err;
        }
        sentNotifications.push({ endpoint: subscription.endpoint, payload });
      },
    });

    const annRes = await req(server, "POST", "/api/announcements", coordToken, {
      title: "Weather Advisory",
      message: "Heavy rain in Cavite hub",
      toRiders: true,
      toSellers: false,
      clientId: "ann-test-1",
    });
    assert.strictEqual(annRes.status, 201);
    assert.strictEqual(annRes.data.pushSummary.sent, 1, "Only Rider 1 should receive push");
    assert.strictEqual(annRes.data.pushSummary.deactivated, 1, "Expired Rider 2 sub should be deactivated");
    assert.strictEqual(sentNotifications.length, 1);
    assert.strictEqual(sentNotifications[0].endpoint, riderSub.endpoint);
    assert.strictEqual(sentNotifications[0].payload.type, "hub_announcement");
    assert.strictEqual(sentNotifications[0].payload.body, "Weather Advisory");
    assert.strictEqual(sentNotifications[0].payload.url, "/rider/notifications", "Rider deep-link URL should match role");

    // Verify duplicate prevention on same clientId / announcement
    const dupRes = await req(server, "POST", "/api/announcements", coordToken, {
      title: "Weather Advisory",
      message: "Heavy rain in Cavite hub",
      toRiders: true,
      toSellers: false,
      clientId: "ann-test-1",
    });
    assert.strictEqual(dupRes.status, 200);
    assert.strictEqual(dupRes.data.duplicate, true);
    assert.strictEqual(dupRes.data.pushSummary.sent, 0, "Duplicate push must be prevented");
    assert.strictEqual(sentNotifications.length, 1);

    // 6. Role-based announcement visibility on GET /api/announcements
    const sellerFeed = await req(server, "GET", "/api/announcements", sellerToken);
    assert.strictEqual(sellerFeed.data.announcements.length, 0, "Seller must not see Rider-only announcements");
    const riderFeed = await req(server, "GET", "/api/announcements", riderToken);
    assert.strictEqual(riderFeed.data.announcements.length, 1, "Rider must see Rider-targeted announcement");

    // 7. Unsubscribe / disable browser push prevents future rider announcements while Seller remains subscribed
    const unsubRes = await req(server, "POST", "/api/notifications/push/unsubscribe", riderToken, { endpoint: riderSub.endpoint });
    assert.strictEqual(unsubRes.status, 200);
    assert.strictEqual(unsubRes.data.subscribed, false);

    const annRiders2 = await req(server, "POST", "/api/announcements", coordToken, {
      title: "Next Rider Notice",
      message: "Updated dispatch window",
      toRiders: true,
      toSellers: false,
    });
    assert.strictEqual(annRiders2.data.pushSummary.sent, 0, "Unsubscribed rider and expired rider sub must receive 0 pushes");

    const annSellers = await req(server, "POST", "/api/announcements", coordToken, {
      title: "Seller Advisory",
      message: "New hub dropoff cutoff",
      toRiders: false,
      toSellers: true,
    });
    assert.strictEqual(annSellers.data.pushSummary.sent, 1, "Subscribed Seller should receive Seller-targeted announcement");
    assert.strictEqual(sentNotifications[1].endpoint, sellerSub.endpoint);
    assert.strictEqual(sentNotifications[1].payload.url, "/seller/notifications");

    console.log("PASS: All Backend notifications, preferences, role visibility, and Web Push tests passed!");
  } finally {
    server.close();
  }
})();
