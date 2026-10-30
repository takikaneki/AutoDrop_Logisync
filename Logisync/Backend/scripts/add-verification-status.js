require("dotenv").config();
const { rawPool } = require("../src/config/database");

async function main() {
  const client = await rawPool.connect();
  try {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED';
    `);
    console.log("Verification status column verified/added successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await rawPool.end();
  }
}

main();
