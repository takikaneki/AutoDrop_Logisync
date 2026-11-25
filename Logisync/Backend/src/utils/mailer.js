const crypto = require("crypto");
require("dotenv").config();

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSmtpConfig() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || "";
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "";
  const host =
    process.env.SMTP_HOST ||
    (user.includes("gmail") || process.env.GMAIL_USER ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const from =
    process.env.SMTP_FROM ||
    (user ? `"LogiSync" <${user}>` : `"LogiSync" <no-reply@logisync.example>`);

  const isConfigured = Boolean(host && user && pass);

  return { host, port, user, pass, from, secure, isConfigured };
}

/**
 * Returns the backend-only OTP HMAC secret.
 * Never falls back to a hardcoded value.
 */
function getOtpHmacSecret() {
  const secret = process.env.OTP_HMAC_SECRET;
  if (typeof secret !== "string" || !secret.trim()) {
    const err = new Error("OTP_HMAC_SECRET environment variable is not configured.");
    err.code = "MISSING_OTP_HMAC_SECRET";
    throw err;
  }
  return secret;
}

/**
 * Sends an email via Nodemailer (Gmail SMTP port 587 with STARTTLS).
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  const config = getSmtpConfig();

  if (!config.isConfigured) {
    return { sent: false, unconfigured: true, error: "SMTP email service is not configured." };
  }

  if (!nodemailer) {
    return { sent: false, error: "Nodemailer dependency is not installed on the server." };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // false for 587 (STARTTLS), true for 465
    requireTLS: !config.secure && config.port === 587,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    html,
  });

  return { sent: true };
}

/**
 * Generates a cryptographically secure 6-digit OTP string.
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes an HMAC-SHA-256 digest bound to OTP, salt, userId, and purpose
 * using the backend-only OTP_HMAC_SECRET.
 */
function hashOtp(otp, salt, userId, purpose) {
  const secret = getOtpHmacSecret();
  const payload = `${String(otp)}:${String(salt)}:${String(userId)}:${String(purpose)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Constant-time verification of an OTP against its stored HMAC-SHA-256 hash.
 */
function verifyOtpHash(inputOtp, salt, userId, purpose, expectedHash) {
  if (typeof expectedHash !== "string" || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }
  const computedHash = hashOtp(inputOtp, salt, userId, purpose);
  const inputBuffer = Buffer.from(computedHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

/**
 * Sends a branded OTP verification email.
 * Never logs plaintext OTP codes or credentials.
 */
async function sendOtpEmail({ to, name = "User", otp, purpose = "FORGOT_PASSWORD" }) {
  const subject = "LogiSync – Your OTP Verification Code";
  const safeNameText = String(name || "User").replace(/[\r\n]/g, " ").trim();
  const safeNameHtml = escapeHtml(safeNameText);

  const actionDesc =
    purpose === "FIRST_LOGIN"
      ? "Please enter this verification code to complete your first-time login and choose your new password."
      : "We received a request to reset your LogiSync account password. Use the verification code below to proceed.";

  const text = `Hello ${safeNameText},\n\n${actionDesc}\n\nYour Verification Code: ${otp}\n\nThis code will expire in 5 minutes.\nIf you did not request this verification code, please ignore this email or contact your Hub Coordinator.\n\n— LogiSync SPX Express`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LogiSync – Your OTP Verification Code</title>
    </head>
    <body style="margin: 0; padding: 12px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 660px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
        <tr>
          <td style="height: 5px; background: linear-gradient(to right, #d9482b, #e36d53, #bf3a20);"></td>
        </tr>
        <tr>
          <td style="padding: 22px 20px;">
            <div style="margin-bottom: 4px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #d9482b; letter-spacing: -0.5px;">LogiSync</h1>
            </div>
            <p style="margin: 0 0 14px 0; font-size: 12.5px; color: #64748b; font-weight: 600;">SPX Express Verification &amp; Delivery Coordination Platform</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 16px;" />

            <p style="font-size: 15px; margin: 0 0 8px 0; color: #334155;">Hello <strong>${safeNameHtml}</strong>,</p>
            <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.55;">
              ${actionDesc}
            </p>

            <div style="text-align: center; margin: 18px 0; padding: 18px 16px; background: #fff7ed; border-radius: 12px; border: 1px dashed #fdba74;">
              <span style="display: block; font-size: 11.5px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">Verification Code</span>
              <span style="display: inline-block; font-size: 34px; font-weight: 800; color: #d9482b; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">${escapeHtml(otp)}</span>
              <span style="display: block; font-size: 12px; color: #9a3412; margin-top: 6px; font-weight: 500;">Valid for 5 minutes</span>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
              For security, this code can only be used once. If you did not initiate this request, you can safely disregard this email or notify your Hub Coordinator.
            </p>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 10px 0 0 0;">
              Never share this verification code with anyone. LogiSync staff will never ask for your code.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 20px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} LogiSync SPX Express. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendMail({ to, subject, text, html });
  } catch (err) {
    console.error("[LogiSync Mailer] OTP email delivery failed:", err.code || "SMTP_ERROR");
    return { sent: false, error: "Failed to deliver OTP verification email." };
  }
}

/**
 * Sends a password reset link email (preserved for legacy /api/auth/forgot-password compatibility).
 */
async function sendPasswordResetEmail({ to, name = "User", resetLink }) {
  const subject = "Reset Your LogiSync Password";
  const safeNameText = String(name || "User").replace(/[\r\n]/g, " ").trim();
  const safeNameHtml = escapeHtml(safeNameText);
  const safeLinkHtml = escapeHtml(resetLink);
  const safeToHtml = escapeHtml(to);

  const text = `Hello ${safeNameText},\n\nYou requested to reset your LogiSync account password.\n\nPlease open the following link in your browser to create a new password:\n${resetLink}\n\nThis link is valid for 1 hour. If you did not request this, you can safely ignore this email.\n\n— LogiSync Verification & Delivery Team`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your LogiSync Password</title>
    </head>
    <body style="margin: 0; padding: 12px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 660px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
        <tr>
          <td style="height: 5px; background: linear-gradient(to right, #d9482b, #e36d53, #bf3a20);"></td>
        </tr>
        <tr>
          <td style="padding: 22px 20px;">
            <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; color: #d9482b;">LogiSync</h1>
            <p style="margin: 0 0 14px 0; font-size: 12.5px; color: #64748b; font-weight: 600; line-height: 1.5;">SPX Express Verification &amp; Delivery Coordination Platform</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 16px;" />
            <p style="font-size: 15px; margin: 0 0 10px 0; color: #334155;">Hello <strong>${safeNameHtml}</strong>,</p>
            <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.55;">
              We received a request to reset the password for your LogiSync account (<strong>${safeToHtml}</strong>). Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${safeLinkHtml}" style="display: inline-block; background-color: #d9482b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(217, 72, 43, 0.35);">
                Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
              Or copy and paste this link into your browser:<br />
              <a href="${safeLinkHtml}" style="color: #d9482b; word-break: break-all;">${safeLinkHtml}</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 14px 0 0 0;">
              This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 20px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} LogiSync SPX Express. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendMail({ to, subject, text, html });
  } catch (err) {
    console.error("[LogiSync Mailer] Password reset email delivery failed:", err.code || "SMTP_ERROR");
    return { sent: false, error: "Failed to deliver password reset email." };
  }
}

/**
 * Sends an account credentials email when a Coordinator creates a new account.
 * Never logs temporary passwords or credentials.
 */
async function sendAccountCredentialsEmail({
  to,
  name = "User",
  role = "rider",
  temporaryPassword,
  loginUrl,
}) {
  const roleLabel =
    String(role || "").trim().toLowerCase() === "seller"
      ? "Seller"
      : String(role || "").trim().toLowerCase() === "coordinator"
        ? "Coordinator"
        : "Rider";

  const subject = `LogiSync – Your New ${roleLabel} Account Credentials`;
  const safeNameText = String(name || "User").replace(/[\r\n]/g, " ").trim();
  const safeNameHtml = escapeHtml(safeNameText);
  const safeToHtml = escapeHtml(to);
  const safePasswordHtml = escapeHtml(temporaryPassword);
  const safeLoginUrl = String(loginUrl || "").trim();
  const safeLoginUrlHtml = escapeHtml(safeLoginUrl);

  const text = [
    `Hello ${safeNameText},`,
    ``,
    `Your LogiSync ${roleLabel} account has been created by the Hub Coordinator.`,
    ``,
    `Account Details:`,
    `- Assigned Role: ${roleLabel}`,
    `- Registered Email: ${to}`,
    `- Temporary Password: ${temporaryPassword}`,
    ``,
    `First-Time Login Instructions:`,
    `1. Open the LogiSync login page: ${safeLoginUrl}`,
    `2. Sign in using your registered email address and the temporary password above.`,
    `3. You will be prompted to verify your email with a 6-digit OTP code and set your permanent password before accessing your ${roleLabel} dashboard.`,
    ``,
    `For your security, please do not share your temporary password with anyone.`,
    ``,
    `— LogiSync SPX Express`,
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin: 0; padding: 12px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 660px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
        <tr>
          <td style="height: 5px; background: linear-gradient(to right, #d9482b, #e36d53, #bf3a20);"></td>
        </tr>
        <tr>
          <td style="padding: 22px 20px;">
            <div style="margin-bottom: 4px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #d9482b; letter-spacing: -0.5px;">LogiSync</h1>
            </div>
            <p style="margin: 0 0 14px 0; font-size: 12.5px; color: #64748b; font-weight: 600;">SPX Express Verification &amp; Delivery Coordination Platform</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 16px;" />

            <p style="font-size: 15px; margin: 0 0 8px 0; color: #334155;">Hello <strong>${safeNameHtml}</strong>,</p>
            <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.55;">
              Your LogiSync <strong>${escapeHtml(roleLabel)}</strong> account has been created by the Hub Coordinator. Use the temporary credentials below to sign in and complete your mandatory first-time password verification.
            </p>

            <div style="margin: 16px 0; padding: 16px 16px; background: #fff7ed; border-radius: 12px; border: 1px solid #fed7aa;">
              <p style="margin: 0 0 10px 0; font-size: 11.5px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 1px;">Account Credentials</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 12px 5px 0; color: #64748b; white-space: nowrap; width: 1%; vertical-align: middle;">Assigned Role:</td>
                  <td style="padding: 5px 0; font-weight: 700; vertical-align: middle;">${escapeHtml(roleLabel)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 12px 5px 0; color: #64748b; white-space: nowrap; width: 1%; vertical-align: middle;">Registered Email:</td>
                  <td style="padding: 5px 0; font-weight: 700; word-break: break-word; vertical-align: middle;">${safeToHtml}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 12px 5px 0; color: #64748b; white-space: nowrap; width: 1%; vertical-align: middle;">Temporary Password:</td>
                  <td style="padding: 5px 0; vertical-align: middle;"><code style="display: inline-block; padding: 3px 10px; background: #ffffff; border: 1px dashed #fdba74; border-radius: 6px; font-size: 14px; font-weight: 800; color: #d9482b; font-family: 'Courier New', Courier, monospace;">${safePasswordHtml}</code></td>
                </tr>
              </table>
            </div>

            <div style="margin: 16px 0; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.55;">
              <strong style="display: block; margin-bottom: 6px; color: #0f172a;">Mandatory First-Time Login Steps:</strong>
              <ol style="margin: 0; padding-left: 18px;">
                <li>Click the sign-in button below and enter your registered email and temporary password.</li>
                <li>Enter the 6-digit OTP verification code sent to your registered email address.</li>
                <li>Create your permanent password to unlock your ${escapeHtml(roleLabel)} dashboard.</li>
              </ol>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <a href="${safeLoginUrlHtml}" style="display: inline-block; background-color: #d9482b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(217, 72, 43, 0.35);">
                Sign In to LogiSync
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
              Or copy and paste this link into your browser:<br />
              <a href="${safeLoginUrlHtml}" style="color: #d9482b; word-break: break-all;">${safeLoginUrlHtml}</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 10px 0 0 0;">
              Keep your credentials private. Your temporary password cannot be reused once you complete first-time password setup.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 20px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} LogiSync SPX Express. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendMail({ to, subject, text, html });
  } catch (err) {
    console.error("[LogiSync Mailer] Account credentials email delivery failed:", err.code || "SMTP_ERROR");
    return { sent: false, error: "Failed to deliver account credentials email." };
  }
}

/**
 * Sends a Contact Us inquiry email to the official LogiSync support inbox.
 * Sets replyTo to the visitor's email so the team can reply directly.
 * Never logs message contents or credentials.
 */
async function sendContactUsEmail({ name, email, subject = "", message }) {
  const destination = (process.env.CONTACT_EMAIL || "logisync.autodrop@gmail.com").trim();
  const cleanName = String(name || "").replace(/[\r\n]/g, " ").trim();
  const cleanEmail = String(email || "").replace(/[\r\n]/g, "").trim().toLowerCase();
  const cleanSubject = String(subject || "").replace(/[\r\n]/g, " ").trim() || "General Inquiry";
  const cleanMessage = String(message || "").trim();

  const mailSubject = `LogiSync Contact Us – ${cleanSubject}`;
  const safeNameHtml = escapeHtml(cleanName);
  const safeEmailHtml = escapeHtml(cleanEmail);
  const safeSubjectHtml = escapeHtml(cleanSubject);
  const safeMessageHtml = escapeHtml(cleanMessage).replace(/\r?\n/g, "<br />");

  const text = [
    `New Contact Us Message — LogiSync`,
    ``,
    `From: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Subject: ${cleanSubject}`,
    ``,
    `Message:`,
    cleanMessage,
    ``,
    `— Sent via LogiSync Contact Us Form`,
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(mailSubject)}</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" width="100%" style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
        <tr>
          <td style="height: 6px; background: linear-gradient(to right, #f97316, #f59e0b, #ea580c);"></td>
        </tr>
        <tr>
          <td style="padding: 28px 32px;">
            <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; color: #f97316;">LogiSync</h1>
            <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b; font-weight: 600;">New Contact Us Message</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />

            <table width="100%" style="font-size: 13px; color: #334155; border-collapse: collapse; margin-bottom: 20px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">
              <tr>
                <td style="padding: 10px 14px 4px 14px; color: #64748b; width: 95px;">Sender:</td>
                <td style="padding: 10px 14px 4px 0; font-weight: 700;">${safeNameHtml}</td>
              </tr>
              <tr>
                <td style="padding: 4px 14px; color: #64748b;">Reply-To:</td>
                <td style="padding: 4px 14px 4px 0; font-weight: 700;"><a href="mailto:${safeEmailHtml}" style="color: #ea580c; text-decoration: none;">${safeEmailHtml}</a></td>
              </tr>
              <tr>
                <td style="padding: 4px 14px 10px 14px; color: #64748b;">Subject:</td>
                <td style="padding: 4px 14px 10px 0; font-weight: 700;">${safeSubjectHtml}</td>
              </tr>
            </table>

            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b;">Message</p>
            <div style="padding: 16px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; color: #1e293b; line-height: 1.65; word-break: break-word;">
              ${safeMessageHtml}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} LogiSync SPX Express. Reply directly to respond to ${safeNameHtml}.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendMail({
      to: destination,
      replyTo: cleanEmail,
      subject: mailSubject,
      text,
      html,
    });
  } catch (err) {
    console.error("[LogiSync Mailer] Contact Us email delivery failed:", err.code || "SMTP_ERROR");
    return { sent: false, error: "Failed to send message right now. Please try again later." };
  }
}

module.exports = {
  escapeHtml,
  getSmtpConfig,
  getOtpHmacSecret,
  sendMail,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendAccountCredentialsEmail,
  sendContactUsEmail,
};
