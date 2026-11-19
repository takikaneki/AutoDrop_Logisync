const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  listAnnouncements,
  createAnnouncement,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/", authenticateToken, listAnnouncements);
router.post("/", authenticateToken, authorizeRoles("coordinator"), createAnnouncement);

module.exports = router;
