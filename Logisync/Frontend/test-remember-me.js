/**
 * Automated Test: Unified Login Remember-Me Flow
 */

async function run() {
  console.log("=== RUNNING UNIFIED LOGIN REMEMBER-ME TEST ===");

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

  // --- Step 1: User logs in on unified login with Remember Me checked ---
  console.log("\n--- STEP 1: Unified login with Remember Me enabled ---");
  const testEmail = "coordinator@example.com";
  const testPassword = "AdminSecurePassword123!";

  await saveRememberedCredentials(testEmail, testPassword);
  assert(storageMap.has("logisync_remember_user"), "Stored entry for unified login");

  const rawSaved = storageMap.get("logisync_remember_user");
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

  assert(storageMap.has("logisync_remember_user"), "Remember-Me data remains intact after logout");

  // --- Step 3: User returns to Unified Login Page ---
  console.log("\n--- STEP 3: User returns to Unified Login Page ---");
  const restored = await getRememberedCredentials();
  assert(restored !== null, "Credentials retrieved on return");
  assert(restored.remember === true, "Remember Me checkbox state is true");
  assert(restored.email === testEmail, "Email address correctly populated");
  assert(restored.password === testPassword, "Password correctly decrypted and populated");

  // --- Step 4: User unchecks Remember Me ---
  console.log("\n--- STEP 4: User unchecks Remember Me ---");
  clearRememberedCredentials();
  const afterUncheck = await getRememberedCredentials();
  assert(afterUncheck === null, "Saved credentials removed when Remember Me is unchecked");

  // --- Step 5: Returning to unified login without Remember Me ---
  console.log("\n--- STEP 5: Returning to login without Remember Me ---");
  const emptyCheck = await getRememberedCredentials();
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
