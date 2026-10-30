# SyncLink Backend

Parcel Validation and Communication Management System.

## Technology

- Node.js
- Express.js
- MySQL
- bcryptjs
- JSON Web Token (JWT)
- Multer
- Local video storage

## Requirements

- Node.js 18+
- MySQL Server
- Existing React + Tailwind frontend

## 1. Install

```bash
npm install
```

## 2. Create the database

Open MySQL Workbench or another MySQL client and run:

```sql
SOURCE database/schema.sql;
```

Then seed the demo data:

```sql
SOURCE database/seed.sql;
```

If your MySQL client does not support SOURCE, open and run the SQL files manually.

## 3. Environment

Copy `.env.example` to `.env` and update your MySQL password:

```text
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=synclink_db
JWT_SECRET=change_this_to_a_long_random_secret
UPLOAD_DIR=uploads/videos
MAX_VIDEO_SIZE_MB=50
```

## 4. Start

Development:

```bash
npm run dev
```

Normal:

```bash
npm start
```

Health check in a browser:

```text
http://localhost:5000/api/health
```

Expected:

```json
{
  "success": true,
  "message": "SyncLink backend is running"
}
```

## Demo accounts

All seeded demo accounts use:

```text
password123
```

Seller:
```text
seller@example.com
```

Coordinator:
```text
coordinator@example.com
```

Rider:
```text
rider@example.com
```

## Main API routes

Authentication:
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`

Parcel:
- GET `/api/parcels/:parcelId`
- GET `/api/parcels/seller/:parcelId`
- POST `/api/parcels/seller/:parcelId/video`
- GET `/api/parcels/coordinator/:parcelId`
- POST `/api/parcels/coordinator/:parcelId/verify`
- POST `/api/parcels/coordinator/:parcelId/reject`
- POST `/api/parcels/coordinator/:parcelId/request-reupload`
- GET `/api/parcels/videos/:videoId`

Communication:
- GET `/api/messages`
- POST `/api/messages`
- PATCH `/api/messages/:messageId/read`

## Video upload

The seller sends a `multipart/form-data` request with:

```text
video = <video file>
```

Videos are stored locally in:

```text
uploads/videos/
```

## Authentication

Protected routes require:

```text
Authorization: Bearer <JWT_TOKEN>
```

The backend enforces role restrictions. Rider responses do not expose seller video proof or coordinator verification records.

## Important

This project is designed for local development and defense. No cloud database or deployment is required at this stage.
