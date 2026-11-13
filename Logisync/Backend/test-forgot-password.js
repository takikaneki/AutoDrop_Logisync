const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

const { pool, rawPool } = require("./src/config/database");
rawPool.query = async function () {
  return { rows: [], rowCount: 0 };
};
const app = require("./src/app");

const OLD_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "NewSecurePassword456";
let sellerHash = bcrypt.hashSync(OLD_PASSWORD, 10);

const mockUsers = {
  "seller@example.com": {
    user_id: 1,
    name: "ABC Store",
    email: "seller@example.com",
    get password_hash() {
      return sellerHash;
    },
    set password_hash(val) {
      sellerHash = val;
    },
    role: "seller",
    verification_status: "APPROVED"
  }
};

const mockResets = [];

// Intercept pool.query for the test runner
pool.query = async function (sql, params = []) {
  const queryText = String(sql).trim();

  // Handle policy schema checks
  if (queryText.includes("information_schema.columns") || queryText.includes("CREATE TABLE IF NOT EXISTS")) {
    const rows = [{ column_name: "terms_accepted" }];
    return [rows, { rowCount: rows.length }];
  }

  // Lookup user by email
  if (queryText.includes("FROM users") && (queryText.includes("LOWER(BTRIM(email))") || queryText.includes("email ="))) {
    const email = String(params[0] || "").toLowerCase().trim();
    const user = mockUsers[email];
    const rows = user ? [{ ...user, password_hash: user.password_hash }] : [];
    rows.insertId = null;
    rows.affectedRows = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // Lookup user by user_id
  if (queryText.includes("FROM users") && queryText.includes("user_id =")) {
    const userId = Number(params[0]);
    const user = Object.values(mockUsers).find((u) => u.user_id === userId);
    const rows = user ? [{ ...user, password_hash: user.password_hash }] : [];
    rows.insertId = null;
    rows.affectedRows = rows.length;
    return [rows, { rowCount: rows.length }];
  }

  // Invalidate previous tokens
  if (queryText.includes("UPDATE password_resets") && queryText.includes("used = TRUE WHERE user_id =")) {
    const userId = Number(params[0]);
    mockResets.forEach((r) => {
      if (r.user_id === userId) r.used = true;
    });
    const rows = [];
    return [rows, { rowCount: 1 }];
  }

  // Insert password_reset
  if (queryText.includes("INSERT INTO password_resets")) {
    const [userId, token, expiresAt] = params;
    const record = {
      reset_id: mockResets.length + 1,
      user_id: userId,
      token,
      expires_at: new Date(expiresAt),
      used: false,
      created_at: new Date()
    };
    mockResets.push(record);
    const rows = [];
    rows.insertId = record.reset_id;
    return [rows, { rowCount: 1 }];
  }

  // Select token
  if (queryText.includes("FROM password_resets r") || queryText.includes("FROM password_resets")) {
    const token = String(params[0] || "");
    const reset = mockResets.find((r) => r.token === token);
    if (!reset) {
      const rows = [];
      return [rows, { rowCount: 0 }];
    }
    const user = Object.values(mockUsers).find((u) => u.user_id === reset.user_id);
    const row = {
      ...reset,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      password_hash: user?.password_hash
    };
    const rows = [row];
    return [rows, { rowCount: 1 }];
  }

  // Update password in users
  if (queryText.includes("UPDATE users") && queryText.includes("SET password_hash =")) {
    const newHash = params[0];
    const userId = params[1];
    const user = Object.values(mockUsers).find((u) => u.user_id === userId);
    if (user) {
      user.password_hash = newHash;
    }
    const rows = [];
    return [rows, { rowCount: 1 }];
  }

  // Mark token used
  if (queryText.includes("UPDATE password_resets") && queryText.includes("WHERE reset_id =")) {
    const resetId = params[0];
    const reset = mockResets.find((r) => r.reset_id === resetId);
    if (reset) {
      reset.used = true;
    }
    const rows = [];
    return [rows, { rowCount: 1 }];
  }

  // Audit logs, policy acceptance, etc.
  const rows = [];
  rows.insertId = 1;
  rows.affectedRows = 1;
  return [rows, { rowCount: 1 }];
};

const pipePath = `\\\\.\\pipe\\logisync-test-fp-${Date.now()}`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const reqHeaders = {
      "Content-Type": "application/json",
      ...headers
    };
    if (postData) {
      reqHeaders["Content-Length"] = Buffer.byteLength(postData);
    }

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
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
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
  await new Promise((resolve) => server.listen(pipePath, resolve));
  console.log("Test server listening on pipe:", pipePath);

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
    console.log("\n--- TEST 1: Request reset with missing email ---");
    const res1 = await request("POST", "/api/auth/forgot-password", {});
    assert(res1.status === 400, "Returns 400 for empty body");

    console.log("\n--- TEST 2: Request reset with invalid email format ---");
    const res2 = await request("POST", "/api/auth/forgot-password", { email: "not-an-email" });
    assert(res2.status === 400, "Returns 400 for invalid email format");

    console.log("\n--- TEST 3: Request reset with non-existent email (Generic 200 response) ---");
    const res3 = await request("POST", "/api/auth/forgot-password", { email: "unknown@example.com" });
    assert(res3.status === 200, "Returns 200 to prevent email enumeration");
    assert(res3.data.success === true, "Response payload indicates success");

    console.log("\n--- TEST 4: Request reset with existing user email ---");
    const res4 = await request("POST", "/api/auth/forgot-password", { email: "seller@example.com" });
    assert(res4.status === 200, "Returns 200 for valid registered email");
    assert(mockResets.length === 1, "Password reset token record was created in database");
    const generatedToken = mockResets[0].token;
    assert(typeof generatedToken === "string" && generatedToken.length >= 32, "Token is a secure hex string");

    console.log("\n--- TEST 5: Verify reset token with invalid token ---");
    const res5 = await request("GET", "/api/auth/reset-password/verify?token=fake-token-1234");
    assert(res5.status === 400, "Returns 400 for fake token");
    assert(res5.data.valid === false, "Payload states token is invalid");

    console.log("\n--- TEST 6: Verify reset token with valid token ---");
    const res6 = await request("GET", `/api/auth/reset-password/verify?token=${generatedToken}`);
    assert(res6.status === 200, "Returns 200 for valid token");
    assert(res6.data.valid === true, "Payload states token is valid");
    assert(res6.data.email.includes("@"), "Returns masked email preview");

    console.log("\n--- TEST 7: Reset password with short password (< 8 chars) ---");
    const res7 = await request("POST", "/api/auth/reset-password", {
      token: generatedToken,
      newPassword: "short",
      confirmPassword: "short"
    });
    assert(res7.status === 400, "Returns 400 for password < 8 characters");

    console.log("\n--- TEST 8: Reset password with mismatched confirmPassword ---");
    const res8 = await request("POST", "/api/auth/reset-password", {
      token: generatedToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: "DifferentPassword123"
    });
    assert(res8.status === 400, "Returns 400 for password mismatch");

    console.log("\n--- TEST 9: Reset password with same as old password ---");
    const res9 = await request("POST", "/api/auth/reset-password", {
      token: generatedToken,
      newPassword: OLD_PASSWORD,
      confirmPassword: OLD_PASSWORD
    });
    assert(res9.status === 400, "Returns 400 when new password is identical to old password");

    console.log("\n--- TEST 10: Reset password with valid new password ---");
    const res10 = await request("POST", "/api/auth/reset-password", {
      token: generatedToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD
    });
    assert(res10.status === 200, "Returns 200 for successful password reset");
    assert(mockResets[0].used === true, "Token is marked as used in DB");

    console.log("\n--- TEST 11: Reusing already used token fails ---");
    const res11 = await request("POST", "/api/auth/reset-password", {
      token: generatedToken,
      newPassword: "AnotherPassword999",
      confirmPassword: "AnotherPassword999"
    });
    assert(res11.status === 400, "Returns 400 when attempting to reuse consumed token");

    console.log("\n--- TEST 12: Login with old password fails ---");
    const res12 = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: OLD_PASSWORD,
      portal: "seller",
      termsAccepted: true
    });
    assert(res12.status === 401, "Old password rejected with 401");

    console.log("\n--- TEST 13: Login with new password succeeds ---");
    const res13 = await request("POST", "/api/auth/login", {
      email: "seller@example.com",
      password: NEW_PASSWORD,
      portal: "seller",
      termsAccepted: true
    });
    assert(res13.status === 200, "New password accepted with 200");
    assert(res13.data.token, "JWT token returned for authenticated session");

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
