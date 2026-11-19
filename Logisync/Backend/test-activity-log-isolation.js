const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

const users = [
  { user_id: 11, name: "Coord One", email: "c1@example.com", role: "coordinator", verification_status: "APPROVED" },
  { user_id: 12, name: "Coord Two", email: "c2@example.com", role: "coordinator", verification_status: "APPROVED" },
  { user_id: 21, name: "Seller One", email: "s1@example.com", role: "seller", verification_status: "APPROVED" },
  { user_id: 22, name: "Seller Two", email: "s2@example.com", role: "seller", verification_status: "APPROVED" },
  { user_id: 31, name: "Rider One", email: "r1@example.com", role: "rider", verification_status: "APPROVED" },
  { user_id: 32, name: "Rider Two", email: "r2@example.com", role: "rider", verification_status: "APPROVED" },
];

const auditLogs = [
  { log_id: 1, actor_id: 11, actor_name: "Coord One", actor_role: "coordinator", category: "Verification", action: "Verified parcel", target: "P1", detail: "Coord1 check", seller_id: 21, rider_id: 31, created_at: "2026-11-19T01:00:00Z" },
  { log_id: 2, actor_id: 12, actor_name: "Coord Two", actor_role: "coordinator", category: "Accounts", action: "Created account", target: "s2@example.com", detail: "Coord2 check", seller_id: 22, rider_id: null, created_at: "2026-11-19T02:00:00Z" },
  { log_id: 3, actor_id: 21, actor_name: "Seller One", actor_role: "seller", category: "Parcels", action: "Registered parcel", target: "P1", detail: "Seller1 parcel", seller_id: 21, rider_id: null, created_at: "2026-11-19T03:00:00Z" },
  { log_id: 4, actor_id: 22, actor_name: "Seller Two", actor_role: "seller", category: "Parcels", action: "Registered parcel", target: "P2", detail: "Seller2 parcel", seller_id: 22, rider_id: null, created_at: "2026-11-19T04:00:00Z" },
  { log_id: 5, actor_id: 31, actor_name: "Rider One", actor_role: "rider", category: "Delivery", action: "Delivered parcel", target: "P1", detail: "Rider1 dropoff", seller_id: 21, rider_id: 31, created_at: "2026-11-19T05:00:00Z" },
  { log_id: 6, actor_id: 32, actor_name: "Rider Two", actor_role: "rider", category: "Delivery", action: "Failed delivery", target: "P2", detail: "Rider2 attempt", seller_id: 22, rider_id: 32, created_at: "2026-11-19T06:00:00Z" },
  { log_id: 7, actor_id: null, actor_name: "Legacy", actor_role: "coordinator", category: "System", action: "Legacy import", target: "OLD", detail: "No actor_id", seller_id: 21, rider_id: 31, created_at: "2026-11-01T00:00:00Z" },
];
let nextLogId = 8;

const dbMod = require("./src/config/database");
dbMod.ensureSchema = async () => {};
dbMod.pool.query = async (sql, params = []) => {
  const s = String(sql).trim();
  if (/SELECT user_id, name, email, role, verification_status FROM users/i.test(s)) {
    const u = users.find((x) => x.user_id === Number(params[0]));
    return [u ? [u] : [], { rowCount: u ? 1 : 0 }];
  }
  if (/INSERT INTO audit_logs/i.test(s)) {
    const [actor_id, actor_name, actor_role, category, action, target, detail, seller_id, rider_id] = params;
    const row = {
      log_id: nextLogId++,
      actor_id,
      actor_name,
      actor_role,
      category,
      action,
      target,
      detail,
      seller_id,
      rider_id,
      created_at: new Date().toISOString(),
    };
    auditLogs.push(row);
    return [[row], { rowCount: 1, insertId: row.log_id }];
  }
  if (/FROM audit_logs/i.test(s)) {
    // Expect strict actor_id = ? as first parameter
    const actorId = Number(params[0]);
    let rows = auditLogs.filter((l) => l.actor_id !== null && Number(l.actor_id) === actorId);
    let idx = 1;
    if (s.includes("category = ?")) {
      const cat = params[idx++];
      rows = rows.filter((l) => l.category === cat);
    }
    if (s.includes("LOWER(action) LIKE LOWER(?)")) {
      const q = String(params[idx]).replace(/^%|%$/g, "").toLowerCase();
      idx += 4;
      rows = rows.filter((l) =>
        [l.action, l.target, l.detail, l.actor_name].some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    rows = rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.log_id - a.log_id);
    if (/SELECT COUNT\(\*\) AS total/i.test(s)) {
      return [[{ total: rows.length }], { rowCount: 1 }];
    }
    const limit = Number(params[idx++]);
    const offset = Number(params[idx++]);
    const paged = rows.slice(offset, offset + limit);
    return [paged, { rowCount: paged.length }];
  }
  return [[], { rowCount: 0 }];
};

const app = require("./src/app");
const { logAudit } = require("./src/utils/audit");

function tokenFor(u) {
  return jwt.sign({ user_id: u.user_id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function get(server, path, token) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    http.get(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
      }
    ).on("error", reject);
  });
}

(async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    // 1-6: Strict personal visibility across ALL accounts & roles (plus null actor_id hidden)
    for (const u of users) {
      const res = await get(server, "/api/audit-logs", tokenFor(u));
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.total, 1, `${u.name} should only see their own 1 log`);
      assert.strictEqual(res.data.logs.length, 1);
      assert.strictEqual(res.data.logs[0].actor_id, u.user_id);
    }

    // 7: Parameter tampering attempts must return 403 Forbidden
    const c1Tok = tokenFor(users[0]);
    for (const badQuery of [
      "/api/audit-logs?actor_id=12",
      "/api/audit-logs?userId=21",
      "/api/audit-logs?all=true",
      "/api/audit-logs?scope=all",
      "/api/audit-logs?role=seller",
    ]) {
      const res = await get(server, badQuery, c1Tok);
      assert.strictEqual(res.status, 403, `Expected 403 for ${badQuery}`);
    }

    // 8-9: Newly generated activities + search + category filter + pagination
    await logAudit(users[0], { category: "Parcels", action: "Updated route", target: "SPX123456789", detail: "Hub dispatch" });
    await logAudit(users[0], { category: "Parcels", action: "Flagged item", target: "SPX999999999", detail: "Check seal" });

    const c1All = await get(server, "/api/audit-logs?limit=2&offset=0", c1Tok);
    assert.strictEqual(c1All.data.total, 3);
    assert.strictEqual(c1All.data.logs.length, 2);

    const c1Filtered = await get(server, "/api/audit-logs?category=Parcels&q=seal", c1Tok);
    assert.strictEqual(c1Filtered.data.total, 1);
    assert.strictEqual(c1Filtered.data.logs[0].target, "SPX999999999");

    // Coord 2 still cannot see Coord 1's newly added logs
    const c2Check = await get(server, "/api/audit-logs", tokenFor(users[1]));
    assert.strictEqual(c2Check.data.total, 1);

    // 10: Historical records remain preserved in DB
    assert.ok(auditLogs.some((l) => l.log_id === 7 && l.actor_id === null));

    console.log("PASS: All personal Activity Log isolation tests across Coordinator, Seller, and Rider passed!");
  } finally {
    server.close();
  }
})();
