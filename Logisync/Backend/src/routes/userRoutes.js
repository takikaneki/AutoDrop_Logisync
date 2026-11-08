const express = require("express");
const {
  listContacts,
  createUser,
  listUsers,
  reviewSeller
} = require("../controllers/userController");
const { verifyPassword, changePassword } = require("../controllers/authController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/contacts", authenticateToken, listContacts);

// Authenticated user password verification & update
router.post("/verify-password", authenticateToken, verifyPassword);
router.post("/password/verify", authenticateToken, verifyPassword);
router.patch("/password", authenticateToken, changePassword);
router.post("/password", authenticateToken, changePassword);
router.put("/password", authenticateToken, changePassword);
router.post("/change-password", authenticateToken, changePassword);
router.patch("/change-password", authenticateToken, changePassword);
router.put("/change-password", authenticateToken, changePassword);

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
