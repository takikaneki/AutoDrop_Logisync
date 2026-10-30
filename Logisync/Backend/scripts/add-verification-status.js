
const { pool } = require("../src/config/database");

async function main() {
  try {
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM users LIKE 'verification_status'"
    );

    if (columns.length > 0) {
      console.log("Column already exists. No changes made.");
      return;
    }

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN verification_status
      ENUM('PENDING', 'APPROVED', 'REJECTED')
      NOT NULL DEFAULT 'APPROVED'
      AFTER role
    `);

    console.log("Verification status column added successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
