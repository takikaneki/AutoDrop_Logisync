const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

const { pool, rawPool } = require("./src/config/database");
rawPool.query = async function () {
  return { rows: [], rowCount: 0 };
};
const app = require("./src/app");

// Sample test users
const PASSWORD = "password123";
const hash = bcrypt.hashSync(PASSWORD, 10);

const mockUsers = {
  "seller@example.com": {
    user_id: 1,
    name: "ABC Store",
    email: "seller@example.com",
    password_hash: hash,
    role: "seller",
    verification_status: "APPROVED"
  },
  "rider@example.com": {
    user_id: 2,
    name: "Rider One",
    email: "rider@example.com",
    password_hash: hash,
    role: "rider",
    verification_status: "APPROVED"
  },
  "coordinator@example.com": {
    user_id: 3,
    name: "Admin Coordinator",
    email: "coordinator@example.com",
    password_hash: hash,
    role: "coordinator",
    verification_status: "APPROVED"
  }
};

// Intercept pool.query for the test runner
pool.query = async function (sql, params = []) {
  const queryText = String(sql).trim();

  // Handle user lookup by email
  if (queryText.includes("FROM users") && (queryText.includes("LOWER(BTRIM(email))") || queryText.includes("email ="))) {
    const email = String(params[0] || "").toLowerCase().trim();
    const user = mockUsers[email];
    const rows = user ? [user] : [];
    rows.insertId = null;
    rows.affectedRows = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // Handle user lookup by user_id
  if (queryText.includes("FROM users") && queryText.includes("user_id =")) {
    const userId = Number(params[0]);
    const user = Object.values(mockUsers).find((u) => u.user_id === userId);
    const rows = user ? [user] : [];
    rows.insertId = null;
    rows.affectedRows = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // Handle user_policy_acceptances, audit_logs, updates
  const rows = [];
  rows.insertId = 1;
  rows.affectedRows = 1;
  return [rows, { rowCount: 1 }];
};

const pipePath = `\\\\.\\pipe\\logisync-test-${Date.now()}`;

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
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(pipePath, r));
  console.log("Test HTTP server listening on named pipe:", pipePath);

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = "") {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} - ${details}`);
      failed++;
    }
  }

  try {
    console.log("\n=== 1. TESTING THE 9 PORTAL LOGIN COMBINATIONS ===");

    const matrix = [
      { portal: "seller", email: "seller@example.com", actualRole: "seller", expect: 200 },
      { portal: "seller", email: "rider@example.com", actualRole: "rider", expect: 403 },
      { portal: "seller", email: "coordinator@example.com", actualRole: "coordinator", expect: 403 },
      { portal: "rider", email: "seller@example.com", actualRole: "seller", expect: 403 },
      { portal: "rider", email: "rider@example.com", actualRole: "rider", expect: 200 },
      { portal: "rider", email: "coordinator@example.com", actualRole: "coordinator", expect: 403 },
      { portal: "coordinator", email: "seller@example.com", actualRole: "seller", expect: 403 },
      { portal: "coordinator", email: "rider@example.com", actualRole: "rider", expect: 403 },
      { portal: "coordinator", email: "coordinator@example.com", actualRole: "coordinator", expect: 200 }
    ];

    const EXPECTED_ROLE_MISMATCH_MSG =
      "Your account is not authorized to access this login portal. Please use the correct login option.";

    for (const testCase of matrix) {
      const res = await request("POST", "/api/auth/login", {
        email: testCase.email,
        password: PASSWORD,
        portal: testCase.portal,
        termsAccepted: true
      });

      const label = `Portal: ${testCase.portal.toUpperCase()} | Account: ${testCase.actualRole.toUpperCase()}`;
      assert(
        `${label} -> HTTP ${res.status}`,
        res.status === testCase.expect,
        `Expected ${testCase.expect}, got ${res.status}`
      );

      if (testCase.expect === 200) {
        assert(
          `${label} -> Token issued & user role matches`,
          Boolean(res.body.token) && res.body.user.role === testCase.actualRole,
          JSON.stringify(res.body)
        );
      } else {
        assert(
          `${label} -> Mismatch error message matches requirement`,
          res.body.message === EXPECTED_ROLE_MISMATCH_MSG,
          `Got message: "${res.body.message}"`
        );
        assert(`${label} -> No token returned on rejection`, !res.body.token, "Token should be undefined");
      }
    }

    console.log("\n=== 2. TESTING DEDICATED PORTAL ENDPOINTS ===");
    const sellerOnSeller = await request("POST", "/api/auth/login/seller", {
      email: "seller@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert("POST /api/auth/login/seller with Seller account -> 200", sellerOnSeller.status === 200);

    const coordOnSeller = await request("POST", "/api/auth/login/seller", {
      email: "coordinator@example.com",
      password: PASSWORD,
      termsAccepted: true
    });
    assert("POST /api/auth/login/seller with Coordinator account -> 403", coordOnSeller.status === 403);
    assert("POST /api/auth/login/seller with Coordinator account -> exact error message", coordOnSeller.body.message === EXPECTED_ROLE_MISMATCH_MSG);

    console.log("\n=== 3. TESTING INVALID CREDENTIALS & ACCOUNT DISCOVERY RESISTANCE ===");
    const nonExistent = await request("POST", "/api/auth/login", {
      email: "nonexistent@example.com",
      password: PASSWORD,
      portal: "seller",
      termsAccepted: true
    });
    assert("Non-existent email returns 401 Invalid email or password", nonExistent.status === 401 && nonExistent.body.message === "Invalid email or password.");

    const wrongPassword = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: "wrongPassword123",
      portal: "seller",
      termsAccepted: true
    });
    assert("Wrong password returns 401 Invalid email or password", wrongPassword.status === 401 && wrongPassword.body.message === "Invalid email or password.");

    console.log("\n=== 4. TESTING DIRECT API ACCESS & AUTHORIZATION GUARDS ===");
    // Obtain valid tokens for each role
    const sellerLogin = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: PASSWORD,
      portal: "seller",
      termsAccepted: true
    });
    const sellerToken = sellerLogin.body.token;

    const riderLogin = await request("POST", "/api/auth/login", {
      email: "rider@example.com",
      password: PASSWORD,
      portal: "rider",
      termsAccepted: true
    });
    const riderToken = riderLogin.body.token;

    const coordinatorLogin = await request("POST", "/api/auth/login", {
      email: "coordinator@example.com",
      password: PASSWORD,
      portal: "coordinator",
      termsAccepted: true
    });
    const coordinatorToken = coordinatorLogin.body.token;

    // Coordinator accounts route: GET /api/users (Coordinator only)
    const sellerOnUsers = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${sellerToken}`
    });
    assert("Seller attempting GET /api/users (Coordinator only) -> 403 Forbidden", sellerOnUsers.status === 403);

    const riderOnUsers = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${riderToken}`
    });
    assert("Rider attempting GET /api/users (Coordinator only) -> 403 Forbidden", riderOnUsers.status === 403);

    const coordOnUsers = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${coordinatorToken}`
    });
    assert("Coordinator accessing GET /api/users -> 200 OK", coordOnUsers.status === 200);

    // Rider-only delivery scan: POST /api/parcels/rider/mine (Rider only)
    const sellerOnRiderParcels = await request("GET", "/api/parcels/rider/mine", null, {
      Authorization: `Bearer ${sellerToken}`
    });
    assert("Seller accessing GET /api/parcels/rider/mine (Rider only) -> 403 Forbidden", sellerOnRiderParcels.status === 403);

    // Seller-only parcel create: POST /api/parcels (Seller only)
    const riderOnCreateParcel = await request("POST", "/api/parcels", {}, {
      Authorization: `Bearer ${riderToken}`
    });
    assert("Rider accessing POST /api/parcels (Seller only) -> 403 Forbidden", riderOnCreateParcel.status === 403);

    console.log("\n=== 5. TESTING TOKEN TAMPERING AND EXPIRATION ===");
    // Tampered token (modified payload without valid signature)
    const tamperedToken = sellerToken.slice(0, -6) + "abcdef";
    const tamperedRes = await request("GET", "/api/users", null, {
      Authorization: `Bearer ${tamperedToken}`
    });
    assert("Tampered JWT signature is rejected -> 401", tamperedRes.status === 401);

    // Expired token
    const expiredToken = jwt.sign(
      { user_id: 1, role: "seller", name: "ABC Store", email: "seller@example.com" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );
    const expiredRes = await request("GET", "/api/parcels", null, {
      Authorization: `Bearer ${expiredToken}`
    });
    assert("Expired JWT token is rejected -> 401", expiredRes.status === 401);

    console.log("\n=== 6. TESTING LOGOUT ENDPOINT ===");
    const logoutRes = await request("POST", "/api/auth/logout", null, {
      Authorization: `Bearer ${sellerToken}`
    });
    assert("POST /api/auth/logout -> 200 OK", logoutRes.status === 200 && logoutRes.body.success === true);

    console.log(`\n=============================================`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=============================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Test execution error:", err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
