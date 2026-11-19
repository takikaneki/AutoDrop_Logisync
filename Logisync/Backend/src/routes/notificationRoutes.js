const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
  getPreferences,
  updatePreferences,
  getVapidPublicKey,
  getPushStatus,
  subscribePush,
  unsubscribePush,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/preferences", authenticateToken, getPreferences);
router.put("/preferences", authenticateToken, updatePreferences);

router.get("/push/vapid-public-key", authenticateToken, getVapidPublicKey);
router.get("/push/status", authenticateToken, getPushStatus);
router.post("/push/subscribe", authenticateToken, subscribePush);
router.post("/push/unsubscribe", authenticateToken, unsubscribePush);
router.delete("/push/subscribe", authenticateToken, unsubscribePush);

module.exports = router;
