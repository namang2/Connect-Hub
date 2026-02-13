const nodemailer = require("nodemailer");

// Try sending email with a specific SMTP configuration
const trySendWithConfig = async (config, mailOptions) => {
  const transporter = nodemailer.createTransport(config);
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } finally {
    transporter.close();
  }
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

  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ EMAIL CONFIGURATION MISSING");
    console.error("   Set EMAIL_USER and EMAIL_PASS in Render Dashboard");

    if (process.env.NODE_ENV !== "production") {
      console.log("📬 DEV MODE — Logging reset link instead of sending email");
      const linkMatch = options.html.match(
        /href="([^"]*reset-password[^"]*)"/
      );
      if (linkMatch) {
        console.log("🔗 Reset Link: " + linkMatch[1]);
      }
      return { success: true, devMode: true };
    }

    throw new Error(
      "Email credentials not configured. Add EMAIL_USER and EMAIL_PASS in Render environment variables."
    );
  }

  // Clean the app password (remove any spaces from copy-paste)
  const emailUser = process.env.EMAIL_USER.trim();
  const emailPass = process.env.EMAIL_PASS.replace(/\s/g, "");

  const mailOptions = {
    from: `"Connect Hub" <${emailUser}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // SMTP configurations to try (in order)
  // Config 1: Port 587 with STARTTLS (recommended by Google, works on most cloud platforms)
  // Config 2: Port 465 with SSL (direct SSL connection)
  // Config 3: Using "gmail" service shorthand (Google's recommended settings)
  const smtpConfigs = [
    {
      name: "Gmail Port 587 (STARTTLS)",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: emailUser, pass: emailPass },
      tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
      connectionTimeout: 120000,
      greetingTimeout: 60000,
      socketTimeout: 120000,
    },
    {
      name: "Gmail Port 465 (SSL)",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: emailUser, pass: emailPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 120000,
      greetingTimeout: 60000,
      socketTimeout: 120000,
    },
    {
      name: "Gmail Service (auto-config)",
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 120000,
      greetingTimeout: 60000,
      socketTimeout: 120000,
    },
  ];

  let lastError = null;

  for (const config of smtpConfigs) {
    const configName = config.name;
    delete config.name; // Remove our custom field before passing to nodemailer

    // Try up to 2 attempts per configuration
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`📤 Trying ${configName} (attempt ${attempt}/2)...`);
        const info = await trySendWithConfig(config, mailOptions);
        console.log(
          `✅ Email sent via ${configName}! MessageId: ${info.messageId}`
        );
        return info;
      } catch (err) {
        lastError = err;
        console.log(
          `❌ ${configName} attempt ${attempt} failed: ${err.message}`
        );

        // If it's an authentication error, don't retry with same config
        if (err.code === "EAUTH" || err.responseCode === 535) {
          console.error(
            "🔑 Authentication error — EMAIL_USER or EMAIL_PASS is incorrect"
          );
          console.error(
            "   Make sure EMAIL_PASS is a 16-character Gmail App Password (no spaces)"
          );
          break; // Skip to next config
        }

        // Wait before retrying
        if (attempt < 2) {
          console.log("   ⏳ Waiting 5s before retry...");
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  // All configurations failed
  console.error("❌ ALL email configurations failed!");
  console.error("   Last error:", lastError?.message);
  console.error("   Possible causes:");
  console.error(
    "   1. EMAIL_PASS is wrong (must be 16-char Gmail App Password, not your Gmail password)"
  );
  console.error(
    "   2. 2-Step Verification is not enabled on the Gmail account"
  );
  console.error("   3. The hosting platform may be blocking SMTP connections");

  throw new Error(
    lastError?.code === "EAUTH" || lastError?.responseCode === 535
      ? "Gmail authentication failed. Make sure EMAIL_PASS is a 16-character App Password (not your regular Gmail password). Enable 2-Step Verification first at myaccount.google.com/security."
      : `Unable to send email. All SMTP configurations failed. Last error: ${lastError?.message}`
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

