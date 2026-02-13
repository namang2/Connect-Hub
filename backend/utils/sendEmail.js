const nodemailer = require("nodemailer");

// ============================================================
// EMAIL SENDING - Supports two methods:
//   1. Brevo HTTP API (recommended for Render / cloud hosting)
//   2. Gmail SMTP (fallback for local dev or non-restricted hosts)
//
// Render's free tier BLOCKS all outbound SMTP ports (587, 465).
// So we use Brevo's free HTTP API instead (300 emails/day free).
//
// Setup instructions for Brevo:
//   1. Sign up free at https://www.brevo.com
//   2. Go to Settings → SMTP & API → API Keys → Generate
//   3. Add BREVO_API_KEY to your Render environment variables
//   4. In Brevo, go to Senders → Add sender → add your Gmail
//   5. Verify your Gmail by clicking the link Brevo sends you
// ============================================================

// Method 1: Send via Brevo HTTP API (works on ALL hosting platforms)
const sendViaBrevo = async (to, subject, html, fromEmail, fromName) => {
  console.log("   📤 Sending via Brevo HTTP API...");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    let errorMsg;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || response.statusText;
    } catch {
      errorMsg = response.statusText;
    }
    throw new Error(`Brevo API error (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  console.log("   ✅ Email sent via Brevo! MessageId:", data.messageId);
  return data;
};

// Method 2: Send via Gmail SMTP (for local dev or platforms that allow SMTP)
const sendViaGmailSMTP = async (to, subject, html, fromEmail, fromName) => {
  console.log("   📤 Sending via Gmail SMTP...");

  const configs = [
    { name: "Port 587", host: "smtp.gmail.com", port: 587, secure: false },
    { name: "Port 465", host: "smtp.gmail.com", port: 465, secure: true },
  ];

  let lastError;
  for (const cfg of configs) {
    try {
      console.log(`   Trying ${cfg.name}...`);
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS.replace(/\s/g, ""),
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });

      console.log(`   ✅ Email sent via SMTP ${cfg.name}! MessageId:`, info.messageId);
      transporter.close();
      return info;
    } catch (err) {
      lastError = err;
      console.log(`   ❌ SMTP ${cfg.name} failed: ${err.message}`);
    }
  }

  throw lastError;
};

// Main send function - picks the best available method
const sendEmail = async (options) => {
  console.log("📧 Email sending initiated...");
  console.log("   To:", options.email);
  console.log("   Subject:", options.subject);
  console.log("   BREVO_API_KEY:", process.env.BREVO_API_KEY ? "SET ✅" : "NOT SET");
  console.log("   EMAIL_USER:", process.env.EMAIL_USER ? "SET" : "NOT SET");
  console.log("   EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");

  const fromEmail = process.env.EMAIL_USER || "noreply@connecthub.com";
  const fromName = "Connect Hub";

  // Development mode: just log the reset link
  if (process.env.NODE_ENV !== "production") {
    if (!process.env.BREVO_API_KEY && !process.env.EMAIL_PASS) {
      const linkMatch = options.html.match(/href="([^"]*reset-password[^"]*)"/);
      if (linkMatch) console.log("🔗 DEV Reset Link:", linkMatch[1]);
      return { success: true, devMode: true };
    }
  }

  // Try methods in order of reliability
  const errors = [];

  // Method 1: Brevo HTTP API (works on Render and all cloud platforms)
  if (process.env.BREVO_API_KEY) {
    try {
      return await sendViaBrevo(
        options.email,
        options.subject,
        options.html,
        fromEmail,
        fromName
      );
    } catch (err) {
      console.log("   ❌ Brevo failed:", err.message);
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // Method 2: Gmail SMTP (works locally and on platforms that don't block SMTP)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      return await sendViaGmailSMTP(
        options.email,
        options.subject,
        options.html,
        fromEmail,
        fromName
      );
    } catch (err) {
      console.log("   ❌ Gmail SMTP failed:", err.message);
      errors.push(`Gmail SMTP: ${err.message}`);
    }
  }

  // Nothing worked
  if (!process.env.BREVO_API_KEY && !process.env.EMAIL_PASS) {
    throw new Error(
      "No email service configured. Add BREVO_API_KEY (recommended for Render) or EMAIL_USER + EMAIL_PASS to environment variables."
    );
  }

  throw new Error(
    "All email methods failed. " +
      errors.join("; ") +
      ". Render blocks SMTP — please add a free BREVO_API_KEY (sign up at brevo.com)."
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
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">💬 Connect Hub</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Hi ${userName}! 👋</h2>
                  <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
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
                    If you didn't request this, please ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 14px; margin: 0;">Made with 💜 by Connect Hub Team</p>
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
