const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

function createToken(user) {
  return jwt.sign(
    { user_id: user.user_id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}


async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role = "seller";

    const [result] = await pool.query(
  `INSERT INTO users
   (name, email, password_hash, role, verification_status)
   VALUES (?, ?, ?, ?, ?)`,
  [cleanName, cleanEmail, passwordHash, role, "PENDING"]
);

    const user = {
      user_id: result.insertId,
      name: cleanName,
      email: cleanEmail,
      role
    };

    return res.status(201).json({
      success: true,
       message: "Registration successful. Your account is pending Coordinator approval.",
  user: {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    verification_status: "PENDING"}
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
}
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const [rows] = await pool.query(
  `SELECT user_id, name, email, password_hash, role, verification_status
   FROM users
   WHERE email = ?`,
  [email.trim().toLowerCase()]
);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (user.role === "seller" && user.verification_status !== "APPROVED") {
  if (user.verification_status === "REJECTED") {
    return res.status(403).json({
      success: false,
      message: "Your seller registration was not approved. Please contact the Coordinator."
    });
  }

  return res.status(403).json({
    success: false,
    message: "Your seller account is pending Coordinator approval."
  });
}

    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.json({ success: true, message: "Login successful.", token: createToken(safeUser), user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Login failed." });
  }
}

function me(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { register, login, me };