const express = require("express");
const {
  listContacts,
  createUser,
  listUsers,
  reviewSeller
} = require("../controllers/userController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/contacts", authenticateToken, listContacts);

// Accounts: coordinator lang
router.get("/", authenticateToken, authorizeRoles("coordinator"), listUsers);
router.post("/", authenticateToken, authorizeRoles("coordinator"), createUser);

// Coordinator lang: approve/activate o reject/suspend ng seller o rider
router.patch(
  "/:id/verification",
  authenticateToken,
  authorizeRoles("coordinator"),
  reviewSeller
);
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("coordinator"),
  reviewSeller
);

module.exports = router;
