const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");
const { pool } = require("../config/database");
const { logAudit } = require("../utils/audit");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


async function createParcel(req, res) {
  try {
    const { transaction_number, receiver_name, receiver_contact, contents } = req.body;

    if (
      !transaction_number?.trim() ||
      !receiver_name?.trim() ||
      !receiver_contact?.trim() ||
      !contents?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction number, receiver name, receiver contact, and contents are required."
      });
    }

    const transactionNumber = transaction_number.trim();

    const [existing] = await pool.query(
      "SELECT parcel_id FROM parcels WHERE transaction_number = ?",
      [transactionNumber]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This transaction number is already registered."
      });
    }

    const parcelId = `SL${Date.now()}${Math.floor(Math.random() * 1000)}`;

    await pool.query(
      `INSERT INTO parcels
       (parcel_id, transaction_number, seller_id, receiver_name,
        receiver_contact, contents, status, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, 'WAITING_FOR_VIDEO', 'PENDING')`,
      [
        parcelId,
        transactionNumber,
        req.user.user_id,
        receiver_name.trim(),
        receiver_contact.trim(),
        contents.trim()
      ]
    );

    await logAudit(req.user, {
      category: "Parcels",
      action: "Registered parcel",
      target: parcelId,
      detail: `Transaction ${transactionNumber} for ${receiver_name.trim()}`,
      sellerId: req.user.user_id
    });

    res.status(201).json({
      success: true,
      message: "Parcel registered successfully.",
      parcel: {
        parcel_id: parcelId,
        transaction_number: transactionNumber,
        receiver_name: receiver_name.trim(),
        receiver_contact: receiver_contact.trim(),
        contents: contents.trim(),
        status: "WAITING_FOR_VIDEO",
        verification_status: "PENDING"
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to register parcel."
    });
  }
}

async function getParcelForRole(req, res) {
  try {
    const { parcelId } = req.params;

    const [rows] = await pool.query(
      `SELECT p.parcel_id, p.receiver_name, p.receiver_contact, p.contents,
              p.status, p.verification_status, p.created_at, p.updated_at,
              u.name AS seller_name, u.email AS seller_email
       FROM parcels p
       JOIN users u ON p.seller_id = u.user_id
       WHERE p.parcel_id = ?`,
      [parcelId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    const parcel = rows[0];

    if (req.user.role === "rider") {
      return res.json({
        success: true,
        parcel: {
          parcel_id: parcel.parcel_id,
          status: parcel.status,
          seller: parcel.seller_name,
          receiver: parcel.receiver_name,
          verification_status: parcel.verification_status
        }
      });
    }

    res.json({
      success: true,
      parcel: {
        ...parcel,
        seller: { name: parcel.seller_name, email: parcel.seller_email }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to retrieve parcel." });
  }
}

async function getSellerParcel(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email
       FROM parcels p JOIN users u ON p.seller_id = u.user_id
       WHERE p.parcel_id = ? AND p.seller_id = ?`,
      [req.params.parcelId, req.user.user_id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Parcel not found." });

    const [videos] = await pool.query(
      `SELECT video_id, file_name, file_size, mime_type, uploaded_at
       FROM video_proofs WHERE parcel_id = ? ORDER BY uploaded_at DESC`,
      [req.params.parcelId]
    );

    // Idinagdag: para makita ng seller ang remarks ng coordinator (hal. bakit hiningi ang reupload)
    const [verification_records] = await pool.query(
      `SELECT decision, remarks, verified_at
       FROM verification_records WHERE parcel_id = ? ORDER BY verified_at DESC`,
      [req.params.parcelId]
    );

    res.json({ success: true, parcel: rows[0], videos, verification_records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to retrieve seller parcel." });
  }
}


async function uploadVideo(req, res) {
  let uploadedAsset = null;
  let videoRecordSaved = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Video file is required."
      });
    }

    // Check parcel and ownership BEFORE uploading to Cloudinary
    const [parcelRows] = await pool.query(
      "SELECT parcel_id, seller_id, status FROM parcels WHERE parcel_id = ?",
      [req.params.parcelId]
    );

    if (!parcelRows.length) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found."
      });
    }

    const parcel = parcelRows[0];

    if (Number(parcel.seller_id) !== Number(req.user.user_id)) {
      return res.status(403).json({
        success: false,
        message: "You can only upload proof for your own parcels."
      });
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cloudinary environment variables are missing.");
    }

    const publicId = `video-${crypto.randomUUID()}`;

    // Upload video buffer to Cloudinary
    uploadedAsset = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "logisync/video-proofs",
          public_id: publicId
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    // Save Cloudinary URL and public ID
    const [result] = await pool.query(
      `INSERT INTO video_proofs
       (parcel_id, uploaded_by, file_name, file_path,
        cloudinary_public_id, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parcel.parcel_id,
        req.user.user_id,
        req.file.originalname,
        uploadedAsset.secure_url,
        uploadedAsset.public_id,
        req.file.size,
        req.file.mimetype
      ]
    );

    await pool.query(
      `UPDATE parcels
       SET status = 'VIDEO_SUBMITTED',
           verification_status = 'PENDING',
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [parcel.parcel_id]
    );

    await logAudit(req.user, {
      category: "Video",
      action: "Uploaded video proof",
      target: parcel.parcel_id,
      detail: req.file.originalname,
      sellerId: parcel.seller_id
    });

    return res.status(201).json({
      success: true,
      message: "Video proof uploaded successfully.",
      video: {
        video_id: result.insertId,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype
      }
    });

  } catch (error) {
    // Remove uploaded Cloudinary asset if database saving fails
    if (uploadedAsset?.public_id) {
      try {
        await cloudinary.uploader.destroy(
          uploadedAsset.public_id,
          { resource_type: "video" }
        );
      } catch (cleanupError) {
        console.error("Cloudinary cleanup failed:", cleanupError);
      }
    }

    console.error("Video upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Video upload failed."
    });
  }
}


async function getCoordinatorParcel(req, res) {
  try {
    const [parcelRows] = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email
       FROM parcels p JOIN users u ON p.seller_id = u.user_id
       WHERE p.parcel_id = ?`,
      [req.params.parcelId]
    );

    if (!parcelRows.length) return res.status(404).json({ success: false, message: "Parcel not found." });

    const [videos] = await pool.query(
      `SELECT vp.video_id, vp.file_name, vp.file_path, vp.file_size, vp.mime_type,
              vp.uploaded_at, u.name AS uploaded_by_name
       FROM video_proofs vp
       JOIN users u ON vp.uploaded_by = u.user_id
       WHERE vp.parcel_id = ?
       ORDER BY vp.uploaded_at DESC`,
      [req.params.parcelId]
    );

    const [records] = await pool.query(
      `SELECT vr.verification_id, vr.decision, vr.remarks, vr.verified_at,
              u.name AS coordinator_name
       FROM verification_records vr
       JOIN users u ON vr.coordinator_id = u.user_id
       WHERE vr.parcel_id = ?
       ORDER BY vr.verified_at DESC`,
      [req.params.parcelId]
    );

    res.json({ success: true, parcel: parcelRows[0], videos, verification_records: records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to retrieve coordinator parcel." });
  }
}

async function verifyParcel(req, res) {
  return saveDecision(req, res, "VERIFY");
}

async function rejectParcel(req, res) {
  return saveDecision(req, res, "REJECT");
}

async function requestReupload(req, res) {
  return saveDecision(req, res, "REQUEST_REUPLOAD");
}

async function saveDecision(req, res, decision) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [parcels] = await connection.query(
      "SELECT parcel_id, seller_id FROM parcels WHERE parcel_id = ? FOR UPDATE",
      [req.params.parcelId]
    );

    if (!parcels.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    let verificationStatus = "PENDING";
    let parcelStatus = "VIDEO_SUBMITTED";

    if (decision === "VERIFY") {
      verificationStatus = "VERIFIED";
      parcelStatus = "VERIFIED";
    } else if (decision === "REJECT") {
      verificationStatus = "REJECTED";
      parcelStatus = "REJECTED";
    } else {
      verificationStatus = "REUPLOAD_REQUESTED";
      parcelStatus = "REUPLOAD_REQUESTED";
    }

    const remarks = req.body.remarks || null;

    await connection.query(
      `INSERT INTO verification_records (parcel_id, coordinator_id, decision, remarks)
       VALUES (?, ?, ?, ?)`,
      [req.params.parcelId, req.user.user_id, decision, remarks]
    );

    await connection.query(
      `UPDATE parcels SET status = ?, verification_status = ?, updated_at = NOW()
       WHERE parcel_id = ?`,
      [parcelStatus, verificationStatus, req.params.parcelId]
    );

    await connection.commit();

    const decisionLabel = { VERIFY: "Verified parcel", REJECT: "Rejected parcel", REQUEST_REUPLOAD: "Requested reupload" };
    await logAudit(req.user, {
      category: "Verification",
      action: decisionLabel[decision],
      target: req.params.parcelId,
      detail: remarks,
      sellerId: parcels[0].seller_id
    });

    res.json({
      success: true,
      message: `Parcel ${decision.toLowerCase().replace("_", " ")} successfully.`,
      parcel_id: req.params.parcelId,
      decision,
      verification_status: verificationStatus
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to save verification decision." });
  } finally {
    connection.release();
  }
}


async function streamVideo(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT file_path, file_name, mime_type
       FROM video_proofs
       WHERE video_id = ?`,
      [req.params.videoId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const video = rows[0];

    // Only allow redirects to Cloudinary HTTPS URLs
    let videoUrl;

    try {
      videoUrl = new URL(video.file_path);
    } catch (_) {
      return res.status(404).json({
        success: false,
        message: "Invalid video storage URL."
      });
    }

    if (
      videoUrl.protocol !== "https:" ||
      videoUrl.hostname !== "res.cloudinary.com"
    ) {
      return res.status(404).json({
        success: false,
        message: "Video storage URL is invalid."
      });
    }

    return res.redirect(302, videoUrl.toString());

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to load video."
    });
  }
}


// GET /api/parcels  -> seller: sariling parcels lang | coordinator: lahat
async function listParcels(req, res) {
  try {
    const isCoordinator = req.user.role === "coordinator";
    const params = [];
    let where = "";

    if (!isCoordinator) {
      where = "WHERE p.seller_id = ?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(
      `SELECT p.parcel_id, p.transaction_number, p.receiver_name, p.receiver_contact,
              p.contents, p.status, p.verification_status, p.created_at, p.updated_at,
              p.rider_id, p.delivery_status, p.delivery_note, p.scanned_at, p.delivered_at,
              u.name AS seller_name, r.name AS rider_name
       FROM parcels p
       JOIN users u ON p.seller_id = u.user_id
       LEFT JOIN users r ON p.rider_id = r.user_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({ success: true, parcels: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to list parcels." });
  }
}

// GET /api/parcels/by-transaction/:transactionNumber
// Hinahanap ang parcel gamit ang transaction number (galing sa Shopee QR), tapos ginagamit
// ang parehong function at response shape ng bawat role para walang nasirang rule:
//   seller -> getSellerParcel (sariling parcel lang) | coordinator -> getCoordinatorParcel
//   rider  -> getParcelForRole (limitadong impormasyon)
async function getParcelByTransaction(req, res) {
  try {
    const transactionNumber = String(req.params.transactionNumber || "").trim();
    if (!transactionNumber) {
      return res.status(400).json({ success: false, message: "Transaction number is required." });
    }

    const [rows] = await pool.query(
      "SELECT parcel_id, seller_id FROM parcels WHERE transaction_number = ?",
      [transactionNumber]
    );

    // Pareho ang 404 kung wala o hindi sa seller, para hindi malaman kung may ibang seller na may ganyang number
    if (!rows.length || (req.user.role === "seller" && rows[0].seller_id !== req.user.user_id)) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    req.params.parcelId = rows[0].parcel_id;

    if (req.user.role === "seller") return getSellerParcel(req, res);
    if (req.user.role === "coordinator") return getCoordinatorParcel(req, res);
    return getParcelForRole(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to look up parcel." });
  }
}

// ---------------- RIDER DELIVERY ----------------
// Daloy: VERIFIED na parcel -> i-scan ng rider (TO_DELIVER) -> DELIVERED o FAILED (may dahilan).
// Ang unang rider na nag-scan ang "may hawak" ng parcel; hindi ito pwedeng kunin ng ibang rider.

async function loadRiderParcel(req, res) {
  const [rows] = await pool.query(
    "SELECT parcel_id, seller_id, status, rider_id, delivery_status FROM parcels WHERE parcel_id = ?",
    [req.params.parcelId]
  );
  if (!rows.length) {
    res.status(404).json({ success: false, message: "Parcel not found." });
    return null;
  }
  return rows[0];
}

async function riderScanParcel(req, res) {
  try {
    const parcel = await loadRiderParcel(req, res);
    if (!parcel) return;

    if (parcel.status !== "VERIFIED") {
      return res.status(409).json({ success: false, message: "This parcel is not verified yet, so it cannot be delivered." });
    }
    if (parcel.rider_id && parcel.rider_id !== req.user.user_id) {
      return res.status(409).json({ success: false, message: "This parcel is already assigned to another rider." });
    }
    if (parcel.delivery_status === "DELIVERED") {
      return res.status(409).json({ success: false, message: "This parcel was already delivered." });
    }

    const retry = parcel.delivery_status === "FAILED";
    await pool.query(
      `UPDATE parcels
       SET rider_id = ?, delivery_status = 'TO_DELIVER', delivery_note = NULL,
           scanned_at = COALESCE(scanned_at, NOW()), updated_at = NOW()
       WHERE parcel_id = ?`,
      [req.user.user_id, parcel.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: retry ? "Retrying delivery" : "Scanned parcel for delivery",
      target: parcel.parcel_id,
      sellerId: parcel.seller_id,
      riderId: req.user.user_id
    });

    res.json({ success: true, parcel_id: parcel.parcel_id, delivery_status: "TO_DELIVER" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to record the scan." });
  }
}

async function finishDelivery(req, res, outcome) {
  try {
    const parcel = await loadRiderParcel(req, res);
    if (!parcel) return;

    if (parcel.rider_id !== req.user.user_id || parcel.delivery_status !== "TO_DELIVER") {
      return res.status(409).json({ success: false, message: "Scan this parcel first. It must be in your To Be Delivered list." });
    }

    const note = String(req.body?.note || req.body?.reason || "").trim().slice(0, 500);
    if (outcome === "FAILED" && !note) {
      return res.status(400).json({ success: false, message: "A reason is required for a failed delivery." });
    }

    await pool.query(
      `UPDATE parcels
       SET delivery_status = ?, delivery_note = ?,
           delivered_at = ${outcome === "DELIVERED" ? "NOW()" : "NULL"}, updated_at = NOW()
       WHERE parcel_id = ?`,
      [outcome, note || null, parcel.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: outcome === "DELIVERED" ? "Delivered parcel" : "Failed delivery",
      target: parcel.parcel_id,
      detail: note || null,
      sellerId: parcel.seller_id,
      riderId: req.user.user_id
    });

    res.json({ success: true, parcel_id: parcel.parcel_id, delivery_status: outcome });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update the delivery." });
  }
}

const riderDelivered = (req, res) => finishDelivery(req, res, "DELIVERED");
const riderFailed = (req, res) => finishDelivery(req, res, "FAILED");

// GET /api/parcels/rider/mine -> mga parcel na na-scan ng rider na ito (limitado ang impormasyon)
async function listRiderParcels(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, receiver_name, contents, status,
              delivery_status, delivery_note, scanned_at, delivered_at, updated_at
       FROM parcels WHERE rider_id = ? ORDER BY updated_at DESC`,
      [req.user.user_id]
    );
    res.json({ success: true, parcels: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to list your parcels." });
  }
}

module.exports = {
  riderScanParcel,
  riderDelivered,
  riderFailed,
  listRiderParcels,
  listParcels,
  getParcelByTransaction,
  createParcel,
  getParcelForRole,
  getSellerParcel,
  uploadVideo,
  getCoordinatorParcel,
  verifyParcel,
  rejectParcel,
  requestReupload,
  streamVideo
};
