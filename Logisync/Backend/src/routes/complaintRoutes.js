const express = require("express");
const {
  listComplaints,
  createComplaint,
  markComplaintsRead,
  updateComplaint,
  getUnreadCount,
} = require("../controllers/complaintController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, listComplaints);
router.post("/", authenticateToken, createComplaint);
router.get("/unread-count", authenticateToken, authorizeRoles("coordinator"), getUnreadCount);
router.post("/mark-read", authenticateToken, authorizeRoles("coordinator"), markComplaintsRead);
router.patch("/mark-read", authenticateToken, authorizeRoles("coordinator"), markComplaintsRead);
router.patch("/:id", authenticateToken, authorizeRoles("coordinator"), updateComplaint);

module.exports = router;

