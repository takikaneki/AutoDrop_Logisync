/**
 * Automated Test: Remember-Me Login -> Logout -> Return -> Prefill -> Sign In Flow
 */

async function run() {
  console.log("=== RUNNING REMEMBER-ME INTEGRATION TEST ===");

  const storageMap = new Map();
  globalThis.localStorage = {
    getItem(k) {
      return storageMap.has(k) ? storageMap.get(k) : null;
    },
    setItem(k, v) {
      storageMap.set(k, String(v));
    },
    removeItem(k) {
      storageMap.delete(k);
    },
    clear() {
      storageMap.clear();
    }
  };

  const sessionMap = new Map();
  globalThis.sessionStorage = {
    getItem(k) {
      return sessionMap.has(k) ? sessionMap.get(k) : null;
    },
    setItem(k, v) {
      sessionMap.set(k, String(v));
    },
    removeItem(k) {
      sessionMap.delete(k);
    },
    clear() {
      sessionMap.clear();
    }
  };

  const rememberMeMod = await import("./src/utils/rememberMe.js");
  const {
    saveRememberedCredentials,
    getRememberedCredentials,
    clearRememberedCredentials
  } = rememberMeMod;

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  // --- Step 1: User logs in with Remember Me checked ---
  console.log("\n--- STEP 1: Login with Remember Me enabled ---");
  const testEmail = "seller@example.com";
  const testPassword = "MySecretPassword123!";
  const testRole = "seller";

  await saveRememberedCredentials(testRole, testEmail, testPassword);
  assert(storageMap.has("logisync_remember_seller"), "Stored entry for 'seller' role");

  const rawSaved = storageMap.get("logisync_remember_seller");
  console.log("  Raw LocalStorage content:", rawSaved);

  // Security test: Plain text password MUST NOT exist in storage
  assert(!rawSaved.includes(testPassword), "Password is NEVER stored in plaintext in localStorage");
  assert(rawSaved.includes("cipher"), "Encrypted cipher object is present");

  // --- Step 2: User logs out ---
  console.log("\n--- STEP 2: User logs out ---");
  // Simulating clearSession()
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.clear();

  assert(storageMap.has("logisync_remember_seller"), "Remember-Me data remains intact after logout");

  // --- Step 3: User returns to Login Page ---
  console.log("\n--- STEP 3: User returns to Login Page ---");
  const restored = await getRememberedCredentials(testRole);
  assert(restored !== null, "Credentials retrieved on return");
  assert(restored.remember === true, "Remember Me checkbox state is true");
  assert(restored.email === testEmail, "Email address correctly populated");
  assert(restored.password === testPassword, "Password correctly decrypted and populated");

  // --- Step 4: Role Isolation Test ---
  console.log("\n--- STEP 4: Portal / Role Isolation ---");
  const riderRestored = await getRememberedCredentials("rider");
  const coordRestored = await getRememberedCredentials("coordinator");
  assert(riderRestored === null, "Seller credentials do not leak into Rider portal");
  assert(coordRestored === null, "Seller credentials do not leak into Coordinator portal");

  // --- Step 5: User unchecks Remember Me ---
  console.log("\n--- STEP 5: User unchecks Remember Me ---");
  clearRememberedCredentials(testRole);
  const afterUncheck = await getRememberedCredentials(testRole);
  assert(afterUncheck === null, "Saved credentials removed when Remember Me is unchecked");

  // --- Step 6: Login without Remember Me ---
  console.log("\n--- STEP 6: Returning to login without Remember Me ---");
  const emptyCheck = await getRememberedCredentials(testRole);
  assert(emptyCheck === null, "Email and password remain empty when Remember Me was not checked");

  console.log("\n==========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

