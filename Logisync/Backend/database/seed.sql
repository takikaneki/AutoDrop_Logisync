-- Seed users for PostgreSQL / Neon
-- Demo password for all seed users: password123 (bcrypt hash)
INSERT INTO users (name, email, password_hash, role, verification_status) VALUES
('ABC Store', 'seller@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'seller', 'APPROVED'),
('Admin Coordinator', 'coordinator@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'coordinator', 'APPROVED'),
('Rider One', 'rider@example.com', '$2b$10$Q9b0x9b4cYqYqQy8b2r7ue0d8c8mM0s4gZ1w3V4f3kVQnJf7gV8uK', 'rider', 'APPROVED')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, 
    role = EXCLUDED.role,
    verification_status = EXCLUDED.verification_status;

-- Seed sample parcel
INSERT INTO parcels
(parcel_id, transaction_number, seller_id, receiver_name, receiver_contact, contents, status, verification_status)
SELECT
  'PX123456',
  'TXN-PX123456',
  user_id,
  'Juan Dela Cruz',
  '09123456789',
  'Shoes',
  'WAITING_FOR_VIDEO',
  'PENDING'
FROM users
WHERE email = 'seller@example.com'
ON CONFLICT (parcel_id) DO NOTHING;
