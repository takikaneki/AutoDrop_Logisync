const express = require("express");
const {
  register,
  login,
  logout,
  me,
  verifyPassword,
  changePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} = require("../controllers/authController");
const { createUser } = require("../controllers/userController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Public registration: authController forces role = seller
router.post("/register", register);

// Unified login endpoint & backward-compatible portal aliases
router.post("/login", login);
router.post("/login/seller", login);
router.post("/login/rider", login);
router.post("/login/coordinator", login);

// Password Recovery & Reset
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/verify", verifyResetToken);
router.post("/reset-password", resetPassword);

// Session management
router.post("/logout", authenticateToken, logout);
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
