const { pool } = require("../config/database");


async function listMessages(req, res) {
  try {
    const userId = Number(req.user.user_id);
    const conversationWith = req.query.conversationWith;

    let query = `
      SELECT
        m.message_id,
        m.sender_id,
        s.name AS sender_name,
        s.role AS sender_role,
        m.receiver_id,
        r.name AS receiver_name,
        r.role AS receiver_role,
        m.message,
        m.is_read,
        m.created_at
      FROM communication_messages m
      JOIN users s ON m.sender_id = s.user_id
      JOIN users r ON m.receiver_id = r.user_id
      WHERE (m.sender_id = ? OR m.receiver_id = ?)
    `;

    const params = [userId, userId];

    if (conversationWith !== undefined) {
      const otherUserId = Number(conversationWith);

      if (
        !Number.isInteger(otherUserId) ||
        otherUserId <= 0 ||
        otherUserId === userId
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation user ID."
        });
      }

      query += `
        AND (
          (m.sender_id = ? AND m.receiver_id = ?)
          OR
          (m.sender_id = ? AND m.receiver_id = ?)
        )
      `;

      params.push(userId, otherUserId, otherUserId, userId);
    }

    query += " ORDER BY m.created_at ASC";

    const [rows] = await pool.query(query, params);

    return res.json({
      success: true,
      messages: rows
    });
  } catch (error) {
    console.error("listMessages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve messages."
    });
  }
}


async function sendMessage(req, res) {
  try {
    const { receiver_id, message } = req.body;
    const senderId = req.user.user_id;
    const senderRole = req.user.role;

    if (
      receiver_id == null ||
      !message ||
      !String(message).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Receiver and message are required."
      });
    }

    const receiverId = Number(receiver_id);

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID."
      });
    }

    if (receiverId === Number(senderId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself."
      });
    }

    const [users] = await pool.query(
      "SELECT user_id, role FROM users WHERE user_id = ?",
      [receiverId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found."
      });
    }

    const receiverRole = users[0].role;

    // Direct messages are allowed only between coordinator
    // and seller/rider. Seller-to-seller, rider-to-rider,
    // and seller-to-rider messages are not allowed.
    const allowed =
      (senderRole === "coordinator" &&
        ["seller", "rider"].includes(receiverRole)) ||
      (["seller", "rider"].includes(senderRole) &&
        receiverRole === "coordinator");

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "Direct messages are only allowed between a coordinator and a seller or rider."
      });
    }

    const [result] = await pool.query(
      `INSERT INTO communication_messages
       (sender_id, receiver_id, message)
       VALUES (?, ?, ?)`,
      [senderId, receiverId, String(message).trim()]
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      message_id: result.insertId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message."
    });
  }
}


async function markRead(req, res) {
  try {
    const messageId = Number(req.params.messageId);

    if (!Number.isInteger(messageId) || messageId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID."
      });
    }

    const [result] = await pool.query(
      `UPDATE communication_messages
       SET is_read = TRUE
       WHERE message_id = ? AND receiver_id = ?`,
      [messageId, req.user.user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found or you are not its recipient."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message marked as read."
    });
  } catch (error) {
    console.error("markRead error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update message."
    });
  }
}


module.exports = { listMessages, sendMessage, markRead };