const nodemailer = require("nodemailer");
const dns = require("dns");

// Pre-resolve smtp.gmail.com to IPv4 addresses to bypass DNS issues on cloud platforms
const resolveGmailIPs = async () => {
  try {
    const addresses = await dns.promises.resolve4("smtp.gmail.com");
    console.log("   DNS resolved smtp.gmail.com →", addresses);
    return addresses;
  } catch (err) {
    console.log("   DNS resolution failed, using hostname directly");
    return ["smtp.gmail.com"];
  }
};

// Try sending email with a specific transporter config
const trySend = async (config, mailOptions, label) => {
  console.log(`   📤 Trying: ${label}...`);
  const transporter = nodemailer.createTransport(config);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`   ✅ Success via ${label}! MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.log(`   ❌ Failed (${label}): ${err.message} [code: ${err.code}]`);
    throw err;
  } finally {
    transporter.close();
  }
};

const sendEmail = async (options) => {
  console.log("📧 Email sending initiated...");
  console.log(
    "   EMAIL_USER:",
    process.env.EMAIL_USER
      ? `${process.env.EMAIL_USER.substring(0, 3)}...@${
          process.env.EMAIL_USER.split("@")[1] || "?"
        }`
      : "NOT SET"
  );
  console.log(
    "   EMAIL_PASS:",
    process.env.EMAIL_PASS
      ? `set (length: ${process.env.EMAIL_PASS.length})`
      : "NOT SET"
  );

  // Check credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV !== "production") {
      const linkMatch = options.html.match(
        /href="([^"]*reset-password[^"]*)"/
      );
      if (linkMatch) console.log("🔗 DEV Reset Link: " + linkMatch[1]);
      return { success: true, devMode: true };
    }
    throw new Error(
      "Email credentials not configured. Add EMAIL_USER and EMAIL_PASS in Render environment variables."
    );
  }

  const emailUser = process.env.EMAIL_USER.trim();
  const emailPass = process.env.EMAIL_PASS.replace(/\s/g, "");

  const mailOptions = {
    from: `"Connect Hub" <${emailUser}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // Resolve Gmail SMTP IPs (bypasses slow/broken DNS on some cloud platforms)
  const gmailIPs = await resolveGmailIPs();

  // Build a list of configurations to try
  // Each combines: an IP/host × a port × SSL/TLS setting
  const configs = [];

  for (const host of gmailIPs) {
    const isIP = host !== "smtp.gmail.com";
    const tlsOpts = isIP
      ? { servername: "smtp.gmail.com", rejectUnauthorized: false }
      : { rejectUnauthorized: false };

    // Port 587 STARTTLS (most commonly recommended by Google)
    configs.push({
      label: `${host}:587 STARTTLS`,
      config: {
        host,
        port: 587,
        secure: false,
        auth: { user: emailUser, pass: emailPass },
        tls: tlsOpts,
        connectionTimeout: 30000,
        greetingTimeout: 20000,
        socketTimeout: 60000,
      },
    });

    // Port 465 SSL (direct SSL connection)
    configs.push({
      label: `${host}:465 SSL`,
      config: {
        host,
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass },
        tls: tlsOpts,
        connectionTimeout: 30000,
        greetingTimeout: 20000,
        socketTimeout: 60000,
      },
    });
  }

  // Also try the "gmail" service shorthand (uses Google's preset config)
  configs.push({
    label: "service:gmail",
    config: {
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 20000,
      socketTimeout: 60000,
    },
  });

  // Try each config. Stop on first success.
  let lastError = null;
  for (const { label, config } of configs) {
    try {
      const info = await trySend(config, mailOptions, label);
      return info;
    } catch (err) {
      lastError = err;
      // Auth error = credentials wrong, no point trying other ports/IPs
      if (err.code === "EAUTH" || err.responseCode === 535) {
        throw new Error(
          "Gmail authentication failed. EMAIL_PASS must be a 16-character App Password (not your Gmail password). " +
            "Enable 2-Step Verification at myaccount.google.com/security, then create an App Password."
        );
      }
    }
  }

  // Every config failed
  console.error("❌ ALL email send attempts failed");
  throw new Error(
    `Unable to send email — all SMTP connections failed. Last error: ${lastError?.message}. ` +
      "This is likely a network restriction on the hosting platform."
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
              <!-- Footer -->
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
