const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

const { pool, rawPool } = require("./src/config/database");
rawPool.query = async function () {
  return { rows: [], rowCount: 0 };
};
const app = require("./src/app");

const PASSWORD = "Password123!";
const hash = bcrypt.hashSync(PASSWORD, 10);

const mockUsers = {
  "seller@example.com": {
    user_id: 101,
    name: "ABC Store",
    email: "seller@example.com",
    password_hash: hash,
    role: "seller",
    verification_status: "APPROVED"
  },
  "rider@example.com": {
    user_id: 102,
    name: "Rider Juan",
    email: "rider@example.com",
    password_hash: hash,
    role: "rider",
    verification_status: "APPROVED"
  },
  "coordinator@example.com": {
    user_id: 103,
    name: "Admin Hub",
    email: "coordinator@example.com",
    password_hash: hash,
    role: "coordinator",
    verification_status: "APPROVED"
  },
  "suspended@example.com": {
    user_id: 104,
    name: "Suspended Seller",
    email: "suspended@example.com",
    password_hash: hash,
    role: "seller",
    verification_status: "REJECTED"
  },
  "pending@example.com": {
    user_id: 105,
    name: "Pending Rider",
    email: "pending@example.com",
    password_hash: hash,
    role: "rider",
    verification_status: "PENDING"
  },
  "norole@example.com": {
    user_id: 106,
    name: "Ghost User",
    email: "norole@example.com",
    password_hash: hash,
    role: "guest",
    verification_status: "APPROVED"
  }
};

pool.query = async function (sql, params = []) {
  const queryText = String(sql).trim();

  // User lookup by email or username
  if (queryText.includes("FROM users") && (queryText.includes("LOWER(BTRIM(email))") || queryText.includes("LOWER(BTRIM(name))"))) {
    const ident = String(params[0] || "").toLowerCase().trim();
    const user = Object.values(mockUsers).find(
      (u) => u.email.toLowerCase() === ident || u.name.toLowerCase() === ident
    );
    const rows = user ? [user] : [];
    rows.insertId = null;
    rows.rowCount = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // User lookup by user_id
  if (queryText.includes("FROM users") && queryText.includes("user_id =")) {
    const userId = Number(params[0]);
    const user = Object.values(mockUsers).find((u) => u.user_id === userId);
    const rows = user ? [user] : [];
    rows.insertId = null;
    rows.rowCount = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // Policy / schema checks
  if (queryText.includes("information_schema.columns") || queryText.includes("CREATE TABLE IF NOT EXISTS")) {
    return [[{ column_name: "terms_accepted" }], { rowCount: 1 }];
  }

  // Audit logs, updates
  const rows = [];
  rows.insertId = 1;
  rows.rowCount = 1;
  return [rows, { rowCount: 1 }];
};

const pipePath = `\\\\.\\pipe\\logisync-unified-test-${Date.now()}`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const reqHeaders = {
      ...headers,
      ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {})
    };

    const req = http.request(
      {
        socketPath: pipePath,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(pipePath, resolve));
  console.log("Unified Login Test Server running on named pipe:", pipePath);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    console.log("\n=== TEST SUITE 1: AUTOMATIC ROLE DETECTION ===");

    // 1. Seller login (no role provided)
    const resSeller = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resSeller.status === 200, "Seller login succeeds (HTTP 200)");
    assert(resSeller.data.user.role === "seller", "Role automatically detected as 'seller'");
    assert(resSeller.data.redirectUrl === "/seller", "Redirect destination is '/seller'");
    assert(Boolean(resSeller.data.token), "Cryptographically signed JWT session issued");
    const sellerToken = resSeller.data.token;

    // 2. Rider login (no role provided)
    const resRider = await request("POST", "/api/auth/login", {
      email: "rider@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resRider.status === 200, "Rider login succeeds (HTTP 200)");
    assert(resRider.data.user.role === "rider", "Role automatically detected as 'rider'");
    assert(resRider.data.redirectUrl === "/rider", "Redirect destination is '/rider'");
    assert(Boolean(resRider.data.token), "JWT token issued for rider");
    const riderToken = resRider.data.token;

    // 3. Coordinator login (no role provided)
    const resCoord = await request("POST", "/api/auth/login", {
      email: "coordinator@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resCoord.status === 200, "Coordinator login succeeds (HTTP 200)");
    assert(resCoord.data.user.role === "coordinator", "Role automatically detected as 'coordinator'");
    assert(resCoord.data.redirectUrl === "/dashboard", "Redirect destination is '/dashboard'");
    assert(Boolean(resCoord.data.token), "JWT token issued for coordinator");
    const coordToken = resCoord.data.token;

    // 4. Login using username/name instead of email
    const resUsername = await request("POST", "/api/auth/login", {
      username: "ABC Store",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resUsername.status === 200, "Login with Username/Name succeeds (HTTP 200)");
    assert(resUsername.data.user.role === "seller", "Identifies correct account by name");

    console.log("\n=== TEST SUITE 2: INVALID LOGIN & ACCOUNT STATUS CHECKS ===");

    // 5. Non-existent email/username
    const resNotFound = await request("POST", "/api/auth/login", {
      email: "unknown@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resNotFound.status === 401, "Non-existent user returns 401");
    assert(resNotFound.data.message === "Invalid email or password.", "Generic error prevents enumeration");

    // 6. Wrong password
    const resBadPass = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: "WrongPassword999",
      termsAccepted: true
    });
    assert(resBadPass.status === 401, "Wrong password returns 401");
    assert(resBadPass.data.message === "Invalid email or password.", "Generic error message returned");

    // 7. Suspended / Inactive account
    const resSuspended = await request("POST", "/api/auth/login", {
      email: "suspended@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resSuspended.status === 403, "Suspended account rejected with 403");
    assert(resSuspended.data.message.includes("inactive"), "Displays inactive/suspended notice");

    // 8. Pending account
    const resPending = await request("POST", "/api/auth/login", {
      email: "pending@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resPending.status === 403, "Pending account rejected with 403");
    assert(resPending.data.message.includes("pending"), "Displays pending approval notice");

    // 9. Unauthorized / invalid role
    const resNoRole = await request("POST", "/api/auth/login", {
      email: "norole@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert(resNoRole.status === 403, "Account with invalid role denied access (403)");

    console.log("\n=== TEST SUITE 3: ROLE-BASED ACCESS CONTROL (RBAC) ===");

    // 10. Seller cannot access Coordinator user management
    const resSellerAdmin = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${sellerToken}`
    });
    assert(resSellerAdmin.status === 403, "Seller blocked from Coordinator route GET /api/users (403)");

    // 11. Rider cannot access Coordinator user management
    const resRiderAdmin = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${riderToken}`
    });
    assert(resRiderAdmin.status === 403, "Rider blocked from Coordinator route GET /api/users (403)");

    // 12. Coordinator can access user management
    const resCoordAdmin = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${coordToken}`
    });
    assert(resCoordAdmin.status === 200, "Coordinator allowed on GET /api/users (200)");

    // 13. Rider cannot create parcels (Seller only)
    const resRiderCreate = await request("POST", "/api/parcels", { contents: "Test" }, {
      Authorization: `Bearer ${riderToken}`
    });
    assert(resRiderCreate.status === 403, "Rider blocked from POST /api/parcels (403)");

    // 14. Seller cannot access Rider-only parcel delivery route
    const resSellerRider = await request("GET", "/api/parcels/rider/mine", null, {
      Authorization: `Bearer ${sellerToken}`
    });
    assert(resSellerRider.status === 403, "Seller blocked from GET /api/parcels/rider/mine (403)");

  } finally {
    server.close();
  }

  console.log("\n==========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

