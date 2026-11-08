const express = require("express");
const {
  register,
  login,
  me,
  verifyPassword,
  changePassword,
} = require("../controllers/authController");
const { createUser } = require("../controllers/userController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Public registration: authController forces role = seller
router.post("/register", register);

router.post("/login", login);
router.get("/me", authenticateToken, me);

// Authenticated user: verify current password & update own password (Coordinator, Seller, Rider)
router.post("/verify-password", authenticateToken, verifyPassword);
router.post("/password/verify", authenticateToken, verifyPassword);
router.patch("/password", authenticateToken, changePassword);
router.post("/password", authenticateToken, changePassword);
router.put("/password", authenticateToken, changePassword);
router.post("/change-password", authenticateToken, changePassword);
router.patch("/change-password", authenticateToken, changePassword);
router.put("/change-password", authenticateToken, changePassword);

// Coordinator-only account creation
router.post(
  "/admin-register",
  authenticateToken,
  authorizeRoles("coordinator"),
  createUser
);

module.exports = router;
