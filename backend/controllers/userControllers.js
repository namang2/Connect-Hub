const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");
const { sendEmail, getPasswordResetEmailTemplate } = require("../utils/sendEmail");

// Password strength validation
const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  return errors;
};

//@description     Get or Search all users
//@route           GET /api/user?search=
//@access          Protected
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

//@description     Register new user
//@route           POST /api/user/
//@access          Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, pic } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please enter a valid email address");
  }

  // Validate password strength
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    res.status(400);
    throw new Error(passwordErrors.join(". "));
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });

  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    pic,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Failed to create user");
  }
});

//@description     Auth the user
//@route           POST /api/user/login
//@access          Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

//@description     Forgot password - send reset email
//@route           POST /api/user/forgot-password
//@access          Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide an email address");
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    res.status(404);
    throw new Error("No account found with this email address");
  }

  // Generate reset token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL - detect local vs deployed automatically
  const host = req.get("host") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = isLocalhost
    ? "http://localhost:3000"
    : (process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`);
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  console.log("📧 Sending password reset email to:", user.email);
  console.log("🔗 Reset URL:", resetUrl);

  // IMPORTANT: Respond immediately BEFORE sending email
  // Render's free tier has a 30-second request timeout.
  // SMTP can take 60+ seconds. If we wait for email to send,
  // Render kills the request and user sees a 500 error.
  // Instead: save token, respond instantly, send email in background.
  res.json({
    success: true,
    message: `Password reset link is being sent to ${user.email}. Please check your inbox and spam folder (may take up to 2 minutes).`,
  });

  // Send email in background (fire-and-forget)
  // This runs AFTER the response is sent, so Render timeout doesn't affect it
  sendEmail({
    email: user.email,
    subject: "🔐 Connect Hub - Password Reset Request",
    html: getPasswordResetEmailTemplate(user.name, resetUrl),
  })
    .then(() => {
      console.log("✅ Password reset email sent successfully to:", user.email);
    })
    .catch(async (error) => {
      console.error("❌ Background email send failed:", error.message);
      // Clear the reset token since email wasn't delivered
      try {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        console.log("🧹 Reset token cleared after email failure");
      } catch (saveErr) {
        console.error("Failed to clear reset token:", saveErr.message);
      }
    });
});

//@description     Reset password
//@route           PUT /api/user/reset-password/:token
//@access          Public
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  // Validate new password
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    res.status(400);
    throw new Error(passwordErrors.join(". "));
  }

  // Hash the token from URL
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find user with valid token
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired reset token. Please request a new one.");
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Password reset successful! You can now login with your new password.",
  });
});

//@description     Check if email exists
//@route           POST /api/user/check-email
//@access          Public
const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  const user = await User.findOne({ email: email.toLowerCase() });
  
  res.json({
    exists: !!user,
  });
});

module.exports = {
  allUsers,
  registerUser,
  authUser,
  forgotPassword,
  resetPassword,
  checkEmail,
};
