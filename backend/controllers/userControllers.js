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

  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Connect Hub - Password Reset Request",
      html: getPasswordResetEmailTemplate(user.name, resetUrl),
    });

    console.log("✅ Password reset email sent to:", user.email);
    res.json({
      success: true,
      message: `Password reset link has been sent to ${user.email}. Please check your inbox and spam folder.`,
    });
  } catch (error) {
    console.error("❌ Failed to send reset email:", error.message);

    // Clear the reset token since email wasn't sent
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error(error.message);
  }
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

//@description     Test email configuration (diagnostic endpoint)
//@route           GET /api/user/test-email
//@access          Public (temporary - for debugging)
const testEmailConfig = asyncHandler(async (req, res) => {
  const dns = require("dns");
  const results = {
    envVars: {
      EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}...` : "NOT SET",
      EMAIL_PASS: process.env.EMAIL_PASS ? `set (length: ${process.env.EMAIL_PASS.length})` : "NOT SET",
      FRONTEND_URL: process.env.FRONTEND_URL || "NOT SET",
      NODE_ENV: process.env.NODE_ENV || "NOT SET",
    },
    dns: {},
    smtpTests: [],
  };

  // Test DNS resolution
  try {
    const addresses = await dns.promises.resolve4("smtp.gmail.com");
    results.dns = { resolved: true, ips: addresses };
  } catch (err) {
    results.dns = { resolved: false, error: err.message };
  }

  // Test SMTP connections (quick 10s timeout)
  const net = require("net");
  const testPort = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ host, port, status: "TIMEOUT (10s)" });
      }, 10000);
      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ host, port, status: "CONNECTED ✅" });
      });
      socket.on("error", (err) => {
        clearTimeout(timer);
        resolve({ host, port, status: `ERROR: ${err.message}` });
      });
    });
  };

  // Test connectivity to Gmail SMTP on both ports
  const hosts = results.dns.resolved ? results.dns.ips : ["smtp.gmail.com"];
  for (const host of hosts.slice(0, 2)) {
    results.smtpTests.push(await testPort(host, 587));
    results.smtpTests.push(await testPort(host, 465));
  }

  res.json(results);
});

module.exports = {
  allUsers,
  registerUser,
  authUser,
  forgotPassword,
  resetPassword,
  checkEmail,
  testEmailConfig,
};
