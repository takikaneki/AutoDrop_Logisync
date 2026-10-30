const express = require("express");
const { register, login, me } = require("../controllers/authController");
const { createUser } = require("../controllers/userController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Public registration: authController forces role = seller
router.post("/register", register);

router.post("/login", login);
router.get("/me", authenticateToken, me);

// Coordinator-only account creation
router.post(
  "/admin-register",
  authenticateToken,
  authorizeRoles("coordinator"),
  createUser
);

module.exports = router;
