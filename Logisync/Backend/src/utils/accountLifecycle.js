const { rawPool } = require("../config/database");

const RECOVERY_PERIOD_DAYS = 7;
const LAZY_SWEEP_COOLDOWN_MS = 60 * 1000; // Run lazy sweep at most once per minute

let lifecycleSchemaReady = false;
let lastSweepAt = 0;
let activeSweepPromise = null;

async function ensureAccountLifecycleSchema() {
  if (lifecycleSchemaReady) return;
  await rawPool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_expires_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reactivated_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permanently_deleted_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_identifier VARCHAR(120);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

    CREATE INDEX IF NOT EXISTS idx_users_recovery_expiry
      ON users(recovery_expires_at)
      WHERE is_deleted = FALSE AND verification_status = 'REJECTED';
  `);
  lifecycleSchemaReady = true;
}

function getAccountCode(user) {
  if (!user) return "USER-0000";
  const role = String(user.role || "").toLowerCase();
  if (role === "seller") {
    return user.seller_code || `SEL-${String(user.user_id).padStart(4, "0")}`;
  }
  if (role === "rider") {
    return user.rider_code || `RID-${String(user.user_id).padStart(4, "0")}`;
  }
  return `USR-${String(user.user_id).padStart(4, "0")}`;
}

function getRoleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r === "seller") return "Seller";
  if (r === "rider") return "Rider";
  return "Coordinator";
}

function formatRemovedDisplayName(user) {
  const label = getRoleLabel(user.role);
  const code = getAccountCode(user);
  return `Removed ${label} (${code})`;
}

/**
 * Checks whether the user has any operational/historical records that must remain intact.
 */
async function hasHistoricalOperationalRecords(client, userId) {
  const check = await client.query(
    `SELECT (
       EXISTS (SELECT 1 FROM parcels WHERE seller_id = $1 OR rider_id = $1 OR rth_requested_by = $1 OR rth_confirmed_by = $1 OR discreet_reviewed_by = $1)
       OR EXISTS (SELECT 1 FROM video_proofs WHERE uploaded_by = $1)
       OR EXISTS (SELECT 1 FROM communication_messages WHERE sender_id = $1 OR receiver_id = $1)
       OR EXISTS (SELECT 1 FROM rider_incidents WHERE rider_id = $1)
       OR EXISTS (SELECT 1 FROM complaints WHERE user_id = $1)
       OR EXISTS (SELECT 1 FROM parcel_history WHERE actor_id = $1)
     ) AS has_records`,
    [userId]
  );
  return Boolean(check.rows?.[0]?.has_records);
}

/**
 * Permanently removes a single expired inactive seller/rider account inside an open transaction.
 * - Always erases login credentials, OTPs, password resets, push subscriptions, drafts, and PII.
 * - If historical operational records exist (parcels, videos, messages, incidents, complaints, history),
 *   retains an anonymized non-loginable tombstone row (`is_deleted = TRUE`) with retained operational code
 *   so all foreign keys and JOIN queries remain 100% intact and understandable.
 * - If no historical operational records exist, hard-deletes the row from `users`.
 * - Records an authoritative system activity log entry in `audit_logs`.
 */
async function processExpiredAccountInTx(client, user) {
  const userId = Number(user.user_id);
  const role = String(user.role || "").toLowerCase();
  const roleLabel = getRoleLabel(role);
  const accountCode = getAccountCode(user);
  const originalName = String(user.name || accountCode).trim();
  const removedDisplayName = formatRemovedDisplayName(user);
  const retainedIdentifier = `${roleLabel} ${accountCode}`;

  // 1. Delete ephemeral/credential/session/PII dependent records
  await client.query("DELETE FROM email_otps WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM push_subscriptions WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM user_preferences WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM user_policy_acceptances WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM seller_parcel_drafts WHERE seller_id = $1", [userId]);
  await client.query("DELETE FROM seller_customers WHERE seller_id = $1", [userId]);

  const preserveRow = await hasHistoricalOperationalRecords(client, userId);

  if (preserveRow) {
    // Scrub all login credentials & personal info while keeping FK anchor + retained code identifier
    const tombEmail = `deleted-${role}-${userId}-${Date.now()}@removed.logisync.invalid`;
    await client.query(
      `UPDATE users
          SET name = $1,
              email = $2,
              password_hash = '!ACCOUNT_PERMANENTLY_DELETED!',
              verification_status = 'REJECTED',
              phone = NULL,
              avatar = NULL,
              shop_name = NULL,
              pickup_address = NULL,
              zone = NULL,
              vehicle = NULL,
              plate_number = NULL,
              agency = NULL,
              first_login = FALSE,
              is_deleted = TRUE,
              deleted_identifier = $3,
              permanently_deleted_at = NOW(),
              session_version = COALESCE(session_version, 1) + 1,
              updated_at = NOW()
        WHERE user_id = $4`,
      [removedDisplayName, tombEmail, retainedIdentifier, userId]
    );
  } else {
    // No historical operational records reference this account: safe to hard-delete
    await client.query("DELETE FROM users WHERE user_id = $1", [userId]);
  }

  // 2. Write permanent removal activity log entry
  const detailText = `${roleLabel} account "${originalName}" (${accountCode}) was permanently removed after the ${RECOVERY_PERIOD_DAYS}-day recovery period expired.${
    preserveRow ? " Historical operational records were preserved." : ""
  }`;

  await client.query(
    `INSERT INTO audit_logs
       (actor_id, actor_name, actor_role, category, action, target, detail, seller_id, rider_id, created_at)
     VALUES (NULL, 'System', 'system', 'Accounts', 'Account permanently removed after recovery period', $1, $2, $3, $4, NOW())`,
    [
      `${roleLabel}: ${originalName} (${accountCode})`,
      detailText.slice(0, 500),
      role === "seller" ? userId : null,
      role === "rider" ? userId : null,
    ]
  );

  return {
    user_id: userId,
    role,
    account_code: accountCode,
    original_name: originalName,
    mode: preserveRow ? "anonymized_tombstone" : "hard_deleted",
  };
}

/**
 * Finds and permanently removes all inactive seller/rider accounts whose server-side
 * 7-day recovery period has expired (`recovery_expires_at <= NOW()`).
 * Safe against concurrent / duplicate execution via PostgreSQL `FOR UPDATE SKIP LOCKED`.
 */
async function purgeExpiredDeactivatedAccounts({ force = false, userId = null } = {}) {
  await ensureAccountLifecycleSchema();

  const now = Date.now();
  if (!force && !userId && now - lastSweepAt < LAZY_SWEEP_COOLDOWN_MS) {
    return { skipped: true, removedCount: 0, removed: [] };
  }

  if (!userId && activeSweepPromise) {
    return activeSweepPromise;
  }

  const run = async () => {
    const client = await rawPool.connect();
    const removed = [];
    try {
      await client.query("BEGIN");

      const query = userId
        ? `SELECT user_id, name, email, role, seller_code, rider_code,
                  deactivated_at, recovery_expires_at
             FROM users
            WHERE user_id = $1
              AND role IN ('seller', 'rider')
              AND is_deleted = FALSE
              AND verification_status = 'REJECTED'
              AND recovery_expires_at IS NOT NULL
              AND recovery_expires_at <= NOW()
              FOR UPDATE SKIP LOCKED`
        : `SELECT user_id, name, email, role, seller_code, rider_code,
                  deactivated_at, recovery_expires_at
             FROM users
            WHERE role IN ('seller', 'rider')
              AND is_deleted = FALSE
              AND verification_status = 'REJECTED'
              AND recovery_expires_at IS NOT NULL
              AND recovery_expires_at <= NOW()
            ORDER BY recovery_expires_at ASC
            LIMIT 100
              FOR UPDATE SKIP LOCKED`;

      const params = userId ? [Number(userId)] : [];
      const res = await client.query(query, params);
      const expiredUsers = res.rows || [];

      for (const user of expiredUsers) {
        const result = await processExpiredAccountInTx(client, user);
        removed.push(result);
      }

      await client.query("COMMIT");
      if (!userId) {
        lastSweepAt = Date.now();
      }
      if (removed.length > 0) {
        console.log(
          `[accountLifecycle] Permanently removed ${removed.length} expired inactive account(s):`,
          removed.map((r) => `${r.role}:${r.account_code}(${r.mode})`).join(", ")
        );
      }
      return { skipped: false, removedCount: removed.length, removed };
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore rollback error */
      }
      console.error("[accountLifecycle] purgeExpiredDeactivatedAccounts error:", err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  };

  if (userId) {
    return run();
  }

  activeSweepPromise = run().finally(() => {
    activeSweepPromise = null;
  });
  return activeSweepPromise;
}

/**
 * Starts a periodic server-side cleanup job for long-running Node deployments.
 */
function startExpiredAccountCleanupScheduler(intervalMs = 15 * 60 * 1000) {
  purgeExpiredDeactivatedAccounts({ force: true }).catch((err) => {
    console.warn("[accountLifecycle] Initial startup cleanup warning:", err?.message || err);
  });

  const timer = setInterval(() => {
    purgeExpiredDeactivatedAccounts({ force: true }).catch((err) => {
      console.warn("[accountLifecycle] Scheduled cleanup warning:", err?.message || err);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = {
  RECOVERY_PERIOD_DAYS,
  ensureAccountLifecycleSchema,
  getAccountCode,
  getRoleLabel,
  formatRemovedDisplayName,
  purgeExpiredDeactivatedAccounts,
  startExpiredAccountCleanupScheduler,
};
