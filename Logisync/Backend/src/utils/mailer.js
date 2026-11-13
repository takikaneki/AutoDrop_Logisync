const net = require("net");
const tls = require("tls");
require("dotenv").config();

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  // Pure Node SMTP fallback is used when nodemailer is not installed
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from =
    process.env.SMTP_FROM ||
    (user ? `"LogiSync Support" <${user}>` : `"LogiSync Support" <no-reply@logisync.example>`);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const isConfigured = Boolean(host && user && pass);

  return { host, port, user, pass, from, secure, isConfigured };
}

/**
 * Pure Node.js SMTP client for sending emails without external dependencies.
 */
function sendSmtpRaw({ host, port, secure, user, pass, from, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    let socket;
    let step = 0;
    let buffer = "";

    const cleanFrom = from.includes("<") ? from.match(/<([^>]+)>/)[1] : from;
    const cleanTo = to.includes("<") ? to.match(/<([^>]+)>/)[1] : to;

    function send(cmd) {
      if (socket && !socket.destroyed) {
        socket.write(cmd + "\r\n");
      }
    }

    function onConnect() {
      // Wait for server 220 banner
    }

    function handleResponse(code, lines) {
      if (code >= 400) {
        socket.end();
        return reject(new Error(`SMTP server error (${code}): ${lines.join(" ")}`));
      }

      switch (step) {
        case 0: // 220 received -> send EHLO
          step = 1;
          send(`EHLO localhost`);
          break;
        case 1: // 250 received -> send AUTH LOGIN
          step = 2;
          send("AUTH LOGIN");
          break;
        case 2: // 334 received -> send base64 username
          step = 3;
          send(Buffer.from(user).toString("base64"));
          break;
        case 3: // 334 received -> send base64 password
          step = 4;
          send(Buffer.from(pass).toString("base64"));
          break;
        case 4: // 235 authenticated -> send MAIL FROM
          step = 5;
          send(`MAIL FROM:<${cleanFrom}>`);
          break;
        case 5: // 250 received -> send RCPT TO
          step = 6;
          send(`RCPT TO:<${cleanTo}>`);
          break;
        case 6: // 250 received -> send DATA
          step = 7;
          send("DATA");
          break;
        case 7: // 354 received -> send email content
          step = 8;
          const boundary = `====_LogiSync_${Date.now()}_====`;
          const rawMessage = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            text,
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            ``,
            html,
            ``,
            `--${boundary}--`,
            `.`
          ].join("\r\n");

          socket.write(rawMessage + "\r\n");
          break;
        case 8: // 250 data accepted -> send QUIT
          step = 9;
          send("QUIT");
          socket.end();
          resolve({ accepted: [to], response: lines.join(" ") });
          break;
        default:
          break;
      }
    }

    try {
      if (secure) {
        socket = tls.connect(port, host, { rejectUnauthorized: false }, onConnect);
      } else {
        socket = net.connect(port, host, onConnect);
      }
    } catch (err) {
      return reject(err);
    }

    socket.setTimeout(15000, () => {
      socket.destroy(new Error("SMTP connection timed out after 15 seconds."));
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop(); // keep remainder

      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (match) {
          const code = parseInt(match[1], 10);
          const isComplete = match[2] === " ";
          if (isComplete) {
            handleResponse(code, [match[3]]);
          }
        }
      }
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Sends a password reset email using configured SMTP service, or logs instructions if unconfigured.
 */
async function sendPasswordResetEmail({ to, name = "User", resetLink }) {
  const config = getSmtpConfig();
  const subject = "Reset Your LogiSync Password";

  const textContent = `Hello ${name},\n\nYou requested to reset your LogiSync account password.\n\nPlease open the following link in your browser to create a new password:\n${resetLink}\n\nThis link is valid for 1 hour. If you did not request this, you can safely ignore this email.\n\n— LogiSync Verification & Delivery Team`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your LogiSync Password</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" width="100%" max-width="560px" style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
        <tr>
          <td style="height: 6px; background: linear-gradient(to right, #f97316, #f59e0b, #ea580c);"></td>
        </tr>
        <tr>
          <td style="padding: 32px 36px;">
            <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">LogiSync</h1>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">SPX Express Verification & Delivery Coordination Platform</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
            <p style="font-size: 15px; margin: 0 0 16px 0; color: #334155;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 14px; margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
              We received a request to reset the password for your LogiSync account (<strong>${to}</strong>). Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #f97316; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
                Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 12px 0;">
              Or copy and paste this link into your browser:<br />
              <a href="${resetLink}" style="color: #f97316; word-break: break-all;">${resetLink}</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 24px 0 0 0;">
              This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 36px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} LogiSync SPX Express. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (config.isConfigured) {
    try {
      if (nodemailer) {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: config.user,
            pass: config.pass
          }
        });
        await transporter.sendMail({
          from: config.from,
          to,
          subject,
          text: textContent,
          html: htmlContent
        });
      } else {
        await sendSmtpRaw({
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.user,
          pass: config.pass,
          from: config.from,
          to,
          subject,
          text: textContent,
          html: htmlContent
        });
      }
      console.log(`[LogiSync Mailer] Password reset email sent successfully to ${to}`);
      return { sent: true };
    } catch (sendErr) {
      console.error(`[LogiSync Mailer] Failed to send email via SMTP (${config.host}:${config.port}):`, sendErr.message);
      // Fallback: log link to terminal so testing/admin can continue without disruption
      logResetLinkDev(to, resetLink);
      return { sent: false, error: sendErr.message };
    }
  } else {
    // SMTP credentials not configured in environment
    logResetLinkDev(to, resetLink);
    return { sent: false, unconfigured: true };
  }
}

function logResetLinkDev(to, resetLink) {
  console.log("\n================================================================================");
  console.log("[LOGISYNC FORGOT PASSWORD - RECOVERY LINK GENERATED]");
  console.log(`Recipient:   ${to}`);
  console.log(`Reset Link:  ${resetLink}`);
  console.log("Expiration:  1 hour");
  console.log("--------------------------------------------------------------------------------");
  console.log("Note: To send actual emails via Gmail or SMTP, configure in Logisync/Backend/.env:");
  console.log("  SMTP_HOST=smtp.gmail.com");
  console.log("  SMTP_PORT=465");
  console.log("  SMTP_SECURE=true");
  console.log("  SMTP_USER=your_email@gmail.com");
  console.log("  SMTP_PASS=your_gmail_app_password");
  console.log("  SMTP_FROM=\"LogiSync Support <your_email@gmail.com>\"");
  console.log("  APP_URL=http://localhost:5173");
  console.log("================================================================================\n");
}

module.exports = {
  getSmtpConfig,
  sendPasswordResetEmail
};

