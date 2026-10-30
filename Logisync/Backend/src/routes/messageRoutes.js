const express = require("express");
const { listMessages, sendMessage, markRead } = require("../controllers/messageController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, listMessages);
router.post("/", authenticateToken, sendMessage);
router.patch("/:messageId/read", authenticateToken, markRead);

module.exports = router;