const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { logAudit } = require("../utils/audit");

// GET /api/users/contacts
// Sino ang pwedeng i-message ng naka-login na user (kapareho ng rule sa messageController):
//   coordinator -> lahat ng seller at rider
//   seller/rider -> mga coordinator lang
// Walang email o password hash na lumalabas para sa seller/rider.
async function listContacts(req, res) {
  try {
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
    const { name, email, password } = req.body || {};
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

    const [existing] = await pool.query("SELECT user_id FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [cleanName, cleanEmail, passwordHash, role]
    );

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
      user: { user_id: result.insertId, name: cleanName, email: cleanEmail, role }
    });
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ success: false, message: "Failed to create account." });
  }
}

// GET /api/users?role=seller|rider|coordinator  (coordinator lang)

async function listUsers(req, res) {
  try {
    const role = req.query.role;
    const [rows] = ROLES.includes(role)
      ? await pool.query(
          `SELECT user_id, name, email, role, verification_status, created_at
           FROM users
           WHERE role = ?
           ORDER BY created_at DESC`,
          [role]
        )
      : await pool.query(
          `SELECT user_id, name, email, role, verification_status, created_at
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
    const userId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
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
       SET verification_status = ?
       WHERE user_id = ? AND role = 'seller'`,
      [status, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    await logAudit(req.user, {
      category: "Accounts",
      action: `Seller ${status.toLowerCase()}`,
      target: String(userId),
      detail: `Seller verification status changed to ${status}.`
    });

    return res.json({
      success: true,
      message: `Seller ${status.toLowerCase()} successfully.`
    });
  } catch (error) {
    console.error("reviewSeller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update seller status."
    });
  }
}


module.exports = { listContacts, createUser, listUsers, reviewSeller };
