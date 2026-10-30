
require("dotenv").config();

const { pool } = require("../src/config/database");

async function main() {
  try {
    const [rows] = await pool.query("DESCRIBE users");
    console.table(rows);
  } catch (error) {
    console.error("Database check failed:", error.message);
  } finally {
    await pool.end();
  }
}

main();
