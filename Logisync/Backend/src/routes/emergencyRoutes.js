const express = require("express");
const {
  createEmergencyReport,
  listEmergencyReports,
  getUnreviewedEmergencyCount,
  getEmergencyReport,
  updateEmergencyReport,
} = require("../controllers/emergencyController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, listEmergencyReports);
router.get(
  "/unreviewed-count",
  authenticateToken,
  authorizeRoles("coordinator"),
  getUnreviewedEmergencyCount
);
router.get("/:id", authenticateToken, getEmergencyReport);
router.post(
  "/",
  authenticateToken,
  authorizeRoles("seller", "rider"),
  createEmergencyReport
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRoles("coordinator"),
  updateEmergencyReport
);

module.exports = router;
