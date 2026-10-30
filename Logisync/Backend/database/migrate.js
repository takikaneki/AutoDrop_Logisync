// PostgreSQL / Neon Migration script: `npm run migrate`
// Ligtas patakbuhin kahit ilang beses (idempotent gamit ang IF NOT EXISTS).
const fs = require("fs");
const path = require("path");
const { rawPool, pool } = require("../src/config/database");

async function main() {
  console.log("Running PostgreSQL / Neon migration...");

  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const client = await rawPool.connect();
  try {
    console.log("Executing schema.sql...");
    await client.query(schemaSql);
    console.log("Tables and triggers ready.");

    // Check if seed data is needed
    const [users] = await pool.query("SELECT COUNT(*) AS count FROM users");
    const count = parseInt(users[0]?.count || 0, 10);

    if (count === 0) {
      console.log("Seeding initial users and parcel...");
      const seedPath = path.join(__dirname, "seed.sql");
      const seedSql = fs.readFileSync(seedPath, "utf8");
      await client.query(seedSql);
      console.log("Seed data created successfully.");
    } else {
      console.log(`Database already has ${count} users. Skipping seed.`);
    }

    console.log("Migration finished successfully.");
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
