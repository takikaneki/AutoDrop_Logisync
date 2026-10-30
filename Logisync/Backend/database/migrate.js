// Awtomatikong migration: `npm run migrate`
// Ligtas na patakbuhin kahit ilang beses: nilalaktawan nito ang nagawa na.
// Ginagamit ang parehong DB settings sa .env na gamit ng server.
const { pool } = require("../src/config/database");

const hasColumn = async (table, column) => {
  const [rows] = await pool.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows.length > 0;
};

const hasConstraint = async (table, name) => {
  const [rows] = await pool.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
    [table, name]
  );
  return rows.length > 0;
};

async function addColumn(table, column, definition) {
  if (await hasColumn(table, column)) return console.log(`  - ${table}.${column}: nandiyan na`);
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  + ${table}.${column}: idinagdag`);
}

async function main() {
  console.log("Running migration...");

  await addColumn("parcels", "transaction_number", "VARCHAR(100) NULL UNIQUE");
  await addColumn("parcels", "rider_id", "INT NULL");
  await addColumn("parcels", "delivery_status", "ENUM('TO_DELIVER', 'DELIVERED', 'FAILED') NULL");
  await addColumn("parcels", "delivery_note", "VARCHAR(500) NULL");
  await addColumn("parcels", "scanned_at", "DATETIME NULL");
  await addColumn("parcels", "delivered_at", "DATETIME NULL");

  if (await hasConstraint("parcels", "fk_parcel_rider")) {
    console.log("  - fk_parcel_rider: nandiyan na");
  } else {
    await pool.query(
      "ALTER TABLE parcels ADD CONSTRAINT fk_parcel_rider FOREIGN KEY (rider_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE"
    );
    console.log("  + fk_parcel_rider: idinagdag");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id INT NULL,
      actor_name VARCHAR(100) NOT NULL,
      actor_role ENUM('seller', 'coordinator', 'rider') NOT NULL,
      category VARCHAR(40) NOT NULL,
      action VARCHAR(100) NOT NULL,
      target VARCHAR(100) NULL,
      detail VARCHAR(500) NULL,
      seller_id INT NULL,
      rider_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_actor (actor_id),
      INDEX idx_audit_seller (seller_id),
      INDEX idx_audit_rider (rider_id),
      INDEX idx_audit_created (created_at)
    )
  `);
  console.log("  - audit_logs: handa na");

  console.log("Migration finished.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
