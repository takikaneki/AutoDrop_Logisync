require("dotenv").config();
const { pool } = require("../src/config/database");

async function main() {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, name, email, role, verification_status, created_at FROM users ORDER BY user_id ASC"
    );
    console.table(rows);
  } catch (error) {
    console.error("Database check failed:", error.message);
  } finally {
    await pool.end();
  }
}

main();
