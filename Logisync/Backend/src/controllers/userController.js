const bcrypt = require("bcryptjs");
const { pool, rawPool } = require("../config/database");
const { logAudit } = require("../utils/audit");
const { sendAccountCredentialsEmail } = require("../utils/mailer");
const {
  RECOVERY_PERIOD_DAYS,
  ensureAccountLifecycleSchema,
  getAccountCode,
  getRoleLabel,
  purgeExpiredDeactivatedAccounts,
} = require("../utils/accountLifecycle");

function getLoginUrl() {
  const appUrl = (
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  return `${appUrl}/login`;
}

let userColumnsReady = false;

async function ensureUserColumns() {
  if (userColumnsReady) return;
  await rawPool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_code VARCHAR(20);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(300);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_code VARCHAR(20);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS agency VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_type VARCHAR(2);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE SEQUENCE IF NOT EXISTS rider_code_seq START 1;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_rider_code ON users(rider_code) WHERE rider_code IS NOT NULL;
    UPDATE users u
       SET rider_code = 'RID-' || LPAD(s.n::text, 4, '0')
      FROM (
        SELECT user_id, nextval('rider_code_seq') AS n
          FROM (SELECT user_id FROM users WHERE role = 'rider' AND rider_code IS NULL ORDER BY user_id) q
      ) s
     WHERE u.user_id = s.user_id;
    UPDATE users SET rider_type = 'LM' WHERE role = 'rider' AND rider_type IS NULL;
    UPDATE users SET agency = 'Unassigned' WHERE role = 'rider' AND (agency IS NULL OR agency = '');
    CREATE SEQUENCE IF NOT EXISTS seller_code_seq START 1;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_seller_code ON users(seller_code) WHERE seller_code IS NOT NULL;
    UPDATE users u
       SET seller_code = 'SEL-' || LPAD(s.n::text, 4, '0')
      FROM (
        SELECT user_id, nextval('seller_code_seq') AS n
          FROM (SELECT user_id FROM users WHERE role = 'seller' AND seller_code IS NULL ORDER BY user_id) q
      ) s
     WHERE u.user_id = s.user_id;
  `);
  await ensureAccountLifecycleSchema();
  userColumnsReady = true;
}

const USER_FIELDS = `u.user_id, u.name, u.email, u.role, u.verification_status,
                  u.phone, u.shop_name, u.zone, u.vehicle, u.plate_number,
                  u.seller_code, u.pickup_address, u.rider_code, u.agency, u.rider_type,
                  u.deactivated_at, u.deactivated_by, du.name AS deactivated_by_name,
                  u.recovery_expires_at, u.reactivated_at, u.reactivated_by, ru.name AS reactivated_by_name,
                  u.is_deleted, u.created_at, u.updated_at`;

const USER_JOINS = `LEFT JOIN users du ON u.deactivated_by = du.user_id
                    LEFT JOIN users ru ON u.reactivated_by = ru.user_id`;

const RIDER_TYPES = ["FM", "LM"];
function normalizeRiderType(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "FM" || v === "FIRST MILE" || v === "FIRST_MILE") return "FM";
  if (v === "LM" || v === "LAST MILE" || v === "LAST_MILE") return "LM";
  return null;
}

function cleanPhoneValue(phone) {
  return phone ? String(phone).trim().replace(/^\+639/, "09") : null;
}

// Account Status (Active / Inactive) -> verification_status (APPROVED / REJECTED)
function statusToVerification(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "inactive" || s === "suspended" || s === "rejected") return "REJECTED";
  return "APPROVED";
}

// GET /api/users/contacts
// Sino ang pwedeng i-message ng naka-login na user (kapareho ng rule sa messageController):
//   coordinator -> lahat ng seller at rider
//   seller/rider -> mga coordinator lang
// Walang email o password hash na lumalabas para sa seller/rider.
async function listContacts(req, res) {
  try {
    await ensureUserColumns();
    await purgeExpiredDeactivatedAccounts().catch(() => {});
    const isCoordinator = req.user.role === "coordinator";

    const [rows] = isCoordinator
      ? await pool.query(
          `SELECT user_id, name, email, role, phone FROM users
           WHERE role IN ('seller', 'rider') AND is_deleted = FALSE ORDER BY name ASC`
        )
      : await pool.query(
          `SELECT user_id, name, role, phone FROM users
           WHERE role = 'coordinator' AND is_deleted = FALSE ORDER BY name ASC`
        );

    res.json({ success: true, contacts: rows });
  } catch (error) {
    console.error("listContacts error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve contacts." });
  }
}

const ROLES = ["seller", "rider", "coordinator"];

// POST /api/users  (coordinator lang)  -> gumawa ng account para sa seller, rider o coordinator.
// Ito na rin ang POST /api/auth/register. Wala nang public sign-up.
async function createUser(req, res) {
  try {
    await ensureUserColumns();
    const {
      name,
      email,
      password,
      phone = null,
      shop_name = null,
      zone = null,
      vehicle = null,
      plate_number = null
    } = req.body || {};
    const role = req.body?.role || "seller";

    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be seller, rider, or coordinator." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const cleanName = name.trim().slice(0, 100);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone
      ? String(phone)
          .trim()
          .replace(/^\+639/, "09")
      : null;
    if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Contact number must be a valid 11-digit mobile number starting with 09 (numbers only)."
      });
    }
    const cleanShop = shop_name ? String(shop_name).trim().slice(0, 150) : null;
    const cleanZone = zone ? String(zone).trim().slice(0, 100) : null;
    const cleanVehicle = vehicle ? String(vehicle).trim().slice(0, 100) : null;
    const cleanPlate = plate_number ? String(plate_number).trim().slice(0, 50) : null;

    const [existing] = await pool.query("SELECT user_id FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email is already registered." });
    }

    const cleanPickup = req.body?.pickup_address ? String(req.body.pickup_address).trim().slice(0, 300) : null;
    const verificationStatus = role === "coordinator" ? "APPROVED" : statusToVerification(req.body?.status);

    let cleanAgency = null;
    let cleanRiderType = null;
    if (role === "rider") {
      cleanAgency = req.body?.agency ? String(req.body.agency).trim().slice(0, 150) : "";
      cleanRiderType = normalizeRiderType(req.body?.rider_type) || "LM";
      if (!cleanAgency) {
        return res.status(400).json({ success: false, message: "Assigned agency is required for riders." });
      }
      if (cleanPhone) {
        const [dupPhone] = await pool.query("SELECT user_id FROM users WHERE role = 'rider' AND phone = ?", [cleanPhone]);
        if (dupPhone.length > 0) {
          return res.status(409).json({ success: false, message: "A rider with this contact number already exists." });
        }
      }
    }

    if (role === "seller") {
      if (cleanShop) {
        const [dupShop] = await pool.query(
          "SELECT user_id FROM users WHERE role = 'seller' AND LOWER(shop_name) = LOWER(?)",
          [cleanShop]
        );
        if (dupShop.length > 0) {
          return res.status(409).json({ success: false, message: "A seller with this shop name already exists." });
        }
      }
      if (cleanPhone) {
        const [dupPhone] = await pool.query(
          "SELECT user_id FROM users WHERE role = 'seller' AND phone = ?",
          [cleanPhone]
        );
        if (dupPhone.length > 0) {
          return res.status(409).json({ success: false, message: "A seller with this contact number already exists." });
        }
      }
    }

    if (role === "coordinator") {
      if (cleanPhone) {
        const [dupPhone] = await pool.query(
          "SELECT user_id FROM users WHERE role = 'coordinator' AND phone = $1",
          [cleanPhone]
        );
        if (dupPhone && dupPhone.length > 0) {
          return res.status(409).json({ success: false, message: "A coordinator with this contact number already exists." });
        }
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const sellerCodeSql = role === "seller" ? "'SEL-' || LPAD(nextval('seller_code_seq')::text, 4, '0')" : "NULL";
    const riderCodeSql = role === "rider" ? "'RID-' || LPAD(nextval('rider_code_seq')::text, 4, '0')" : "NULL";
    const [result] = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, role, verification_status, phone, shop_name, zone, vehicle, plate_number, pickup_address, agency, rider_type, first_login, seller_code, rider_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ${sellerCodeSql}, ${riderCodeSql})`,
      [cleanName, cleanEmail, passwordHash, role, verificationStatus, cleanPhone, cleanShop, cleanZone, cleanVehicle, cleanPlate, cleanPickup, cleanAgency, cleanRiderType]
    );

    const createdRow = result[0] || {};

    await logAudit(req.user, {
      category: "Accounts",
      action: "Created account",
      target: cleanEmail,
      detail: `${role}: ${cleanName}${createdRow.seller_code || createdRow.rider_code ? ` (${createdRow.seller_code || createdRow.rider_code})` : ""}${cleanRiderType ? ` [${cleanRiderType} · ${cleanAgency}]` : ""}`
    });

    // Automatically email temporary credentials after successful DB insertion
    const mailRes = await sendAccountCredentialsEmail({
      to: cleanEmail,
      name: cleanName,
      role,
      temporaryPassword: password,
      loginUrl: getLoginUrl(),
    });
    const emailSent = Boolean(mailRes?.sent);

    // Walang password hash, walang plaintext password, at walang token sa sagot
    res.status(201).json({
      success: true,
      message: emailSent
        ? "Account created and credentials email sent."
        : "Account created, but the credentials email could not be delivered. You can retry sending the email.",
      emailSent,
      emailError: emailSent ? null : (mailRes?.error || "Failed to deliver account credentials email."),
      user: {
        user_id: result.insertId,
        name: cleanName,
        email: cleanEmail,
        role,
        verification_status: verificationStatus,
        phone: cleanPhone,
        shop_name: cleanShop,
        zone: cleanZone,
        vehicle: cleanVehicle,
        plate_number: cleanPlate,
        pickup_address: cleanPickup,
        seller_code: createdRow.seller_code || null,
        rider_code: createdRow.rider_code || null,
        agency: cleanAgency,
        rider_type: cleanRiderType,
        first_login: true,
        created_at: createdRow.created_at || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("createUser error:", error?.code || error?.message);
    if (error && error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate account detected (email or Seller ID already exists)." });
    }
    res.status(500).json({ success: false, message: "Failed to create account." });
  }
}

// POST /api/users/:id/resend-credentials-email (coordinator lang)
// Retries sending the account credentials email WITHOUT creating a duplicate account
// and WITHOUT modifying or resetting the user's password.
async function resendCredentialsEmail(req, res) {
  try {
    await ensureUserColumns();
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const { temporaryPassword } = req.body || {};
    if (typeof temporaryPassword !== "string" || temporaryPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "The account's temporary password is required to retry sending the credentials email.",
      });
    }

    const [rows] = await pool.query(
      `SELECT user_id, name, email, role, password_hash, first_login, verification_status
       FROM users
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const targetUser = rows[0];
    const role = String(targetUser.role || "").trim().toLowerCase();
    if (!["seller", "rider", "coordinator"].includes(role)) {
      return res.status(400).json({ success: false, message: "Unsupported account role." });
    }

    if (String(targetUser.verification_status || "").toUpperCase() === "REJECTED") {
      return res.status(403).json({
        success: false,
        message: "Cannot send credentials email for an inactive or disabled account.",
      });
    }

    if (!Boolean(targetUser.first_login)) {
      return res.status(400).json({
        success: false,
        message: "This account has already completed first-time password setup.",
      });
    }

    // Cryptographically verify the submitted temporary password matches the existing stored hash
    // so retries never reset or alter the user's password.
    const matchesStoredHash = await bcrypt.compare(temporaryPassword, targetUser.password_hash);
    if (!matchesStoredHash) {
      return res.status(400).json({
        success: false,
        message: "Temporary password does not match the account's current password.",
      });
    }

    const mailRes = await sendAccountCredentialsEmail({
      to: targetUser.email,
      name: targetUser.name,
      role,
      temporaryPassword,
      loginUrl: getLoginUrl(),
    });

    if (!mailRes?.sent) {
      return res.status(503).json({
        success: false,
        emailSent: false,
        message: mailRes?.error || "Failed to deliver account credentials email. Please try again.",
      });
    }

    await logAudit(req.user, {
      category: "Accounts",
      action: "Resent account credentials email",
      target: targetUser.email,
      detail: `Resent initial login credentials email for ${role}: ${targetUser.name}`,
    });

    return res.json({
      success: true,
      emailSent: true,
      message: "Account credentials email sent successfully.",
    });
  } catch (error) {
    console.error("resendCredentialsEmail error:", error?.code || error?.message);
    return res.status(500).json({
      success: false,
      emailSent: false,
      message: "Failed to retry sending account credentials email.",
    });
  }
}

// PATCH /api/users/:id/profile (coordinator lang)
// Data Privacy Act (RA 10173) & least-privilege enforcement:
// Coordinators may create accounts and manage activation status, but must NEVER
// edit personal information or change/reset passwords of existing Rider/Seller accounts.
async function updateSellerAccount(req, res) {
  try {
    const userId = Number(req.params.id);
    if (Number.isInteger(userId) && userId > 0) {
      await logAudit(req.user, {
        category: "Accounts",
        action: "Blocked account modification attempt",
        target: `User #${userId}`,
        detail:
          "Blocked Coordinator request to modify personal information or credentials of an existing account.",
      }).catch(() => {});
    }

    return res.status(403).json({
      success: false,
      code: "ACCOUNT_MODIFICATION_FORBIDDEN",
      message:
        "Coordinators are not permitted to edit personal information or change passwords for existing Rider or Seller accounts. Account owners must manage their own credentials and profile details.",
    });
  } catch (error) {
    console.error("updateSellerAccount error:", error?.code || error?.message);
    return res.status(403).json({
      success: false,
      code: "ACCOUNT_MODIFICATION_FORBIDDEN",
      message:
        "Coordinators are not permitted to edit personal information or change passwords for existing Rider or Seller accounts.",
    });
  }
}

// GET /api/users?role=seller|rider|coordinator  (coordinator lang)
async function listUsers(req, res) {
  try {
    await ensureUserColumns();
    await purgeExpiredDeactivatedAccounts().catch(() => {});
    const role = req.query.role;
    const [rows] = ROLES.includes(role)
      ? await pool.query(
          `SELECT ${USER_FIELDS}
           FROM users u
           ${USER_JOINS}
           WHERE u.role = ? AND u.is_deleted = FALSE
           ORDER BY u.created_at DESC`,
          [role]
        )
      : await pool.query(
          `SELECT ${USER_FIELDS}
           FROM users u
           ${USER_JOINS}
           WHERE u.is_deleted = FALSE
           ORDER BY u.created_at DESC`
        );

    res.json({ success: true, users: rows });
  } catch (error) {
    console.error("listUsers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve accounts."
    });
  }
}

async function reviewSeller(req, res) {
  try {
    await ensureUserColumns();
    const userId = Number(req.params.id);
    const rawStatus = String(req.body?.status || "").trim();
    const normalizedUpper = rawStatus.toUpperCase();
    const status =
      normalizedUpper === "APPROVED" || normalizedUpper === "ACTIVE"
        ? "APPROVED"
        : normalizedUpper === "REJECTED" || normalizedUpper === "INACTIVE"
          ? "REJECTED"
          : "";

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED."
      });
    }

    // First, check & process expiration for this specific account on server clock
    const purgeResult = await purgeExpiredDeactivatedAccounts({ userId }).catch(() => ({ removedCount: 0 }));
    if (purgeResult.removedCount > 0) {
      return res.status(410).json({
        success: false,
        code: "RECOVERY_EXPIRED",
        message: "This account's 7-day recovery period has expired and the account has been permanently removed."
      });
    }

    const [foundRows] = await pool.query(
      `SELECT user_id, name, email, role, verification_status, seller_code, rider_code,
              is_deleted, deactivated_at, recovery_expires_at
         FROM users
        WHERE user_id = ? AND role IN ('seller', 'rider')
        LIMIT 1`,
      [userId]
    );

    if (!foundRows.length) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    const targetUser = foundRows[0];
    if (Boolean(targetUser.is_deleted)) {
      return res.status(410).json({
        success: false,
        code: "ACCOUNT_DELETED",
        message: "This account has been permanently removed and cannot be reactivated."
      });
    }

    const currentStatus = String(targetUser.verification_status || "").toUpperCase();
    const roleLabel = getRoleLabel(targetUser.role);
    const accountCode = getAccountCode(targetUser);

    if (status === "REJECTED") {
      // Prevent repeated deactivation requests and protect the original 7-day recovery window
      if (currentStatus === "REJECTED") {
        return res.status(409).json({
          success: false,
          code: "ALREADY_INACTIVE",
          message: "This account is already inactive."
        });
      }

      const [updated] = await pool.query(
        `UPDATE users
            SET verification_status = 'REJECTED',
                deactivated_at = NOW(),
                deactivated_by = ?,
                recovery_expires_at = NOW() + INTERVAL '${RECOVERY_PERIOD_DAYS} days',
                reactivated_at = NULL,
                reactivated_by = NULL,
                session_version = COALESCE(session_version, 1) + 1,
                updated_at = NOW()
          WHERE user_id = ?
            AND role IN ('seller', 'rider')
            AND is_deleted = FALSE
            AND verification_status <> 'REJECTED'`,
        [req.user.user_id, userId]
      );

      if (updated.affectedRows === 0) {
        return res.status(409).json({
          success: false,
          code: "ALREADY_INACTIVE",
          message: "This account is already inactive."
        });
      }

      // Revoke any pending OTPs or password reset tokens immediately
      await pool.query("DELETE FROM email_otps WHERE user_id = ?", [userId]).catch(() => {});
      await pool.query("DELETE FROM password_resets WHERE user_id = ?", [userId]).catch(() => {});

      const [freshRows] = await pool.query(
        `SELECT ${USER_FIELDS} FROM users u ${USER_JOINS} WHERE u.user_id = ?`,
        [userId]
      );
      const updatedUser = freshRows[0] || null;
      const expiryIso = updatedUser?.recovery_expires_at
        ? new Date(updatedUser.recovery_expires_at).toISOString()
        : null;

      await logAudit(req.user, {
        category: "Accounts",
        action: "Account deactivated",
        target: `${roleLabel}: ${targetUser.name} (${accountCode})`,
        detail: `${roleLabel} account "${targetUser.name}" (${accountCode}) deactivated by ${req.user.name}. Access revoked immediately; ${RECOVERY_PERIOD_DAYS}-day recovery period ends ${expiryIso || "in 7 days"}.`,
        sellerId: targetUser.role === "seller" ? userId : null,
        riderId: targetUser.role === "rider" ? userId : null,
      });

      return res.json({
        success: true,
        message: `${targetUser.name}'s account has been deactivated. It can be reactivated within ${RECOVERY_PERIOD_DAYS} days.`,
        user_id: userId,
        verification_status: "REJECTED",
        deactivated_at: updatedUser?.deactivated_at || null,
        recovery_expires_at: updatedUser?.recovery_expires_at || null,
        user: updatedUser
      });
    }

    // status === "APPROVED" (Reactivation during the 7-day recovery period)
    if (currentStatus === "APPROVED") {
      return res.status(409).json({
        success: false,
        code: "ALREADY_ACTIVE",
        message: "This account is already active."
      });
    }

    // Atomically enforce server-side recovery expiration deadline (recovery_expires_at > NOW())
    const [updated] = await pool.query(
      `UPDATE users
          SET verification_status = 'APPROVED',
              deactivated_at = NULL,
              deactivated_by = NULL,
              recovery_expires_at = NULL,
              reactivated_at = NOW(),
              reactivated_by = ?,
              updated_at = NOW()
        WHERE user_id = ?
          AND role IN ('seller', 'rider')
          AND is_deleted = FALSE
          AND (recovery_expires_at IS NULL OR recovery_expires_at > NOW())`,
      [req.user.user_id, userId]
    );

    if (updated.affectedRows === 0) {
      await purgeExpiredDeactivatedAccounts({ userId }).catch(() => {});
      return res.status(410).json({
        success: false,
        code: "RECOVERY_EXPIRED",
        message: "This account's 7-day recovery period has expired and the account has been permanently removed."
      });
    }

    const [freshRows] = await pool.query(
      `SELECT ${USER_FIELDS} FROM users u ${USER_JOINS} WHERE u.user_id = ?`,
      [userId]
    );
    const updatedUser = freshRows[0] || null;

    await logAudit(req.user, {
      category: "Accounts",
      action: "Account reactivated",
      target: `${roleLabel}: ${targetUser.name} (${accountCode})`,
      detail: `${roleLabel} account "${targetUser.name}" (${accountCode}) reactivated by ${req.user.name} during the recovery period.`,
      sellerId: targetUser.role === "seller" ? userId : null,
      riderId: targetUser.role === "rider" ? userId : null,
    });

    return res.json({
      success: true,
      message: `${targetUser.name}'s account has been reactivated.`,
      user_id: userId,
      verification_status: "APPROVED",
      reactivated_at: updatedUser?.reactivated_at || null,
      user: updatedUser
    });
  } catch (error) {
    console.error("reviewSeller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update account status."
    });
  }
}

async function cleanupExpiredAccounts(req, res) {
  try {
    const result = await purgeExpiredDeactivatedAccounts({ force: true });
    return res.json({
      success: true,
      removedCount: result.removedCount,
      removed: result.removed,
    });
  } catch (error) {
    console.error("cleanupExpiredAccounts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clean up expired inactive accounts."
    });
  }
}

const MY_PROFILE_FIELDS = `user_id, name, email, role, verification_status,
                  phone, avatar, shop_name, zone, vehicle, plate_number,
                  seller_code, pickup_address, rider_code, agency, rider_type, created_at, updated_at`;

// GET /api/users/me -> load the authenticated user's own profile from DB
async function getMyProfile(req, res) {
  try {
    await ensureUserColumns();
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const [rows] = await pool.query(
      `SELECT ${MY_PROFILE_FIELDS} FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to load profile." });
  }
}

// PATCH /api/users/me (and PUT /api/users/me) -> self-service profile update.
// Only permitted fields (name, email, phone, avatar) can be edited.
// Protected Coordinator-managed fields (role, rider_code, agency, rider_type, verification_status) are never modified here.
async function updateMyProfile(req, res) {
  try {
    await ensureUserColumns();
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const [found] = await pool.query(
      "SELECT user_id, role FROM users WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!found.length) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    const myRole = found[0].role;

    const { name, email, phone, avatar } = req.body || {};
    const sets = [];
    const vals = [];

    if (name !== undefined) {
      const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
      if (!cleanName) {
        return res.status(400).json({ success: false, message: "Full name is required." });
      }
      sets.push("name = ?");
      vals.push(cleanName);
    }

    if (email !== undefined) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }
      const [dup] = await pool.query(
        "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) AND user_id <> ?",
        [cleanEmail, userId]
      );
      if (dup.length) {
        return res.status(409).json({ success: false, message: "Email is already registered to another account." });
      }
      sets.push("email = ?");
      vals.push(cleanEmail);
    }

    if (phone !== undefined) {
      const p = cleanPhoneValue(phone);
      if (p && !/^09\d{9}$/.test(p)) {
        return res.status(400).json({
          success: false,
          message: "Contact number must be a valid Philippine mobile number (e.g. +63 917 123 4567 or 09171234567).",
        });
      }
      if (p) {
        const [dup] = await pool.query(
          "SELECT user_id FROM users WHERE role = ? AND phone = ? AND user_id <> ?",
          [myRole, p, userId]
        );
        if (dup.length) {
          return res.status(409).json({
            success: false,
            message: `This contact number is already used by another ${myRole} account.`,
          });
        }
      }
      sets.push("phone = ?");
      vals.push(p);
    }

    if (avatar !== undefined) {
      if (avatar === null || avatar === "") {
        sets.push("avatar = ?");
        vals.push(null);
      } else if (typeof avatar === "string" && avatar.startsWith("data:image/")) {
        if (avatar.length > 250000) {
          return res.status(400).json({
            success: false,
            message: "Profile photo is too large. Please choose a smaller image.",
          });
        }
        sets.push("avatar = ?");
        vals.push(avatar);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid profile photo format.",
        });
      }
    }

    if (!sets.length) {
      return res.status(400).json({ success: false, message: "No profile changes were provided." });
    }

    vals.push(userId);
    await pool.query(
      `UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE user_id = ?`,
      vals
    );

    const updatedFields = sets.map((x) => x.split(" ")[0]);
    try {
      await logAudit(req.user, {
        category: "Settings",
        action: "Updated profile",
        target: String(userId),
        detail: `Fields: ${updatedFields.join(", ")}`,
      });
    } catch {
      /* non-fatal audit log */
    }

    const [rows] = await pool.query(
      `SELECT ${MY_PROFILE_FIELDS} FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return res.json({
      success: true,
      message: "Account updated successfully.",
      user: rows[0],
    });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    if (error && error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate email or contact number detected." });
    }
    return res.status(500).json({ success: false, message: "Failed to update account details." });
  }
}

module.exports = {
  ensureUserColumns,
  listContacts,
  createUser,
  resendCredentialsEmail,
  listUsers,
  reviewSeller,
  cleanupExpiredAccounts,
  updateSellerAccount,
  getMyProfile,
  updateMyProfile,
};
