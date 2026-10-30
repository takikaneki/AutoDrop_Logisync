USE synclink_db;

-- Demo password for all seed users: password123
-- The hash below was generated with bcryptjs using 10 rounds.
INSERT INTO users (name, email, password_hash, role) VALUES
('ABC Store', 'seller@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'seller'),
('Admin Coordinator', 'coordinator@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'coordinator'),
('Rider One', 'rider@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'rider')
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role);

INSERT INTO parcels
(parcel_id, seller_id, receiver_name, receiver_contact, contents, status, verification_status)
SELECT
  'PX123456',
  user_id,
  'Juan Dela Cruz',
  '09123456789',
  'Shoes',
  'WAITING_FOR_VIDEO',
  'PENDING'
FROM users
WHERE email = 'seller@example.com'
AND NOT EXISTS (SELECT 1 FROM parcels WHERE parcel_id = 'PX123456');