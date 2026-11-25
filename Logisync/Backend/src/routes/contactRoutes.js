const express = require("express");
const { rawPool } = require("../config/database");
const { sendContactUsEmail } = require("../utils/mailer");

const router = express.Router();

const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 150;
const MAX_SUBJECT_LEN = 150;
const MAX_MESSAGE_LEN = 2000;
const MIN_MESSAGE_LEN = 5;

function getClientIp(req) {
  const behindTrustedProxy =
    Boolean(process.env.VERCEL) ||
    process.env.TRUST_PROXY === "true" ||
    Boolean(req.app?.get?.("trust proxy"));

  if (behindTrustedProxy) {
    const vercelIp = req.headers?.["x-vercel-forwarded-for"];
    if (typeof vercelIp === "string" && vercelIp.trim()) {
      return vercelIp.split(",")[0].trim().slice(0, 64);
    }
    const xff = req.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
      return xff.split(",")[0].trim().slice(0, 64);
    }
  }

  return String(req.socket?.remoteAddress || req.ip || "unknown").slice(0, 64);
}

async function checkContactRateLimit(scopeKey, action, windowSeconds, maxRequests) {
  const client = await rawPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`rl:${action}:${scopeKey}`]);

    await client.query(
      `DELETE FROM otp_rate_limits
       WHERE scope_key = $1
         AND action = $2
         AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      [scopeKey, action]
    );

    const { rows } = await client.query(
      `SELECT created_at
       FROM otp_rate_limits
       WHERE scope_key = $1
         AND action = $2
         AND created_at > CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second')
       ORDER BY created_at ASC`,
      [scopeKey, action, windowSeconds]
    );

    if (rows.length >= maxRequests) {
      const oldestTime = new Date(rows[0].created_at).getTime();
      const remainingSeconds = Math.max(
        1,
        Math.ceil((oldestTime + windowSeconds * 1000 - Date.now()) / 1000)
      );
      await client.query("ROLLBACK");
      return { allowed: false, remainingSeconds };
    }

    await client.query(
      `INSERT INTO otp_rate_limits (scope_key, action)
       VALUES ($1, $2)`,
      [scopeKey, action]
    );

    await client.query("COMMIT");
    return { allowed: true, remainingSeconds: 0 };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * POST /api/contact
 * Public Contact Us submission endpoint. Sends inquiries to logisync.autodrop@gmail.com.
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const rawName = typeof body.name === "string" ? body.name.replace(/[\r\n]/g, " ").trim() : "";
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawSubject = typeof body.subject === "string" ? body.subject.replace(/[\r\n]/g, " ").trim() : "";
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!rawName || rawName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please enter your name (at least 2 characters).",
      });
    }
    if (rawName.length > MAX_NAME_LEN) {
      return res.status(400).json({
        success: false,
        message: `Name must not exceed ${MAX_NAME_LEN} characters.`,
      });
    }

    if (
      !rawEmail ||
      rawEmail.length > MAX_EMAIL_LEN ||
      /[\r\n]/.test(rawEmail) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (rawSubject.length > MAX_SUBJECT_LEN) {
      return res.status(400).json({
        success: false,
        message: `Subject must not exceed ${MAX_SUBJECT_LEN} characters.`,
      });
    }

    if (!rawMessage || rawMessage.length < MIN_MESSAGE_LEN) {
      return res.status(400).json({
        success: false,
        message: `Please enter a message of at least ${MIN_MESSAGE_LEN} characters.`,
      });
    }
    if (rawMessage.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({
        success: false,
        message: `Message must not exceed ${MAX_MESSAGE_LEN} characters.`,
      });
    }

    // Serverless-safe rate limiting: max 5 messages per 15 min per IP, max 3 per 15 min per email
    const ip = getClientIp(req);
    const ipCheck = await checkContactRateLimit(`ip:${ip}`, "CONTACT_IP", 900, 5);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: "Too many messages sent recently. Please wait a few minutes before trying again.",
        remainingSeconds: ipCheck.remainingSeconds,
      });
    }

    const emailCheck = await checkContactRateLimit(`email:${rawEmail}`, "CONTACT_EMAIL", 900, 3);
    if (!emailCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: "You have already sent several messages recently. Please wait a few minutes before sending another.",
        remainingSeconds: emailCheck.remainingSeconds,
      });
    }

    const mailRes = await sendContactUsEmail({
      name: rawName,
      email: rawEmail,
      subject: rawSubject || "General Inquiry",
      message: rawMessage,
    });

    if (!mailRes?.sent) {
      return res.status(503).json({
        success: false,
        message: "We could not deliver your message right now. Please try again later or email us directly.",
      });
    }

    return res.json({
      success: true,
      message: "Your message has been sent. Our team will get back to you soon.",
    });
  } catch (err) {
    console.error("[Contact Route] Submission error:", err?.code || "CONTACT_ERROR");
    return res.status(500).json({
      success: false,
      message: "Unable to send your message right now. Please try again later.",
    });
  }
});

module.exports = router;
