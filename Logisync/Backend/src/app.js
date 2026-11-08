require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const parcelRoutes = require("./routes/parcelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const complaintRoutes = require("./routes/complaintRoutes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ success: true, message: "SyncLink backend is running" });
});

app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/parcels", "/parcels"], parcelRoutes);
app.use(["/api/messages", "/messages"], messageRoutes);
app.use(["/api/users", "/users"], userRoutes);
app.use(["/api/audit-logs", "/audit-logs"], auditRoutes);
app.use(["/api/complaints", "/complaints"], complaintRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "Video file is too large." });
  }

  if (err.message === "Only supported video files are allowed.") {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({ success: false, message: "Internal server error." });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

module.exports = app;