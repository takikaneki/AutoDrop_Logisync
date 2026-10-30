const express = require("express");
const { listAuditLogs } = require("../controllers/auditController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Ang controller mismo ang nagsasala ayon sa role
router.get("/", authenticateToken, listAuditLogs);

module.exports = router;
