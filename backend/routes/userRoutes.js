const express = require("express");
const {
  registerUser,
  authUser,
  allUsers,
  forgotPassword,
  resetPassword,
  checkEmail,
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(protect, allUsers);
router.route("/").post(registerUser);
router.post("/login", authUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.post("/check-email", checkEmail);

module.exports = router;
