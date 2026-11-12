const bcrypt = require("bcryptjs");
const { pool, rawPool } = require("../config/database");
const { logAudit } = require("../utils/audit");

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
  userColumnsReady = true;
}

const USER_FIELDS = `user_id, name, email, role, verification_status,
                  phone, shop_name, zone, vehicle, plate_number,
                  seller_code, pickup_address, rider_code, agency, rider_type, created_at, updated_at`;

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
    const isCoordinator = req.user.role === "coordinator";

    const [rows] = isCoordinator
      ? await pool.query(
          `SELECT user_id, name, email, role FROM users
           WHERE role IN ('seller', 'rider') ORDER BY name ASC`
        )
      : await pool.query(
          `SELECT user_id, name, role FROM users
           WHERE role = 'coordinator' ORDER BY name ASC`
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
      cleanRiderType = normalizeRiderType(req.body?.rider_type);
      if (!cleanAgency) {
        return res.status(400).json({ success: false, message: "Assigned agency is required for riders." });
      }
      if (!cleanRiderType) {
        return res.status(400).json({ success: false, message: "Rider type is required: First Mile (FM) or Last Mile (LM)." });
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

    const passwordHash = await bcrypt.hash(password, 10);
    const sellerCodeSql = role === "seller" ? "'SEL-' || LPAD(nextval('seller_code_seq')::text, 4, '0')" : "NULL";
    const riderCodeSql = role === "rider" ? "'RID-' || LPAD(nextval('rider_code_seq')::text, 4, '0')" : "NULL";
    const [result] = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, role, verification_status, phone, shop_name, zone, vehicle, plate_number, pickup_address, agency, rider_type, seller_code, rider_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${sellerCodeSql}, ${riderCodeSql})`,
      [cleanName, cleanEmail, passwordHash, role, verificationStatus, cleanPhone, cleanShop, cleanZone, cleanVehicle, cleanPlate, cleanPickup, cleanAgency, cleanRiderType]
    );

    const createdRow = result[0] || {};

    await logAudit(req.user, {
      category: "Accounts",
      action: "Created account",
      target: cleanEmail,
      detail: `${role}: ${cleanName}${createdRow.seller_code || createdRow.rider_code ? ` (${createdRow.seller_code || createdRow.rider_code})` : ""}${cleanRiderType ? ` [${cleanRiderType} · ${cleanAgency}]` : ""}`
    });

    // Walang password hash at walang token sa sagot
    res.status(201).json({
      success: true,
      message: "Account created.",
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
        created_at: createdRow.created_at || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("createUser error:", error);
    if (error && error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate account detected (email or Seller ID already exists)." });
    }
    res.status(500).json({ success: false, message: "Failed to create account." });
  }
}

// PATCH /api/users/:id/profile  (coordinator lang) -> i-edit ang seller account
async function updateSellerAccount(req, res) {
  try {
    await ensureUserColumns();
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }
    const [found] = await pool.query("SELECT user_id, role FROM users WHERE user_id = ?", [userId]);
    if (!found.length || !["seller", "rider"].includes(found[0].role)) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    const targetRole = found[0].role;

    const { name, email, phone, shop_name, pickup_address, status, password, agency, rider_type, zone, vehicle, plate_number } = req.body || {};
    const sets = [];
    const vals = [];

    if (targetRole === "rider") {
      if (agency !== undefined) {
        const a = String(agency).trim().slice(0, 150);
        if (!a) return res.status(400).json({ success: false, message: "Assigned agency is required for riders." });
        sets.push("agency = ?"); vals.push(a);
      }
      if (rider_type !== undefined) {
        const t = normalizeRiderType(rider_type);
        if (!t) return res.status(400).json({ success: false, message: "Rider type must be First Mile (FM) or Last Mile (LM)." });
        sets.push("rider_type = ?"); vals.push(t);
      }
      if (zone !== undefined) { sets.push("zone = ?"); vals.push(String(zone).trim().slice(0, 100) || null); }
      if (vehicle !== undefined) { sets.push("vehicle = ?"); vals.push(String(vehicle).trim().slice(0, 100) || null); }
      if (plate_number !== undefined) { sets.push("plate_number = ?"); vals.push(String(plate_number).trim().slice(0, 50) || null); }
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Name is required." });
      }
      sets.push("name = ?"); vals.push(name.trim().slice(0, 100));
    }
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }
      const [dup] = await pool.query("SELECT user_id FROM users WHERE email = ? AND user_id <> ?", [e, userId]);
      if (dup.length) return res.status(409).json({ success: false, message: "Email is already registered." });
      sets.push("email = ?"); vals.push(e);
    }
    if (phone !== undefined) {
      const p = cleanPhoneValue(phone);
      if (p && !/^09\d{9}$/.test(p)) {
        return res.status(400).json({ success: false, message: "Contact number must be a valid 11-digit mobile number starting with 09 (numbers only)." });
      }
      if (p) {
        const [dup] = await pool.query("SELECT user_id FROM users WHERE role = ? AND phone = ? AND user_id <> ?", [targetRole, p, userId]);
        if (dup.length) return res.status(409).json({ success: false, message: `A ${targetRole} with this contact number already exists.` });
      }
      sets.push("phone = ?"); vals.push(p);
    }
    if (targetRole === "seller" && shop_name !== undefined) {
      const s = String(shop_name).trim().slice(0, 150);
      if (s) {
        const [dup] = await pool.query("SELECT user_id FROM users WHERE role = 'seller' AND LOWER(shop_name) = LOWER(?) AND user_id <> ?", [s, userId]);
        if (dup.length) return res.status(409).json({ success: false, message: "A seller with this shop name already exists." });
      }
      sets.push("shop_name = ?"); vals.push(s || null);
    }
    if (targetRole === "seller" && pickup_address !== undefined) {
      sets.push("pickup_address = ?"); vals.push(String(pickup_address).trim().slice(0, 300) || null);
    }
    if (status !== undefined) {
      sets.push("verification_status = ?"); vals.push(statusToVerification(status));
    }
    if (password) {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
      }
      sets.push("password_hash = ?"); vals.push(await bcrypt.hash(password, 10));
    }
    if (!sets.length) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    vals.push(userId);
    await pool.query(`UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE user_id = ?`, vals);

    await logAudit(req.user, {
      category: "Accounts",
      action: `Updated ${targetRole} account`,
      target: String(userId),
      detail: `Fields: ${sets.map((x) => x.split(" ")[0]).join(", ")}`
    });

    const [rows] = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE user_id = ?`, [userId]);
    res.json({ success: true, message: "Seller account updated.", user: rows[0] });
  } catch (error) {
    console.error("updateSellerAccount error:", error);
    if (error && error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate value detected." });
    }
    res.status(500).json({ success: false, message: "Failed to update seller account." });
  }
}

// GET /api/users?role=seller|rider|coordinator  (coordinator lang)
async function listUsers(req, res) {
  try {
    await ensureUserColumns();
    const role = req.query.role;
    const [rows] = ROLES.includes(role)
      ? await pool.query(
          `SELECT ${USER_FIELDS}
           FROM users
           WHERE role = ?
           ORDER BY created_at DESC`,
          [role]
        )
      : await pool.query(
          `SELECT ${USER_FIELDS}
           FROM users
           ORDER BY created_at DESC`
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
    const { status } = req.body || {};

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

    const [result] = await pool.query(
      `UPDATE users
       SET verification_status = ?, updated_at = NOW()
       WHERE user_id = ? AND role IN ('seller', 'rider')`,
      [status, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    await logAudit(req.user, {
      category: "Accounts",
      action: status === "APPROVED" ? "Account activated" : "Account suspended",
      target: String(userId),
      detail: `Account verification status changed to ${status}.`
    });

    return res.json({
      success: true,
      message: `Account ${status === "APPROVED" ? "activated" : "suspended"} successfully.`,
      user_id: userId,
      verification_status: status
    });
  } catch (error) {
    console.error("reviewSeller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update account status."
    });
  }
}

module.exports = { listContacts, createUser, listUsers, reviewSeller, updateSellerAccount };
