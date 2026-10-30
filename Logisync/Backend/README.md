# SyncLink Backend

Parcel Validation and Communication Management System.

## Technology

- Node.js
- Express.js
- PostgreSQL / Neon
- bcryptjs
- JSON Web Token (JWT)
- Multer
- Local video storage

## Requirements

- Node.js 18+
- PostgreSQL Server or Neon PostgreSQL (Cloud)
- Existing React + Tailwind frontend

## 1. Install

```bash
cd Logisync/Backend
npm install
```

## 2. Configure Environment

Copy `.env.example` to `.env`:

```env
PORT=5000

# Para sa Neon / Cloud PostgreSQL:
# Kunin sa Neon Console -> Connection details -> Connection string
DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require

# Kung local PostgreSQL ang gagamitin:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=synclink_db

JWT_SECRET=change_this_to_a_long_random_secret
UPLOAD_DIR=uploads/videos
MAX_VIDEO_SIZE_MB=50
```

## 3. Database Migration / Setup

Patakbuhin ang migration script upang awtomatikong magawa ang mga tables, triggers, at seed demo accounts:

```bash
npm run migrate
```

O kaya, maaari ring i-paste ang nilalaman ng `database/schema.sql` at `database/seed.sql` sa Neon SQL Editor.

## 4. Start the Server

Development mode:

```bash
npm run dev
```

Production / Normal mode:

```bash
npm start
```

Health check:
```
http://localhost:5000/api/health
```

## Demo accounts

Lahat ng seeded accounts ay may password na:
```
password123
```

- Seller: `seller@example.com`
- Coordinator: `coordinator@example.com`
- Rider: `rider@example.com`
