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
  `);
  userColumnsReady = true;
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
    const cleanPhone = phone ? String(phone).trim().slice(0, 50) : null;
    const cleanShop = shop_name ? String(shop_name).trim().slice(0, 150) : null;
    const cleanZone = zone ? String(zone).trim().slice(0, 100) : null;
    const cleanVehicle = vehicle ? String(vehicle).trim().slice(0, 100) : null;
    const cleanPlate = plate_number ? String(plate_number).trim().slice(0, 50) : null;

    const [existing] = await pool.query("SELECT user_id FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, role, verification_status, phone, shop_name, zone, vehicle, plate_number)
       VALUES (?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, ?)`,
      [cleanName, cleanEmail, passwordHash, role, cleanPhone, cleanShop, cleanZone, cleanVehicle, cleanPlate]
    );

    const createdRow = result[0] || {};

    await logAudit(req.user, {
      category: "Accounts",
      action: "Created account",
      target: cleanEmail,
      detail: `${role}: ${cleanName}`
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
        verification_status: "APPROVED",
        phone: cleanPhone,
        shop_name: cleanShop,
        zone: cleanZone,
        vehicle: cleanVehicle,
        plate_number: cleanPlate,
        created_at: createdRow.created_at || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ success: false, message: "Failed to create account." });
  }
}

// GET /api/users?role=seller|rider|coordinator  (coordinator lang)
async function listUsers(req, res) {
  try {
    await ensureUserColumns();
    const role = req.query.role;
    const [rows] = ROLES.includes(role)
      ? await pool.query(
          `SELECT user_id, name, email, role, verification_status,
                  phone, shop_name, zone, vehicle, plate_number,
                  created_at, updated_at
           FROM users
           WHERE role = ?
           ORDER BY created_at DESC`,
          [role]
        )
      : await pool.query(
          `SELECT user_id, name, email, role, verification_status,
                  phone, shop_name, zone, vehicle, plate_number,
                  created_at, updated_at
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

module.exports = { listContacts, createUser, listUsers, reviewSeller };
