-- Patakbuhin ISANG BESES lang sa phpMyAdmin (tab "SQL") habang napili ang database na synclink_db.
-- Kung may "Duplicate column name" na error, ibig sabihin ay nagawa na ito dati.
-- (Kung ang transaction_number column ay wala pa sa parcels ninyo, idagdag muna:
--   ALTER TABLE parcels ADD COLUMN transaction_number VARCHAR(100) NULL UNIQUE; )

USE synclink_db;

-- 1) Delivery ng rider (additive lang: walang nabagong dating column)
ALTER TABLE parcels
  ADD COLUMN rider_id INT NULL,
  ADD COLUMN delivery_status ENUM('TO_DELIVER', 'DELIVERED', 'FAILED') NULL,
  ADD COLUMN delivery_note VARCHAR(500) NULL,
  ADD COLUMN scanned_at DATETIME NULL,
  ADD COLUMN delivered_at DATETIME NULL,
  ADD CONSTRAINT fk_parcel_rider FOREIGN KEY (rider_id)
    REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Audit log (isang table para sa Audit Log at Recent Activity)
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  actor_name VARCHAR(100) NOT NULL,
  actor_role ENUM('seller', 'coordinator', 'rider') NOT NULL,
  category VARCHAR(40) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(100) NULL,
  detail VARCHAR(500) NULL,
  seller_id INT NULL,   -- seller na apektado (para makita niya ang mga nangyari sa parcel niya)
  rider_id INT NULL,    -- rider na apektado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_seller (seller_id),
  INDEX idx_audit_rider (rider_id),
  INDEX idx_audit_created (created_at)
);
