const nodemailer = require("nodemailer");

// Create reusable transporter - created once, reused across calls
let cachedTransporter = null;

const createTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL on port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    // Generous timeouts for cloud hosting (Render, etc.)
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 60000, // 60 seconds
    socketTimeout: 120000, // 120 seconds
    pool: true, // use connection pooling
    maxConnections: 3,
    maxMessages: 100,
  });

  return cachedTransporter;
};

const sendEmail = async (options) => {
  console.log("📧 Email sending initiated...");
  console.log(
    "   EMAIL_USER set:",
    !!process.env.EMAIL_USER,
    process.env.EMAIL_USER
      ? `(${process.env.EMAIL_USER.substring(0, 3)}...@${
          process.env.EMAIL_USER.split("@")[1] || "?"
        })`
      : ""
  );
  console.log(
    "   EMAIL_PASS set:",
    !!process.env.EMAIL_PASS,
    process.env.EMAIL_PASS ? `(length: ${process.env.EMAIL_PASS.length})` : ""
  );
  console.log("   NODE_ENV:", process.env.NODE_ENV);
  console.log("   FRONTEND_URL:", process.env.FRONTEND_URL || "NOT SET");

  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("=================================================");
    console.error("❌ EMAIL CONFIGURATION MISSING");
    console.error("=================================================");
    console.error("EMAIL_USER exists:", !!process.env.EMAIL_USER);
    console.error("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
    console.error("Make sure these env vars are set in Render Dashboard:");
    console.error("  EMAIL_USER=your_gmail@gmail.com");
    console.error("  EMAIL_PASS=your_16_char_app_password");
    console.error("=================================================");

    // In development, log the reset link for testing
    if (process.env.NODE_ENV !== "production") {
      console.log("");
      console.log("📬 Password Reset Link (DEV MODE):");
      console.log(`   Email: ${options.email}`);
      console.log(`   Subject: ${options.subject}`);
      const linkMatch = options.html.match(
        /href="([^"]*reset-password[^"]*)"/
      );
      if (linkMatch) {
        console.log("🔗 Reset Link: " + linkMatch[1]);
      }
      console.log("=================================================");
      return { success: true, devMode: true };
    }

    throw new Error(
      "Email credentials (EMAIL_USER / EMAIL_PASS) are not configured on the server. Please add them in Render environment variables."
    );
  }

  // Trim any spaces from EMAIL_PASS (common copy-paste issue)
  const cleanPass = process.env.EMAIL_PASS.replace(/\s/g, "");
  if (cleanPass !== process.env.EMAIL_PASS) {
    console.log(
      "⚠️ EMAIL_PASS had spaces — using trimmed version (length:",
      cleanPass.length,
      ")"
    );
    process.env.EMAIL_PASS = cleanPass;
    cachedTransporter = null; // Force recreate transporter with clean password
  }

  const transporter = createTransporter();

  // Email options
  const mailOptions = {
    from: `"Connect Hub" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // Retry logic — try up to 3 times with increasing delay
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `📤 Sending email attempt ${attempt}/${maxRetries} to: ${options.email}`
      );
      const info = await transporter.sendMail(mailOptions);
      console.log(
        "✅ Email sent successfully to:",
        options.email,
        "MessageId:",
        info.messageId
      );
      return info;
    } catch (sendError) {
      lastError = sendError;
      console.error(
        `❌ Email attempt ${attempt}/${maxRetries} failed:`,
        sendError.message
      );
      console.error("   Error code:", sendError.code);

      // If it's an auth error, don't retry (wrong credentials)
      if (
        sendError.code === "EAUTH" ||
        sendError.responseCode === 535
      ) {
        console.error(
          "🔑 Authentication error — check EMAIL_USER and EMAIL_PASS"
        );
        // Reset cached transporter so next attempt creates fresh one
        cachedTransporter = null;
        throw new Error(
          "Gmail authentication failed. Please verify your EMAIL_USER and EMAIL_PASS (must be a 16-character App Password with no spaces)."
        );
      }

      // For timeout/connection errors, retry
      if (attempt < maxRetries) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        // Reset cached transporter to create fresh connection
        cachedTransporter = null;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error("❌ All email send attempts failed!");
  console.error("   Last error:", lastError?.message);
  
  // Reset transporter for next time
  cachedTransporter = null;

  throw new Error(
    `Failed to send email after ${maxRetries} attempts. Error: ${lastError?.message}. This may be a network issue on the hosting platform.`
  );
};

// Password reset email template
const getPasswordResetEmailTemplate = (userName, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">💬 Connect Hub</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Hi ${userName}! 👋</h2>
                  <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 30px 0;">
                        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);">
                          🔐 Reset My Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    ⏰ This link will expire in <strong>15 minutes</strong> for security reasons.
                  </p>
                  <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                    If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 14px; margin: 0;">
                    Made with 💜 by Connect Hub Team
                  </p>
                  <p style="color: #ccc; font-size: 12px; margin: 10px 0 0 0;">
                    © 2024 Connect Hub. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

module.exports = { sendEmail, getPasswordResetEmailTemplate };
