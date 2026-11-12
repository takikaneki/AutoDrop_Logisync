const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");
const { pool, rawPool } = require("../config/database");
const { logAudit } = require("../utils/audit");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const VALID_CONTENT_CATEGORIES = [
  "Clothing and Accessories",
  "Beauty and Personal Care",
  "Health and Wellness Products",
  "Personal or Intimate Products",
  "Electronics and Gadgets",
  "Household Items",
  "Other"
];

const DISCREET_ELIGIBLE_CATEGORIES = new Set([
  "Clothing and Accessories",
  "Personal or Intimate Products",
  "Other"
]);

const PROHIBITED_OR_HIGH_RISK_KEYWORDS = [
  "weapon",
  "gun",
  "firearm",
  "ammo",
  "ammunition",
  "explosive",
  "firework",
  "flammable",
  "acid",
  "poison",
  "toxic",
  "narcotic",
  "marijuana",
  "weed",
  "cocaine",
  "meth",
  "illegal",
  "contraband",
  "counterfeit",
  "fake id",
  "passport",
  "cash",
  "banknote",
  "live animal",
  "lighter fluid",
  "butane",
  "knife",
  "blade",
  "taser"
];

const EVASIVE_DISCREET_PHRASES = [
  "none of your business",
  "dont look",
  "don't look",
  "no video",
  "skip verification",
  "bypass",
  "secret item",
  "just approve",
  "confidential do not open",
  "nothing to see"
];

let customerSchemaReady = false;
let customerSchemaPromise = null;

async function ensureCustomerSchema() {
  if (customerSchemaReady) return;
  if (customerSchemaPromise) return customerSchemaPromise;
  customerSchemaPromise = (async () => {
    try {
      await rawPool.query(`
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_address VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_house_number VARCHAR(100);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_street VARCHAR(150);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_barangay VARCHAR(150);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_city VARCHAR(150);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_province VARCHAR(150);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS content_category VARCHAR(100);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS other_category_description VARCHAR(255);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discrete_item BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discreet_reason VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discreet_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUESTED';
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discreet_review_remarks VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discreet_reviewed_at TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS discreet_reviewed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS declaration_flagged BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS declaration_flag_reason VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_proof TEXT;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS scheduled_for VARCHAR(20);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS rescheduled BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS return_to_hub BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS return_to_hub_at TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS return_coordinated BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS return_note VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS last_failure VARCHAR(500);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_attempts TEXT;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS is_cod BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'NON_COD';
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS rts_status VARCHAR(40);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS hub_verified_at TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS hub_verified_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS rts_dispatched_at TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS rts_dispatched_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS returned_to_seller_at TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS returned_received_by VARCHAR(150);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_hold BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_hold_reason VARCHAR(255);
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_hold_until TIMESTAMPTZ;
        ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_hold_at TIMESTAMPTZ;

        ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_status_check;
        ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_delivery_status_check;

        CREATE TABLE IF NOT EXISTS rider_incidents (
          incident_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          rider_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
          incident_type VARCHAR(100) NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status VARCHAR(30) NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'CONFIRMED', 'RESOLVED')),
          hold_active BOOLEAN NOT NULL DEFAULT TRUE,
          hold_until TIMESTAMPTZ,
          coordinator_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
          coordinator_action VARCHAR(50),
          coordinator_notes TEXT,
          action_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_rider_incidents_rider ON rider_incidents(rider_id);
        CREATE INDEX IF NOT EXISTS idx_rider_incidents_status ON rider_incidents(status);

        CREATE TABLE IF NOT EXISTS seller_customers (
          customer_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          seller_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
          normalized_name VARCHAR(150) NOT NULL,
          receiver_name VARCHAR(150) NOT NULL,
          receiver_contact VARCHAR(50) NOT NULL DEFAULT '',
          receiver_address VARCHAR(500) NOT NULL DEFAULT '',
          receiver_house_number VARCHAR(100) NOT NULL DEFAULT '',
          receiver_street VARCHAR(150) NOT NULL DEFAULT '',
          receiver_barangay VARCHAR(150) NOT NULL DEFAULT '',
          receiver_city VARCHAR(150) NOT NULL DEFAULT '',
          receiver_province VARCHAR(150) NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_seller_customer_name UNIQUE (seller_id, normalized_name)
        );

        ALTER TABLE seller_customers ADD COLUMN IF NOT EXISTS receiver_house_number VARCHAR(100) NOT NULL DEFAULT '';
        ALTER TABLE seller_customers ADD COLUMN IF NOT EXISTS receiver_street VARCHAR(150) NOT NULL DEFAULT '';
        ALTER TABLE seller_customers ADD COLUMN IF NOT EXISTS receiver_barangay VARCHAR(150) NOT NULL DEFAULT '';
        ALTER TABLE seller_customers ADD COLUMN IF NOT EXISTS receiver_city VARCHAR(150) NOT NULL DEFAULT '';
        ALTER TABLE seller_customers ADD COLUMN IF NOT EXISTS receiver_province VARCHAR(150) NOT NULL DEFAULT '';

        CREATE INDEX IF NOT EXISTS idx_seller_customers_seller ON seller_customers(seller_id);
      `);
      customerSchemaReady = true;
    } catch (err) {
      console.warn("ensureCustomerSchema warning:", err.message);
    } finally {
      customerSchemaPromise = null;
    }
  })();
  return customerSchemaPromise;
}

function evaluateDeclarationRisk({
  content_category,
  other_category_description,
  contents,
  discrete_item,
  discreet_reason
}) {
  const reasons = [];
  const combinedText = `${contents || ""} ${other_category_description || ""} ${discreet_reason || ""}`.toLowerCase();

  // 1. Check prohibited / high-risk keywords
  const matchedProhibited = PROHIBITED_OR_HIGH_RISK_KEYWORDS.filter((kw) =>
    combinedText.includes(kw)
  );
  if (matchedProhibited.length > 0) {
    reasons.push(
      `Declaration contains high-risk or restricted keywords (${matchedProhibited.slice(0, 3).join(", ")}) requiring strict video inspection.`
    );
  }

  // 2. Check category vs. item description consistency
  const lowerContents = `${contents || ""} ${other_category_description || ""}`.toLowerCase();
  if (
    content_category === "Clothing and Accessories" &&
    /\b(laptop|phone|tablet|medicine|pill|capsule|vitamin|liquid|chemical|battery|powerbank|document|contract)\b/i.test(lowerContents)
  ) {
    reasons.push(
      `Declared category ("${content_category}") may conflict with item description ("${contents}").`
    );
  }

  // 3. Check discreet handling risk factors
  if (discrete_item) {
    if (content_category === "Other") {
      reasons.push(
        `Seller requested discreet handling under the "Other" category (${other_category_description || "unspecified"}). Verify video carefully against misdeclaration.`
      );
    } else if (!DISCREET_ELIGIBLE_CATEGORIES.has(content_category)) {
      reasons.push(
        `Discreet handling requested for "${content_category}", which does not support discreet handling.`
      );
    }

    const lowerReason = String(discreet_reason || "").trim().toLowerCase();
    const matchedEvasive = EVASIVE_DISCREET_PHRASES.find((phrase) =>
      lowerReason.includes(phrase)
    );
    if (matchedEvasive) {
      reasons.push(
        `Discreet handling explanation appears evasive ("${matchedEvasive}") or attempts to bypass standard inspection.`
      );
    }

    // Check if contents description is overly generic while requesting discreet handling
    if (
      String(contents || "").trim().length < 4 ||
      /^(item|stuff|box|parcel|package|goods|thing|secret|private|n\/a|none)$/i.test(
        String(contents || "").trim()
      )
    ) {
      reasons.push(
        `Item description ("${contents}") is overly vague for a discreet handling request.`
      );
    }
  }

  return {
    flagged: reasons.length > 0,
    flagReason: reasons.join(" ")
  };
}

function isValidTransactionNumber(tx) {
  return /^SPX\d{9}$/i.test(String(tx || "").trim());
}

function isGibberishName(str) {
  const s = String(str || "").trim().toLowerCase();
  if (s.length < 2) return true;
  const lettersOnly = s.replace(/[^a-z]/g, "");
  if (lettersOnly.length < 2) return true;
  if (!/[aeiouy]/.test(lettersOnly)) return true;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(lettersOnly)) return true;
  if (/(.)\1{2,}/.test(lettersOnly)) return true;
  const mashes = ["asdf", "qwer", "zxcv", "hjkl", "ghjk", "dfgh", "wert", "xcvb", "fghj", "jklm", "whejsh"];
  for (const m of mashes) {
    if (lettersOnly.includes(m)) return true;
  }
  return false;
}

function isMeaningfulDescription(str) {
  const s = String(str || "").trim();
  if (s.length < 3) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  const lettersOnly = s.toLowerCase().replace(/[^a-z]/g, "");
  if (lettersOnly.length < 2) return false;
  if (!/[aeiouy]/.test(lettersOnly)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const cleanWord = w.toLowerCase().replace(/[^a-z]/g, "");
    if (cleanWord.length >= 5) {
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(cleanWord)) return false;
      if (/(.)\1{2,}/.test(cleanWord)) return false;
      const mashes = ["asdf", "qwer", "zxcv", "hjkl", "ghjk", "dfgh", "wert", "xcvb", "fghj", "jklm", "whejsh"];
      for (const m of mashes) {
        if (cleanWord.includes(m)) return false;
      }
    }
  }
  return true;
}

function normalizeCustomerName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function upsertSellerCustomer(
  sellerId,
  {
    name,
    contact,
    address,
    house_number = "",
    street = "",
    barangay = "",
    city = "",
    province = "",
    updateExisting = false
  }
) {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeCustomerName(cleanName);
  if (!normalizedName || !sellerId) return null;

  const cleanContact = String(contact || "").trim();
  const cleanHouseNumber = String(house_number || "").trim();
  const cleanStreet = String(street || "").trim();
  const cleanBarangay = String(barangay || "").trim();
  const cleanCity = String(city || "").trim();
  const cleanProvince = String(province || "").trim();

  let cleanAddress = String(address || "").trim();
  if (!cleanAddress && (cleanStreet || cleanBarangay || cleanCity)) {
    cleanAddress = [cleanHouseNumber, cleanStreet, cleanBarangay, cleanCity, cleanProvince]
      .filter(Boolean)
      .join(", ");
  }

  await ensureCustomerSchema();

  const [existingRows] = await pool.query(
    `SELECT customer_id, receiver_name, receiver_contact, receiver_address,
            receiver_house_number, receiver_street, receiver_barangay, receiver_city, receiver_province
     FROM seller_customers
     WHERE seller_id = ? AND normalized_name = ?`,
    [sellerId, normalizedName]
  );

  if (!existingRows.length) {
    const [inserted] = await pool.query(
      `INSERT INTO seller_customers
       (seller_id, normalized_name, receiver_name, receiver_contact, receiver_address,
        receiver_house_number, receiver_street, receiver_barangay, receiver_city, receiver_province)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        normalizedName,
        cleanName,
        cleanContact,
        cleanAddress,
        cleanHouseNumber,
        cleanStreet,
        cleanBarangay,
        cleanCity,
        cleanProvince
      ]
    );
    return inserted[0] || null;
  }

  const cur = existingRows[0];
  const nextContact = updateExisting
    ? cleanContact || cur.receiver_contact || ""
    : cur.receiver_contact || cleanContact || "";
  const nextAddress = updateExisting
    ? cleanAddress || cur.receiver_address || ""
    : cur.receiver_address || cleanAddress || "";
  const nextHouse = updateExisting
    ? cleanHouseNumber || cur.receiver_house_number || ""
    : cur.receiver_house_number || cleanHouseNumber || "";
  const nextStreet = updateExisting
    ? cleanStreet || cur.receiver_street || ""
    : cur.receiver_street || cleanStreet || "";
  const nextBarangay = updateExisting
    ? cleanBarangay || cur.receiver_barangay || ""
    : cur.receiver_barangay || cleanBarangay || "";
  const nextCity = updateExisting
    ? cleanCity || cur.receiver_city || ""
    : cur.receiver_city || cleanCity || "";
  const nextProvince = updateExisting
    ? cleanProvince || cur.receiver_province || ""
    : cur.receiver_province || cleanProvince || "";
  const nextName = updateExisting ? cleanName : cur.receiver_name || cleanName;

  await pool.query(
    `UPDATE seller_customers
     SET receiver_name = ?,
         receiver_contact = ?,
         receiver_address = ?,
         receiver_house_number = ?,
         receiver_street = ?,
         receiver_barangay = ?,
         receiver_city = ?,
         receiver_province = ?,
         updated_at = NOW()
     WHERE customer_id = ? AND seller_id = ?`,
    [
      nextName,
      nextContact,
      nextAddress,
      nextHouse,
      nextStreet,
      nextBarangay,
      nextCity,
      nextProvince,
      cur.customer_id,
      sellerId
    ]
  );

  return {
    customer_id: cur.customer_id,
    receiver_name: nextName,
    receiver_contact: nextContact,
    receiver_address: nextAddress,
    receiver_house_number: nextHouse,
    receiver_street: nextStreet,
    receiver_barangay: nextBarangay,
    receiver_city: nextCity,
    receiver_province: nextProvince
  };
}

// GET /api/parcels/customers (seller only)
// Retrieves saved customers exclusively for the logged-in seller from the database.
async function listSellerCustomers(req, res) {
  try {
    await ensureCustomerSchema();
    const sellerId = req.user.user_id;

    // Backfill any real parcels created by this seller (excluding sample seed PX123456)
    await rawPool.query(
      `INSERT INTO seller_customers (seller_id, normalized_name, receiver_name, receiver_contact, receiver_address, created_at, updated_at)
       SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(BTRIM(p.receiver_name), '\\s+', ' ', 'g')))
         p.seller_id,
         LOWER(REGEXP_REPLACE(BTRIM(p.receiver_name), '\\s+', ' ', 'g')) AS normalized_name,
         BTRIM(p.receiver_name) AS receiver_name,
         COALESCE(BTRIM(p.receiver_contact), '') AS receiver_contact,
         COALESCE(BTRIM(p.receiver_address), '') AS receiver_address,
         COALESCE(p.created_at, CURRENT_TIMESTAMP),
         COALESCE(p.updated_at, CURRENT_TIMESTAMP)
       FROM parcels p
       WHERE p.seller_id = $1
         AND p.receiver_name IS NOT NULL
         AND BTRIM(p.receiver_name) <> ''
         AND p.parcel_id <> 'PX123456'
       ORDER BY LOWER(REGEXP_REPLACE(BTRIM(p.receiver_name), '\\s+', ' ', 'g')), p.created_at DESC
       ON CONFLICT (seller_id, normalized_name) DO UPDATE
       SET receiver_address = CASE
             WHEN seller_customers.receiver_address = '' AND EXCLUDED.receiver_address <> ''
             THEN EXCLUDED.receiver_address
             ELSE seller_customers.receiver_address
           END,
           receiver_contact = CASE
             WHEN seller_customers.receiver_contact = '' AND EXCLUDED.receiver_contact <> ''
             THEN EXCLUDED.receiver_contact
             ELSE seller_customers.receiver_contact
           END`,
      [sellerId]
    );

    const [rows] = await pool.query(
      `SELECT customer_id,
              receiver_name AS name,
              COALESCE(receiver_contact, '') AS contact,
              COALESCE(receiver_address, '') AS address,
              COALESCE(receiver_house_number, '') AS house_number,
              COALESCE(receiver_street, '') AS street,
              COALESCE(receiver_barangay, '') AS barangay,
              COALESCE(receiver_city, '') AS city,
              COALESCE(receiver_province, '') AS province,
              updated_at
       FROM seller_customers
       WHERE seller_id = ?
       ORDER BY updated_at DESC, receiver_name ASC`,
      [sellerId]
    );

    res.json({ success: true, customers: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to retrieve saved customers." });
  }
}

async function createParcel(req, res) {
  try {
    await ensureCustomerSchema();

    const {
      transaction_number,
      receiver_name,
      receiver_contact,
      receiver_address = "",
      receiver_house_number = "",
      receiver_street = "",
      receiver_barangay = "",
      receiver_city = "",
      receiver_province = "",
      contents,
      content_category = "",
      other_category_description = "",
      discrete_item = false,
      discreet_reason = "",
      is_cod = false,
      payment_method = "NON_COD",
      updateExistingCustomer = false
    } = req.body;

    const isCod = Boolean(is_cod || String(payment_method || "").toUpperCase() === "COD");
    const resolvedPaymentMethod = isCod ? "COD" : "NON_COD";

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

    const cleanCategory = String(content_category || "").trim();
    if (!VALID_CONTENT_CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid parcel content category."
      });
    }

    const cleanOtherCategoryDescription =
      cleanCategory === "Other" ? String(other_category_description || "").trim() : "";

    if (cleanCategory === "Other" && cleanOtherCategoryDescription.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please provide a short description for the 'Other' content category."
      });
    }

    const isDiscrete =
      Boolean(discrete_item) && DISCREET_ELIGIBLE_CATEGORIES.has(cleanCategory);
    const cleanDiscreetReason = isDiscrete ? String(discreet_reason || "").trim() : "";

    if (isDiscrete && cleanDiscreetReason.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please provide a clear explanation (at least 10 characters) of why discreet handling is needed."
      });
    }

    const transactionNumber = String(transaction_number || "").trim().toUpperCase();
    if (!isValidTransactionNumber(transactionNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction number. Must follow the format SPX123456789 (SPX followed by exactly 9 digits)."
      });
    }

    const cleanReceiverName = String(receiver_name || "").trim().replace(/\s+/g, " ");
    if (cleanReceiverName.length < 2 || cleanReceiverName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Customer / Receiver name must be between 2 and 100 characters."
      });
    }
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]*[A-Za-zÀ-ÿ.]$/.test(cleanReceiverName) || isGibberishName(cleanReceiverName)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid customer / receiver name (meaningless or random characters are not allowed)."
      });
    }

    const cleanReceiverContact = String(receiver_contact || "")
      .trim()
      .replace(/^\+639/, "09");
    if (!/^09\d{9}$/.test(cleanReceiverContact)) {
      return res.status(400).json({
        success: false,
        message: "Receiver contact number must be a valid 11-digit mobile number starting with 09 (numbers only)."
      });
    }
    const cleanHouseNumber = String(receiver_house_number || "").trim();
    const cleanStreet = String(receiver_street || "").trim();
    const cleanBarangay = String(receiver_barangay || "").trim();
    const cleanCity = String(receiver_city || "").trim();
    const cleanProvince = String(receiver_province || "").trim();

    if (!cleanStreet || cleanStreet.length < 3) {
      return res.status(400).json({
        success: false,
        message: "House/unit number and street name is required (minimum 3 characters)."
      });
    }
    if (!cleanBarangay) {
      return res.status(400).json({
        success: false,
        message: "Barangay is required. Please select or enter a barangay."
      });
    }
    if (!cleanCity) {
      return res.status(400).json({
        success: false,
        message: "City or municipality is required."
      });
    }
    if (!cleanProvince) {
      return res.status(400).json({
        success: false,
        message: "Province is required."
      });
    }

    let cleanReceiverAddress = String(receiver_address || "").trim();
    if (!cleanReceiverAddress && (cleanStreet || cleanBarangay || cleanCity)) {
      cleanReceiverAddress = [cleanHouseNumber, cleanStreet, cleanBarangay, cleanCity, cleanProvince]
        .filter(Boolean)
        .join(", ");
    }
    const cleanContents = String(contents || "").trim();
    if (cleanContents.length < 3 || cleanContents.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Parcel item description / contents must be between 3 and 255 characters."
      });
    }
    if (!isMeaningfulDescription(cleanContents)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a meaningful parcel item description (meaningless or random characters like 'whejshsh' are not allowed)."
      });
    }

    // Discreet requests always start as PENDING_REVIEW so they never auto-approve a parcel
    const discreetStatus = isDiscrete ? "PENDING_REVIEW" : "NOT_REQUESTED";

    const riskAssessment = evaluateDeclarationRisk({
      content_category: cleanCategory,
      other_category_description: cleanOtherCategoryDescription,
      contents: cleanContents,
      discrete_item: isDiscrete,
      discreet_reason: cleanDiscreetReason
    });

    const [existing] = await pool.query(
      "SELECT parcel_id, seller_id FROM parcels WHERE UPPER(transaction_number) = ?",
      [transactionNumber]
    );

    if (existing.length > 0) {
      const isMine = Number(existing[0].seller_id) === Number(req.user.user_id);
      if (isMine) {
        return res.status(409).json({
          success: false,
          message: `You have already registered a parcel with this transaction number (${transactionNumber}). Duplicate submissions are not allowed.`
        });
      }
      return res.status(409).json({
        success: false,
        message: "This transaction number is already registered in the system."
      });
    }

    const parcelId = `SL${Date.now()}${Math.floor(Math.random() * 1000)}`;

    await pool.query(
      `INSERT INTO parcels
       (parcel_id, transaction_number, seller_id, receiver_name,
        receiver_contact, receiver_address,
        receiver_house_number, receiver_street, receiver_barangay, receiver_city, receiver_province,
        contents, content_category, other_category_description,
        discrete_item, discreet_reason, discreet_status,
        declaration_flagged, declaration_flag_reason,
        is_cod, payment_method,
        status, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING_FOR_VIDEO', 'PENDING')`,
      [
        parcelId,
        transactionNumber,
        req.user.user_id,
        cleanReceiverName,
        cleanReceiverContact,
        cleanReceiverAddress,
        cleanHouseNumber,
        cleanStreet,
        cleanBarangay,
        cleanCity,
        cleanProvince,
        cleanContents,
        cleanCategory,
        cleanOtherCategoryDescription || null,
        isDiscrete,
        cleanDiscreetReason || null,
        discreetStatus,
        riskAssessment.flagged,
        riskAssessment.flagReason || null,
        isCod,
        resolvedPaymentMethod
      ]
    );

    // Save or update this customer in the database for the logged-in seller (preventing duplicates)
    const savedCustomer = await upsertSellerCustomer(req.user.user_id, {
      name: cleanReceiverName,
      contact: cleanReceiverContact,
      address: cleanReceiverAddress,
      house_number: cleanHouseNumber,
      street: cleanStreet,
      barangay: cleanBarangay,
      city: cleanCity,
      province: cleanProvince,
      updateExisting: Boolean(updateExistingCustomer)
    });

    await logAudit(req.user, {
      category: "Parcels",
      action: "Registered parcel",
      target: parcelId,
      detail: `Transaction ${transactionNumber} for ${cleanReceiverName} (${cleanCategory}${isDiscrete ? " · Discreet requested" : ""})`,
      sellerId: req.user.user_id
    });

    await logAudit(req.user, {
      category: "Declaration",
      action: isDiscrete
        ? "Declared contents & requested discreet handling"
        : "Declared parcel content category",
      target: parcelId,
      detail: `Category: ${cleanCategory}${cleanOtherCategoryDescription ? ` (${cleanOtherCategoryDescription})` : ""} | Item: ${cleanContents} | Discreet: ${isDiscrete ? `Yes — "${cleanDiscreetReason}"` : "No"}`,
      sellerId: req.user.user_id
    });

    if (riskAssessment.flagged) {
      await logAudit(req.user, {
        category: "Declaration",
        action: "Declaration flagged for Coordinator review",
        target: parcelId,
        detail: riskAssessment.flagReason,
        sellerId: req.user.user_id
      });
    }

    res.status(201).json({
      success: true,
      message: "Parcel registered successfully.",
      parcel: {
        parcel_id: parcelId,
        transaction_number: transactionNumber,
        receiver_name: cleanReceiverName,
        receiver_contact: cleanReceiverContact,
        receiver_address: cleanReceiverAddress,
        receiver_house_number: cleanHouseNumber,
        receiver_street: cleanStreet,
        receiver_barangay: cleanBarangay,
        receiver_city: cleanCity,
        receiver_province: cleanProvince,
        contents: cleanContents,
        content_category: cleanCategory,
        other_category_description: cleanOtherCategoryDescription || null,
        discrete_item: isDiscrete,
        discreet_reason: cleanDiscreetReason || null,
        discreet_status: discreetStatus,
        declaration_flagged: riskAssessment.flagged,
        declaration_flag_reason: riskAssessment.flagReason || null,
        status: "WAITING_FOR_VIDEO",
        verification_status: "PENDING"
      },
      customer: savedCustomer
        ? {
            name: savedCustomer.receiver_name,
            contact: savedCustomer.receiver_contact,
            address: savedCustomer.receiver_address,
            house_number: savedCustomer.receiver_house_number || "",
            street: savedCustomer.receiver_street || "",
            barangay: savedCustomer.receiver_barangay || "",
            city: savedCustomer.receiver_city || "",
            province: savedCustomer.receiver_province || ""
          }
        : null
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
    await ensureCustomerSchema();
    const key = String(req.params.parcelId || "").trim();

    let rows = [];
    try {
      [rows] = await pool.query(
        `SELECT p.parcel_id, p.transaction_number, p.seller_id, p.receiver_name,
                COALESCE(NULLIF(BTRIM(p.receiver_contact), ''), sc.receiver_contact, '') AS receiver_contact,
                COALESCE(NULLIF(BTRIM(p.receiver_address), ''), sc.receiver_address, '') AS receiver_address,
                COALESCE(NULLIF(BTRIM(p.receiver_house_number), ''), sc.receiver_house_number, '') AS receiver_house_number,
                COALESCE(NULLIF(BTRIM(p.receiver_street), ''), sc.receiver_street, '') AS receiver_street,
                COALESCE(NULLIF(BTRIM(p.receiver_barangay), ''), sc.receiver_barangay, '') AS receiver_barangay,
                COALESCE(NULLIF(BTRIM(p.receiver_city), ''), sc.receiver_city, '') AS receiver_city,
                COALESCE(NULLIF(BTRIM(p.receiver_province), ''), sc.receiver_province, '') AS receiver_province,
                p.contents, p.content_category, p.other_category_description,
                p.discrete_item, p.discreet_reason, p.discreet_status,
                p.discreet_review_remarks, p.discreet_reviewed_at,
                p.declaration_flagged, p.declaration_flag_reason,
                p.status, p.verification_status,
                p.rider_id, p.delivery_status, p.delivery_note, p.delivery_proof,
                p.scheduled_for, p.rescheduled, p.reschedule_count,
                p.return_to_hub, p.return_to_hub_at, p.return_coordinated, p.return_note,
                p.last_failure, p.delivery_attempts,
                p.scanned_at, p.delivered_at, p.created_at, p.updated_at,
                u.name AS seller_name, u.email AS seller_email
         FROM parcels p
         JOIN users u ON p.seller_id = u.user_id
         LEFT JOIN seller_customers sc
           ON sc.seller_id = p.seller_id
          AND sc.normalized_name = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(p.receiver_name, '')), '\\s+', ' ', 'g'))
         WHERE UPPER(BTRIM(p.parcel_id)) = UPPER(BTRIM(?))
            OR UPPER(BTRIM(COALESCE(p.transaction_number, ''))) = UPPER(BTRIM(?))
         LIMIT 1`,
        [key, key]
      );
    } catch {
      [rows] = await pool.query(
        `SELECT p.*, u.name AS seller_name, u.email AS seller_email
         FROM parcels p
         JOIN users u ON p.seller_id = u.user_id
         WHERE UPPER(BTRIM(p.parcel_id)) = UPPER(BTRIM(?))
            OR UPPER(BTRIM(COALESCE(p.transaction_number, ''))) = UPPER(BTRIM(?))
         LIMIT 1`,
        [key, key]
      );
    }

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    const parcel = rows[0];

    if (req.user.role === "seller" && Number(parcel.seller_id) !== Number(req.user.user_id)) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    if (req.user.role === "rider") {
      const isVerified =
        parcel.status === "VERIFIED" || parcel.verification_status === "VERIFIED";
      const todayStr = new Date().toISOString().slice(0, 10);

      // When a rider scans/looks up a verified parcel, persist the rider assignment in PostgreSQL immediately
      if (isVerified && req.query?.hydrate !== "1") {
        const needsAssignment =
          !parcel.rider_id ||
          Number(parcel.rider_id) !== Number(req.user.user_id) ||
          !parcel.delivery_status;
        if (needsAssignment) {
          try {
            await pool.query(
              `UPDATE parcels
               SET rider_id = ?,
                   delivery_status = CASE
                     WHEN delivery_status IS NULL OR rider_id IS DISTINCT FROM ? THEN 'TO_DELIVER'
                     ELSE delivery_status
                   END,
                   scheduled_for = COALESCE(NULLIF(BTRIM(scheduled_for), ''), ?),
                   scanned_at = COALESCE(scanned_at, NOW()),
                   updated_at = NOW()
               WHERE parcel_id = ?`,
              [req.user.user_id, req.user.user_id, todayStr, parcel.parcel_id]
            );
            parcel.rider_id = req.user.user_id;
            parcel.delivery_status = parcel.delivery_status || "TO_DELIVER";
            parcel.scheduled_for = parcel.scheduled_for || todayStr;
            parcel.scanned_at = parcel.scanned_at || new Date().toISOString();
          } catch {
            try {
              await pool.query(
                `UPDATE parcels
                 SET rider_id = ?,
                     delivery_status = 'TO_DELIVER',
                     scanned_at = COALESCE(scanned_at, NOW())
                 WHERE parcel_id = ?`,
                [req.user.user_id, parcel.parcel_id]
              );
              parcel.rider_id = req.user.user_id;
              parcel.delivery_status = "TO_DELIVER";
            } catch {
              /* ignore if DB is read-only */
            }
          }
        }
      }

      const approvedDiscreet =
        Boolean(parcel.discrete_item) && parcel.discreet_status === "APPROVED";
      const fullAddress =
        parcel.receiver_address ||
        [
          parcel.receiver_house_number,
          parcel.receiver_street,
          parcel.receiver_barangay,
          parcel.receiver_city,
          parcel.receiver_province
        ]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(", ");
      return res.json({
        success: true,
        parcel: {
          parcel_id: parcel.parcel_id,
          transaction_number: parcel.transaction_number || "",
          status: parcel.status,
          seller: parcel.seller_name,
          seller_name: parcel.seller_name,
          receiver: parcel.receiver_name,
          receiver_name: parcel.receiver_name,
          receiver_contact: parcel.receiver_contact || "",
          contact: parcel.receiver_contact || "",
          address: fullAddress,
          receiver_address: fullAddress,
          receiver_house_number: parcel.receiver_house_number || "",
          receiver_street: parcel.receiver_street || "",
          receiver_barangay: parcel.receiver_barangay || "",
          receiver_city: parcel.receiver_city || "",
          receiver_province: parcel.receiver_province || "",
          contents: approvedDiscreet ? "Discreet Parcel (Verified)" : parcel.contents || "",
          content_category: approvedDiscreet ? "Discreet" : parcel.content_category || "",
          discrete_item: approvedDiscreet,
          discreet_status: parcel.discreet_status || "NOT_REQUESTED",
          verification_status: parcel.verification_status,
          rider_id: parcel.rider_id || null,
          delivery_status: parcel.delivery_status || null,
          scheduled_for: parcel.scheduled_for || null,
          rescheduled: Boolean(parcel.rescheduled),
          reschedule_count: Number(parcel.reschedule_count || 0),
          return_to_hub: Boolean(parcel.return_to_hub),
          scanned_at: parcel.scanned_at || null,
          delivered_at: parcel.delivered_at || null,
          updated_at: parcel.updated_at
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
    await ensureCustomerSchema();
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email,
              u.seller_code, u.shop_name,
              dr.name AS discreet_reviewer_name
       FROM parcels p
       JOIN users u ON p.seller_id = u.user_id
       LEFT JOIN users dr ON p.discreet_reviewed_by = dr.user_id
       WHERE p.parcel_id = ? AND p.seller_id = ?`,
      [req.params.parcelId, req.user.user_id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Parcel not found." });

    const [videos] = await pool.query(
      `SELECT video_id, file_name, file_size, mime_type, uploaded_at
       FROM video_proofs WHERE parcel_id = ? ORDER BY uploaded_at DESC`,
      [req.params.parcelId]
    );

    const [verification_records] = await pool.query(
      `SELECT decision, remarks, verified_at
       FROM verification_records WHERE parcel_id = ? ORDER BY verified_at DESC`,
      [req.params.parcelId]
    );

    const [declaration_history] = await pool.query(
      `SELECT log_id, actor_name, actor_role, category, action, detail, created_at
       FROM audit_logs
       WHERE target = ? AND category IN ('Declaration', 'Discreet Verification')
       ORDER BY created_at DESC`,
      [req.params.parcelId]
    );

    res.json({
      success: true,
      parcel: rows[0],
      videos,
      verification_records,
      declaration_history
    });
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
    videoRecordSaved = true;

    await pool.query(
      `UPDATE parcels
       SET status = 'VIDEO_SUBMITTED',
           verification_status = 'PENDING',
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [parcel.parcel_id]
    );

    try {
      await logAudit(req.user, {
        category: "Video",
        action: "Uploaded video proof",
        target: parcel.parcel_id,
        detail: req.file.originalname,
        sellerId: parcel.seller_id
      });
    } catch (auditError) {
      console.error("Video audit log failed:", auditError);
    }

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
    if (uploadedAsset?.public_id && !videoRecordSaved) {
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
    await ensureCustomerSchema();
    const [parcelRows] = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email,
              u.seller_code, u.shop_name,
              dr.name AS discreet_reviewer_name
       FROM parcels p
       JOIN users u ON p.seller_id = u.user_id
       LEFT JOIN users dr ON p.discreet_reviewed_by = dr.user_id
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

    const [declaration_history] = await pool.query(
      `SELECT log_id, actor_name, actor_role, category, action, detail, created_at
       FROM audit_logs
       WHERE target = ? AND category IN ('Declaration', 'Discreet Verification')
       ORDER BY created_at DESC`,
      [req.params.parcelId]
    );

    res.json({
      success: true,
      parcel: parcelRows[0],
      videos,
      verification_records: records,
      declaration_history
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to retrieve coordinator parcel." });
  }
}

// POST /api/parcels/coordinator/:parcelId/discreet
// Allows Coordinator to explicitly approve or reject a seller's discreet handling request
async function reviewDiscreetRequest(req, res) {
  try {
    await ensureCustomerSchema();
    const { parcelId } = req.params;
    const rawDecision = String(req.body?.decision || "").trim().toUpperCase();
    const remarks = String(req.body?.remarks || "").trim() || null;

    if (!["APPROVE", "APPROVED", "REJECT", "REJECTED"].includes(rawDecision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be APPROVE or REJECT."
      });
    }

    const nextDiscreetStatus = rawDecision.startsWith("APPROV") ? "APPROVED" : "REJECTED";

    const [rows] = await pool.query(
      `SELECT parcel_id, seller_id, discrete_item, discreet_status, content_category, discreet_reason
       FROM parcels
       WHERE parcel_id = ?`,
      [parcelId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    const parcel = rows[0];

    await pool.query(
      `UPDATE parcels
       SET discreet_status = ?,
           discreet_review_remarks = ?,
           discreet_reviewed_at = NOW(),
           discreet_reviewed_by = ?,
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [nextDiscreetStatus, remarks, req.user.user_id, parcelId]
    );

    await logAudit(req.user, {
      category: "Discreet Verification",
      action:
        nextDiscreetStatus === "APPROVED"
          ? "Approved discreet handling request"
          : "Rejected discreet handling request",
      target: parcelId,
      detail:
        remarks ||
        `Category: ${parcel.content_category || "Unspecified"} | Status set to ${nextDiscreetStatus}`,
      sellerId: parcel.seller_id
    });

    res.json({
      success: true,
      message:
        nextDiscreetStatus === "APPROVED"
          ? "Discreet handling request approved."
          : "Discreet handling request rejected.",
      parcel_id: parcelId,
      discreet_status: nextDiscreetStatus,
      discreet_review_remarks: remarks,
      discreet_reviewed_by_name: req.user.name
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update discreet handling status."
    });
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
  await ensureCustomerSchema();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [parcels] = await connection.query(
      `SELECT parcel_id, seller_id, discrete_item, discreet_status, content_category
       FROM parcels WHERE parcel_id = ? FOR UPDATE`,
      [req.params.parcelId]
    );

    if (!parcels.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }

    const currentParcel = parcels[0];

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
    const explicitDiscreetDecision = String(req.body.discreet_decision || "").trim().toUpperCase();

    let nextDiscreetStatus = currentParcel.discreet_status || "NOT_REQUESTED";
    let discreetUpdated = false;

    if (currentParcel.discrete_item) {
      if (["APPROVE", "APPROVED"].includes(explicitDiscreetDecision)) {
        nextDiscreetStatus = "APPROVED";
        discreetUpdated = true;
      } else if (["REJECT", "REJECTED"].includes(explicitDiscreetDecision)) {
        nextDiscreetStatus = "REJECTED";
        discreetUpdated = true;
      } else if (decision === "REJECT" && nextDiscreetStatus === "PENDING_REVIEW") {
        nextDiscreetStatus = "REJECTED";
        discreetUpdated = true;
      }
    }

    await connection.query(
      `INSERT INTO verification_records (parcel_id, coordinator_id, decision, remarks)
       VALUES (?, ?, ?, ?)`,
      [req.params.parcelId, req.user.user_id, decision, remarks]
    );

    if (discreetUpdated) {
      await connection.query(
        `UPDATE parcels
         SET status = ?,
             verification_status = ?,
             discreet_status = ?,
             discreet_review_remarks = COALESCE(?, discreet_review_remarks),
             discreet_reviewed_at = NOW(),
             discreet_reviewed_by = ?,
             updated_at = NOW()
         WHERE parcel_id = ?`,
        [
          parcelStatus,
          verificationStatus,
          nextDiscreetStatus,
          remarks,
          req.user.user_id,
          req.params.parcelId
        ]
      );
    } else {
      await connection.query(
        `UPDATE parcels SET status = ?, verification_status = ?, updated_at = NOW()
         WHERE parcel_id = ?`,
        [parcelStatus, verificationStatus, req.params.parcelId]
      );
    }

    await connection.commit();

    const decisionLabel = {
      VERIFY: "Verified parcel",
      REJECT: "Rejected parcel",
      REQUEST_REUPLOAD: "Requested reupload"
    };
    await logAudit(req.user, {
      category: "Verification",
      action: decisionLabel[decision],
      target: req.params.parcelId,
      detail: remarks,
      sellerId: currentParcel.seller_id
    });

    if (discreetUpdated) {
      await logAudit(req.user, {
        category: "Discreet Verification",
        action:
          nextDiscreetStatus === "APPROVED"
            ? "Approved discreet handling request"
            : "Rejected discreet handling request",
        target: req.params.parcelId,
        detail: remarks || `Discreet request ${nextDiscreetStatus.toLowerCase()} during parcel review`,
        sellerId: currentParcel.seller_id
      });
    }

    res.json({
      success: true,
      message: `Parcel ${decision.toLowerCase().replace("_", " ")} successfully.`,
      parcel_id: req.params.parcelId,
      decision,
      verification_status: verificationStatus,
      discreet_status: nextDiscreetStatus
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
      `SELECT vp.file_path, vp.file_name, vp.mime_type, p.seller_id
       FROM video_proofs vp
       JOIN parcels p ON vp.parcel_id = p.parcel_id
       WHERE vp.video_id = ?`,
      [req.params.videoId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const video = rows[0];

    if (req.user.role === "seller" && Number(video.seller_id) !== Number(req.user.user_id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this video proof."
      });
    }

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

const MANILA_TZ = "Asia/Manila";

function getManilaDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function addCalendarDays(isoDateStr, days) {
  const [y, m, d] = String(isoDateStr).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function diffCalendarDays(dateStrA, dateStrB) {
  const [y1, m1, d1] = String(dateStrA).slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = String(dateStrB).slice(0, 10).split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

// Automatic Reschedule Evaluator & Status Transition (3-Day Rescheduling Rule)
// Day 0: Initial scheduled date
// Day 1: Rescheduled – Day 1 of 3 (TO_DELIVER)
// Day 2: Rescheduled – Day 2 of 3 (TO_DELIVER)
// Day 3: Rescheduled – Day 3 of 3 (TO_DELIVER)
// Day > 3 (after Day 3 opportunity has passed): Eligible for Return to Hub (FAILED, return_to_hub = TRUE)
async function evaluateAutomaticReschedules(parcels = []) {
  if (!Array.isArray(parcels) || parcels.length === 0) return parcels;
  const todayStr = getManilaDateStr();

  for (const p of parcels) {
    const deliveryStatus = String(p.delivery_status || "").toUpperCase();
    if (deliveryStatus === "DELIVERED") continue;
    if (!p.rider_id && !p.delivery_status && !p.scheduled_for) continue;

    let attempts = [];
    if (Array.isArray(p.attempts)) {
      attempts = [...p.attempts];
    } else if (p.delivery_attempts) {
      try {
        const parsed = JSON.parse(p.delivery_attempts);
        if (Array.isArray(parsed)) attempts = parsed;
      } catch {
        attempts = [];
      }
    }

    const firstAtt = attempts.find((a) => a && a.scheduledDate);
    const initialDate =
      (firstAtt && firstAtt.scheduledDate) ||
      (p.scanned_at ? getManilaDateStr(p.scanned_at) : null) ||
      (p.scheduled_for ? String(p.scheduled_for).slice(0, 10) : null) ||
      (p.created_at ? getManilaDateStr(p.created_at) : null) ||
      todayStr;

    const elapsedDays = diffCalendarDays(initialDate, todayStr);

    let nextScheduledFor = p.scheduled_for || initialDate;
    let nextRescheduled = false;
    let nextRescheduleCount = 0;
    let nextReturnToHub = false;
    let nextDeliveryStatus = "TO_DELIVER";
    let nextReturnToHubAt = p.return_to_hub_at || null;
    let nextAttempts = [];

    if (elapsedDays <= 0) {
      nextScheduledFor = initialDate;
      nextRescheduled = false;
      nextRescheduleCount = 0;
      nextReturnToHub = false;
      nextDeliveryStatus = "TO_DELIVER";
      nextAttempts = attempts.filter((a) => a && a.outcome !== "return_to_hub" && a.outcome !== "rescheduled");
    } else if (elapsedDays === 1) {
      nextScheduledFor = addCalendarDays(initialDate, 1);
      nextRescheduled = true;
      nextRescheduleCount = 1;
      nextReturnToHub = false;
      nextDeliveryStatus = "TO_DELIVER";
      nextAttempts = [
        {
          id: `att-${p.parcel_id}-day-1`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: nextScheduledFor,
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${nextScheduledFor} (Day 1 of 3).`,
          auto: true,
          outcome: "rescheduled"
        }
      ];
    } else if (elapsedDays === 2) {
      nextScheduledFor = addCalendarDays(initialDate, 2);
      nextRescheduled = true;
      nextRescheduleCount = 2;
      nextReturnToHub = false;
      nextDeliveryStatus = "TO_DELIVER";
      nextAttempts = [
        {
          id: `att-${p.parcel_id}-day-1`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: addCalendarDays(initialDate, 1),
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 1)} (Day 1 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-2`,
          attempt: 2,
          scheduledDate: addCalendarDays(initialDate, 1),
          rescheduledTo: nextScheduledFor,
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${addCalendarDays(initialDate, 1)}) passed without delivery. Automatically rescheduled to ${nextScheduledFor} (Day 2 of 3).`,
          auto: true,
          outcome: "rescheduled"
        }
      ];
    } else if (elapsedDays === 3) {
      nextScheduledFor = addCalendarDays(initialDate, 3);
      nextRescheduled = true;
      nextRescheduleCount = 3;
      nextReturnToHub = false;
      nextDeliveryStatus = "TO_DELIVER";
      nextAttempts = [
        {
          id: `att-${p.parcel_id}-day-1`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: addCalendarDays(initialDate, 1),
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 1)} (Day 1 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-2`,
          attempt: 2,
          scheduledDate: addCalendarDays(initialDate, 1),
          rescheduledTo: addCalendarDays(initialDate, 2),
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${addCalendarDays(initialDate, 1)}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 2)} (Day 2 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-3`,
          attempt: 3,
          scheduledDate: addCalendarDays(initialDate, 2),
          rescheduledTo: nextScheduledFor,
          rescheduleDay: 3,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${addCalendarDays(initialDate, 2)}) passed without delivery. Automatically rescheduled to ${nextScheduledFor} (Day 3 of 3).`,
          auto: true,
          outcome: "rescheduled"
        }
      ];
    } else {
      nextScheduledFor = addCalendarDays(initialDate, 3);
      nextRescheduled = true;
      nextRescheduleCount = 3;
      nextReturnToHub = true;
      nextDeliveryStatus = "FAILED";
      nextReturnToHubAt = nextReturnToHubAt || new Date().toISOString();
      nextAttempts = [
        {
          id: `att-${p.parcel_id}-day-1`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: addCalendarDays(initialDate, 1),
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 1)} (Day 1 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-2`,
          attempt: 2,
          scheduledDate: addCalendarDays(initialDate, 1),
          rescheduledTo: addCalendarDays(initialDate, 2),
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${addCalendarDays(initialDate, 1)}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 2)} (Day 2 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-3`,
          attempt: 3,
          scheduledDate: addCalendarDays(initialDate, 2),
          rescheduledTo: addCalendarDays(initialDate, 3),
          rescheduleDay: 3,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${addCalendarDays(initialDate, 2)}) passed without delivery. Automatically rescheduled to ${addCalendarDays(initialDate, 3)} (Day 3 of 3).`,
          auto: true,
          outcome: "rescheduled"
        },
        {
          id: `att-${p.parcel_id}-day-rth`,
          attempt: 4,
          scheduledDate: addCalendarDays(initialDate, 3),
          rescheduledTo: null,
          rescheduleDay: 3,
          reason: "Undelivered after 3-day rescheduling period",
          note: "Parcel remained undelivered after the 3-day rescheduling period. Automatically marked as Return to Hub.",
          auto: true,
          outcome: "return_to_hub"
        }
      ];
    }

    const changed =
      p.scheduled_for !== nextScheduledFor ||
      Boolean(p.rescheduled) !== nextRescheduled ||
      Number(p.reschedule_count || 0) !== nextRescheduleCount ||
      Boolean(p.return_to_hub) !== nextReturnToHub ||
      p.delivery_status !== nextDeliveryStatus ||
      JSON.stringify(attempts) !== JSON.stringify(nextAttempts);

    if (changed) {
      p.scheduled_for = nextScheduledFor;
      p.rescheduled = nextRescheduled;
      p.reschedule_count = nextRescheduleCount;
      p.return_to_hub = nextReturnToHub;
      p.return_to_hub_at = nextReturnToHubAt;
      p.delivery_status = nextDeliveryStatus;
      p.attempts = nextAttempts;
      p.delivery_attempts = JSON.stringify(nextAttempts);

      try {
        await pool.query(
          `UPDATE parcels
           SET scheduled_for = ?,
               rescheduled = ?,
               reschedule_count = ?,
               return_to_hub = ?,
               return_to_hub_at = ?,
               delivery_status = ?,
               delivery_attempts = ?,
               updated_at = NOW()
           WHERE parcel_id = ?`,
          [
            nextScheduledFor,
            nextRescheduled,
            nextRescheduleCount,
            nextReturnToHub,
            nextReturnToHubAt,
            nextDeliveryStatus,
            JSON.stringify(nextAttempts),
            p.parcel_id
          ]
        );
      } catch (err) {
        console.warn("Failed to persist automatic reschedule for parcel:", p.parcel_id, err.message);
      }
    } else {
      p.attempts = nextAttempts;
    }
  }
  return parcels;
}

// GET /api/parcels  -> seller: sariling parcels lang | coordinator: lahat
async function listParcels(req, res) {
  try {
    await ensureCustomerSchema();
    const isCoordinator = req.user.role === "coordinator";
    const params = [];
    let where = "";

    if (!isCoordinator) {
      where = "WHERE p.seller_id = ?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(
      `SELECT p.parcel_id, p.transaction_number, p.seller_id,
              p.receiver_name,
              COALESCE(NULLIF(BTRIM(p.receiver_contact), ''), sc.receiver_contact, '') AS receiver_contact,
              COALESCE(NULLIF(BTRIM(p.receiver_address), ''), sc.receiver_address, '') AS receiver_address,
              COALESCE(NULLIF(BTRIM(p.receiver_house_number), ''), sc.receiver_house_number, '') AS receiver_house_number,
              COALESCE(NULLIF(BTRIM(p.receiver_street), ''), sc.receiver_street, '') AS receiver_street,
              COALESCE(NULLIF(BTRIM(p.receiver_barangay), ''), sc.receiver_barangay, '') AS receiver_barangay,
              COALESCE(NULLIF(BTRIM(p.receiver_city), ''), sc.receiver_city, '') AS receiver_city,
              COALESCE(NULLIF(BTRIM(p.receiver_province), ''), sc.receiver_province, '') AS receiver_province,
              p.contents, p.content_category, p.other_category_description,
              p.discrete_item, p.discreet_reason, p.discreet_status,
              p.discreet_review_remarks, p.discreet_reviewed_at,
              p.declaration_flagged, p.declaration_flag_reason,
              p.status, p.verification_status,
              p.created_at, p.updated_at,
              p.rider_id, p.delivery_status, p.delivery_note, p.delivery_proof,
              p.scheduled_for, p.rescheduled, p.reschedule_count,
              p.return_to_hub, p.return_to_hub_at, p.return_coordinated, p.return_note,
              p.last_failure, p.delivery_attempts, p.scanned_at, p.delivered_at,
              p.is_cod, p.payment_method,
              p.rts_status, p.hub_verified_at, p.hub_verified_by,
              p.rts_dispatched_at, p.rts_dispatched_by,
              p.returned_to_seller_at, p.returned_received_by,
              p.delivery_hold, p.delivery_hold_reason, p.delivery_hold_until, p.delivery_hold_at,
              u.name AS seller_name, u.email AS seller_email, u.seller_code, u.shop_name,
              r.name AS rider_name,
              dr.name AS discreet_reviewer_name
       FROM parcels p
       JOIN users u ON p.seller_id = u.user_id
       LEFT JOIN users r ON p.rider_id = r.user_id
       LEFT JOIN users dr ON p.discreet_reviewed_by = dr.user_id
       LEFT JOIN seller_customers sc
         ON sc.seller_id = p.seller_id
        AND sc.normalized_name = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(p.receiver_name, '')), '\\s+', ' ', 'g'))
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    await evaluateAutomaticReschedules(rows);
    res.json({ success: true, parcels: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to list parcels." });
  }
}

// GET /api/parcels/by-transaction/:transactionNumber
async function getParcelByTransaction(req, res) {
  try {
    const transactionNumber = String(req.params.transactionNumber || "").trim();
    if (!transactionNumber) {
      return res.status(400).json({ success: false, message: "Transaction number is required." });
    }

    const [rows] = await pool.query(
      `SELECT parcel_id, seller_id
       FROM parcels
       WHERE UPPER(BTRIM(COALESCE(transaction_number, ''))) = UPPER(BTRIM(?))
          OR UPPER(BTRIM(parcel_id)) = UPPER(BTRIM(?))
       LIMIT 1`,
      [transactionNumber, transactionNumber]
    );

    if (!rows.length || (req.user.role === "seller" && Number(rows[0].seller_id) !== Number(req.user.user_id))) {
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

async function loadRiderParcel(req, res) {
  await ensureCustomerSchema();
  const key = String(req.params.parcelId || "").trim();
  let rows = [];
  try {
    [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, status, verification_status, rider_id,
              delivery_status, scheduled_for, rescheduled, reschedule_count,
              return_to_hub, delivery_attempts
       FROM parcels
       WHERE UPPER(BTRIM(parcel_id)) = UPPER(BTRIM(?))
          OR UPPER(BTRIM(COALESCE(transaction_number, ''))) = UPPER(BTRIM(?))
       LIMIT 1`,
      [key, key]
    );
  } catch {
    [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, status, verification_status, rider_id, delivery_status
       FROM parcels
       WHERE UPPER(BTRIM(parcel_id)) = UPPER(BTRIM(?))
          OR UPPER(BTRIM(COALESCE(transaction_number, ''))) = UPPER(BTRIM(?))
       LIMIT 1`,
      [key, key]
    );
  }
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

    const isVerified =
      parcel.status === "VERIFIED" || parcel.verification_status === "VERIFIED";
    if (!isVerified) {
      return res.status(409).json({ success: false, message: "This parcel is not verified yet, so it cannot be delivered." });
    }

    const retry = parcel.delivery_status === "FAILED";
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextScheduledFor = String(req.body?.scheduledFor || parcel.scheduled_for || todayStr).slice(0, 20);
    const nextRescheduled = req.body?.rescheduled !== undefined ? Boolean(req.body.rescheduled) : Boolean(parcel.rescheduled);
    const nextRescheduleCount =
      req.body?.rescheduleCount !== undefined ? Number(req.body.rescheduleCount || 0) : Number(parcel.reschedule_count || 0);

    try {
      await pool.query(
        `UPDATE parcels
         SET rider_id = ?,
             delivery_status = 'TO_DELIVER',
             scheduled_for = ?,
             rescheduled = ?,
             reschedule_count = ?,
             return_to_hub = FALSE,
             delivered_at = NULL,
             scanned_at = COALESCE(scanned_at, NOW()),
             updated_at = NOW()
         WHERE parcel_id = ?`,
        [req.user.user_id, nextScheduledFor, nextRescheduled, nextRescheduleCount, parcel.parcel_id]
      );
    } catch {
      await pool.query(
        `UPDATE parcels
         SET rider_id = ?,
             delivery_status = 'TO_DELIVER',
             delivery_note = NULL,
             scanned_at = COALESCE(scanned_at, NOW()),
             delivered_at = NULL,
             updated_at = NOW()
         WHERE parcel_id = ?`,
        [req.user.user_id, parcel.parcel_id]
      );
    }

    await logAudit(req.user, {
      category: "Delivery",
      action: retry ? "Retrying delivery" : "Scanned parcel for delivery",
      target: parcel.parcel_id,
      sellerId: parcel.seller_id,
      riderId: req.user.user_id
    });

    res.json({
      success: true,
      parcel_id: parcel.parcel_id,
      transaction_number: parcel.transaction_number,
      delivery_status: "TO_DELIVER",
      scheduled_for: nextScheduledFor
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to record the scan." });
  }
}

async function finishDelivery(req, res, outcome) {
  try {
    const parcel = await loadRiderParcel(req, res);
    if (!parcel) return;

    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    const note = String(req.body?.note || req.body?.reason || "").trim().slice(0, 500);
    const proof = req.body?.proof ? String(req.body.proof) : null;
    const isReturnToHub = Boolean(req.body?.returnToHub || req.body?.outcome === "return_to_hub");
    const isRescheduled = Boolean(req.body?.rescheduled || req.body?.outcome === "rescheduled");
    const rescheduleCount =
      req.body?.rescheduleCount !== undefined ? Number(req.body.rescheduleCount || 0) : Number(parcel.reschedule_count || 0);
    const scheduledFor = req.body?.scheduledFor
      ? String(req.body.scheduledFor).slice(0, 20)
      : parcel.scheduled_for || new Date().toISOString().slice(0, 10);
    const attemptsJson = Array.isArray(req.body?.attempts)
      ? JSON.stringify(req.body.attempts)
      : parcel.delivery_attempts || "[]";

    if (outcome === "FAILED" && !note && !reason) {
      return res.status(400).json({ success: false, message: "A reason is required for a failed delivery." });
    }

    // Keep delivery_status within PostgreSQL's CHECK ('TO_DELIVER', 'DELIVERED', 'FAILED')
    let finalDeliveryStatus = outcome;
    if (outcome === "FAILED") {
      if (isReturnToHub) finalDeliveryStatus = "FAILED";
      else if (isRescheduled) finalDeliveryStatus = "TO_DELIVER";
    }

    try {
      await pool.query(
        `UPDATE parcels
         SET rider_id = ?,
             delivery_status = ?,
             delivery_note = ?,
             delivery_proof = COALESCE(?, delivery_proof),
             scheduled_for = ?,
             rescheduled = ?,
             reschedule_count = ?,
             return_to_hub = ?,
             return_to_hub_at = ${isReturnToHub ? "COALESCE(return_to_hub_at, NOW())" : "return_to_hub_at"},
             last_failure = ?,
             delivery_attempts = ?,
             scanned_at = COALESCE(scanned_at, NOW()),
             delivered_at = ${outcome === "DELIVERED" ? "NOW()" : "NULL"},
             updated_at = NOW()
         WHERE parcel_id = ?`,
        [
          req.user.user_id,
          finalDeliveryStatus,
          note || reason || null,
          proof,
          scheduledFor,
          outcome === "DELIVERED" ? Boolean(parcel.rescheduled) : isRescheduled || isReturnToHub,
          rescheduleCount,
          outcome === "DELIVERED" ? false : isReturnToHub,
          outcome === "DELIVERED" ? "" : reason || note || "",
          attemptsJson,
          parcel.parcel_id
        ]
      );
    } catch {
      await pool.query(
        `UPDATE parcels
         SET rider_id = ?,
             delivery_status = ?,
             delivery_note = ?,
             scanned_at = COALESCE(scanned_at, NOW()),
             delivered_at = ${outcome === "DELIVERED" ? "NOW()" : "NULL"},
             updated_at = NOW()
         WHERE parcel_id = ?`,
        [req.user.user_id, finalDeliveryStatus, note || reason || null, parcel.parcel_id]
      );
    }

    await logAudit(req.user, {
      category: "Delivery",
      action:
        outcome === "DELIVERED"
          ? "Delivered parcel"
          : isReturnToHub
          ? "Marked parcel Return to Hub"
          : isRescheduled
          ? "Rescheduled delivery attempt"
          : "Failed delivery",
      target: parcel.parcel_id,
      detail: note || reason || null,
      sellerId: parcel.seller_id,
      riderId: req.user.user_id
    });

    res.json({
      success: true,
      parcel_id: parcel.parcel_id,
      delivery_status: isReturnToHub ? "RETURN_TO_HUB" : finalDeliveryStatus,
      scheduled_for: scheduledFor,
      rescheduled: isRescheduled,
      reschedule_count: rescheduleCount,
      return_to_hub: isReturnToHub
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update the delivery." });
  }
}

const riderDelivered = (req, res) => finishDelivery(req, res, "DELIVERED");
const riderFailed = (req, res) => finishDelivery(req, res, "FAILED");

// GET /api/parcels/rider/mine -> mga parcel na na-scan ng rider na ito mula sa shared PostgreSQL database
async function listRiderParcels(req, res) {
  try {
    await ensureCustomerSchema();

    // Self-heal any parcels scanned by this rider in audit_logs that may have missed rider_id assignment
    try {
      await pool.query(
        `UPDATE parcels p
         SET rider_id = ?,
             delivery_status = COALESCE(p.delivery_status, 'TO_DELIVER'),
             scanned_at = COALESCE(p.scanned_at, NOW())
         WHERE p.rider_id IS NULL
           AND EXISTS (
             SELECT 1 FROM audit_logs a
             WHERE a.category = 'Delivery'
               AND (a.actor_id = ? OR a.rider_id = ?)
               AND (a.target = p.parcel_id OR a.target = p.transaction_number)
           )`,
        [req.user.user_id, req.user.user_id, req.user.user_id]
      );
    } catch {
      /* ignore if audit_logs query fails */
    }

    let rows = [];
    try {
      [rows] = await pool.query(
        `SELECT p.parcel_id, p.transaction_number, p.receiver_name,
                COALESCE(NULLIF(BTRIM(p.receiver_contact), ''), sc.receiver_contact, '') AS receiver_contact,
                COALESCE(NULLIF(BTRIM(p.receiver_address), ''), sc.receiver_address, '') AS receiver_address,
                COALESCE(NULLIF(BTRIM(p.receiver_house_number), ''), sc.receiver_house_number, '') AS receiver_house_number,
                COALESCE(NULLIF(BTRIM(p.receiver_street), ''), sc.receiver_street, '') AS receiver_street,
                COALESCE(NULLIF(BTRIM(p.receiver_barangay), ''), sc.receiver_barangay, '') AS receiver_barangay,
                COALESCE(NULLIF(BTRIM(p.receiver_city), ''), sc.receiver_city, '') AS receiver_city,
                COALESCE(NULLIF(BTRIM(p.receiver_province), ''), sc.receiver_province, '') AS receiver_province,
                p.contents, p.content_category, p.discrete_item, p.discreet_status, p.status, p.verification_status,
                p.delivery_status, p.delivery_note, p.delivery_proof,
                p.scheduled_for, p.rescheduled, p.reschedule_count,
                p.return_to_hub, p.return_to_hub_at, p.return_coordinated, p.return_note,
                p.last_failure, p.delivery_attempts,
                p.scanned_at, p.delivered_at, p.updated_at,
                p.is_cod, p.payment_method, p.rts_status, p.delivery_hold, p.delivery_hold_reason,
                u.name AS seller_name
         FROM parcels p
         LEFT JOIN users u ON p.seller_id = u.user_id
         LEFT JOIN seller_customers sc
           ON sc.seller_id = p.seller_id
          AND sc.normalized_name = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(p.receiver_name, '')), '\\s+', ' ', 'g'))
         WHERE p.rider_id = ?
         ORDER BY COALESCE(p.scanned_at, p.updated_at) DESC`,
        [req.user.user_id]
      );
    } catch {
      [rows] = await pool.query(
        `SELECT p.parcel_id, p.transaction_number, p.receiver_name, p.receiver_contact,
                p.receiver_address, p.contents, p.discrete_item, p.status, p.verification_status,
                p.delivery_status, p.delivery_note, p.scanned_at, p.delivered_at, p.updated_at,
                u.name AS seller_name
         FROM parcels p
         LEFT JOIN users u ON p.seller_id = u.user_id
         WHERE p.rider_id = ?
         ORDER BY COALESCE(p.scanned_at, p.updated_at) DESC`,
        [req.user.user_id]
      );
    }

    const maskedRows = rows.map((row) => {
      const approvedDiscreet =
        Boolean(row.discrete_item) && (row.discreet_status === "APPROVED" || !row.discreet_status);
      const fullAddress =
        row.receiver_address ||
        [
          row.receiver_house_number,
          row.receiver_street,
          row.receiver_barangay,
          row.receiver_city,
          row.receiver_province
        ]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(", ");
      let parsedAttempts = [];
      if (row.delivery_attempts) {
        try {
          const parsed = JSON.parse(row.delivery_attempts);
          if (Array.isArray(parsed)) parsedAttempts = parsed;
        } catch {
          parsedAttempts = [];
        }
      }
      return {
        ...row,
        seller: row.seller_name || "",
        receiver: row.receiver_name || "",
        contact: row.receiver_contact || "",
        address: fullAddress,
        receiver_address: fullAddress,
        discrete_item: approvedDiscreet,
        contents: approvedDiscreet ? "Discreet Parcel (Verified)" : row.contents,
        attempts: parsedAttempts
      };
    });
    await evaluateAutomaticReschedules(maskedRows);
    res.json({ success: true, parcels: maskedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to list your parcels." });
  }
}

// ---------------- RETURN TO SENDER (RTS) 4-STAGE WORKFLOW ----------------

// Stage 1 approval: Coordinator initiates or approves Return to Hub (e.g. from recipient refusal)
async function coordinatorInitiateReturnToHub(req, res) {
  try {
    await ensureCustomerSchema();
    const parcelId = String(req.params.parcelId || "").trim();
    const reason = String(req.body?.reason || "Recipient refused parcel. Coordinator initiated Return to Hub.").trim();
    const [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, rider_id, status, delivery_status
       FROM parcels
       WHERE parcel_id = ? OR transaction_number = ?
       LIMIT 1`,
      [parcelId, parcelId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }
    const p = rows[0];

    await pool.query(
      `UPDATE parcels
       SET return_to_hub = TRUE,
           return_to_hub_at = NOW(),
           delivery_status = 'FAILED',
           status = 'RETURN_TO_HUB',
           rts_status = 'RETURN_TO_HUB',
           last_failure = ?,
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [reason, p.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: "Initiated Return to Hub",
      target: p.parcel_id,
      detail: `Coordinator approved Return to Hub for parcel ${p.transaction_number || p.parcel_id}: ${reason}`,
      sellerId: p.seller_id,
      riderId: p.rider_id
    });

    res.json({
      success: true,
      message: "Parcel marked for Return to Hub (RTS Stage 1).",
      parcel_id: p.parcel_id,
      rts_status: "RETURN_TO_HUB",
      status: "RETURN_TO_HUB"
    });
  } catch (error) {
    console.error("coordinatorInitiateReturnToHub error:", error);
    res.status(500).json({ success: false, message: "Failed to initiate Return to Hub." });
  }
}

// Stage 2: Hub Verification (Coordinator verifies parcel arrival at Hub via scan or action)
async function coordinatorHubVerify(req, res) {
  try {
    await ensureCustomerSchema();
    const parcelId = String(req.params.parcelId || "").trim();
    const [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, return_to_hub, rts_status, delivery_status
       FROM parcels
       WHERE parcel_id = ? OR transaction_number = ?
       LIMIT 1`,
      [parcelId, parcelId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }
    const p = rows[0];

    await pool.query(
      `UPDATE parcels
       SET return_to_hub = TRUE,
           rts_status = 'HUB_VERIFIED',
           hub_verified_at = NOW(),
           hub_verified_by = ?,
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [req.user.user_id, p.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: "Hub verified returned parcel",
      target: p.parcel_id,
      detail: `Coordinator verified return-to-hub arrival for parcel ${p.transaction_number || p.parcel_id}`,
      sellerId: p.seller_id
    });

    res.json({
      success: true,
      message: "Parcel marked as Hub Verified.",
      parcel_id: p.parcel_id,
      rts_status: "HUB_VERIFIED"
    });
  } catch (error) {
    console.error("coordinatorHubVerify error:", error);
    res.status(500).json({ success: false, message: "Failed to verify hub arrival." });
  }
}

// Stage 3: RTS Dispatch (Coordinator dispatches verified returned parcel towards Seller)
async function coordinatorRtsDispatch(req, res) {
  try {
    await ensureCustomerSchema();
    const parcelId = String(req.params.parcelId || "").trim();
    const [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, rts_status
       FROM parcels
       WHERE parcel_id = ? OR transaction_number = ?
       LIMIT 1`,
      [parcelId, parcelId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found." });
    }
    const p = rows[0];

    await pool.query(
      `UPDATE parcels
       SET rts_status = 'RTS_IN_TRANSIT',
           delivery_status = 'RTS_IN_TRANSIT',
           rts_dispatched_at = NOW(),
           rts_dispatched_by = ?,
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [req.user.user_id, p.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: "Dispatched parcel for return to seller",
      target: p.parcel_id,
      detail: `RTS dispatched towards seller for parcel ${p.transaction_number || p.parcel_id}`,
      sellerId: p.seller_id
    });

    res.json({
      success: true,
      message: "Parcel dispatched towards Seller (RTS In Transit).",
      parcel_id: p.parcel_id,
      rts_status: "RTS_IN_TRANSIT"
    });
  } catch (error) {
    console.error("coordinatorRtsDispatch error:", error);
    res.status(500).json({ success: false, message: "Failed to dispatch RTS parcel." });
  }
}

// Stage 4: Returned to Seller (Seller or authorized receiver confirms receipt)
async function sellerConfirmReturned(req, res) {
  try {
    await ensureCustomerSchema();
    const parcelId = String(req.params.parcelId || "").trim();
    const isCoordinator = req.user.role === "coordinator";
    const [rows] = await pool.query(
      `SELECT parcel_id, transaction_number, seller_id, rts_status
       FROM parcels
       WHERE (parcel_id = ? OR transaction_number = ?)
         ${isCoordinator ? "" : "AND seller_id = ?"}
       LIMIT 1`,
      isCoordinator ? [parcelId, parcelId] : [parcelId, parcelId, req.user.user_id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Parcel not found or unauthorized." });
    }
    const p = rows[0];
    const receiverName = req.body?.received_by || req.user.name || "Seller";

    await pool.query(
      `UPDATE parcels
       SET rts_status = 'RETURNED_TO_SELLER',
           status = 'RETURNED',
           delivery_status = 'RETURNED_TO_SELLER',
           returned_to_seller_at = NOW(),
           returned_received_by = ?,
           updated_at = NOW()
       WHERE parcel_id = ?`,
      [receiverName, p.parcel_id]
    );

    await logAudit(req.user, {
      category: "Delivery",
      action: "Confirmed receipt of returned parcel",
      target: p.parcel_id,
      detail: `Seller (${receiverName}) confirmed receipt of RTS parcel ${p.transaction_number || p.parcel_id}`,
      sellerId: p.seller_id
    });

    res.json({
      success: true,
      message: "Returned parcel confirmed received by Seller.",
      parcel_id: p.parcel_id,
      rts_status: "RETURNED_TO_SELLER",
      status: "RETURNED"
    });
  } catch (error) {
    console.error("sellerConfirmReturned error:", error);
    res.status(500).json({ success: false, message: "Failed to confirm receipt of returned parcel." });
  }
}

// ---------------- RIDER INCIDENTS & DELIVERY HOLD ----------------

// Rider reports incident (Accident, Emergency, Breakdown, etc.)
async function reportRiderIncident(req, res) {
  try {
    await ensureCustomerSchema();
    const incidentType = String(req.body.incident_type || "").trim();
    const description = String(req.body.description || "").trim();
    if (!incidentType) {
      return res.status(400).json({ success: false, message: "Incident type is required." });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO rider_incidents
       (rider_id, incident_type, description, status, hold_active, created_at, updated_at)
       VALUES (?, ?, ?, 'REPORTED', TRUE, NOW(), NOW())
       RETURNING incident_id`,
      [req.user.user_id, incidentType, description]
    );
    const incidentId = insertResult[0]?.incident_id;

    // Put current undelivered parcels on delivery hold
    await pool.query(
      `UPDATE parcels
       SET delivery_hold = TRUE,
           delivery_hold_reason = ?,
           delivery_hold_at = NOW()
       WHERE rider_id = ?
         AND (delivery_status IS NULL OR delivery_status = 'TO_DELIVER')
         AND delivery_status <> 'DELIVERED'`,
      [incidentType, req.user.user_id]
    );

    await logAudit(req.user, {
      category: "Incident",
      action: "Reported rider incident",
      target: `Incident #${incidentId}`,
      detail: `${incidentType}: ${description}. Delivery hold active for assigned parcels.`,
      riderId: req.user.user_id
    });

    res.json({
      success: true,
      message: "Incident reported successfully. Affected parcels placed on delivery hold.",
      incident_id: incidentId
    });
  } catch (error) {
    console.error("reportRiderIncident error:", error);
    res.status(500).json({ success: false, message: "Failed to report incident." });
  }
}

// List incidents (Coordinator views all; Rider views own)
async function listRiderIncidents(req, res) {
  try {
    await ensureCustomerSchema();
    const isCoordinator = req.user.role === "coordinator";
    const where = isCoordinator ? "" : "WHERE ri.rider_id = ?";
    const params = isCoordinator ? [] : [req.user.user_id];

    const [rows] = await pool.query(
      `SELECT ri.incident_id, ri.rider_id, ri.incident_type, ri.description,
              ri.status, ri.hold_active, ri.hold_until,
              ri.coordinator_id, ri.coordinator_action, ri.coordinator_notes, ri.action_at,
              ri.created_at, ri.updated_at,
              u.name AS rider_name, u.phone AS rider_phone, u.zone AS rider_zone, u.vehicle AS rider_vehicle,
              (
                SELECT COUNT(*) FROM parcels p
                WHERE p.rider_id = ri.rider_id
                  AND (p.delivery_status IS NULL OR p.delivery_status = 'TO_DELIVER')
                  AND p.delivery_status <> 'DELIVERED'
              ) AS affected_parcels_count
       FROM rider_incidents ri
       JOIN users u ON ri.rider_id = u.user_id
       ${where}
       ORDER BY ri.created_at DESC`,
      params
    );

    res.json({ success: true, incidents: rows });
  } catch (error) {
    console.error("listRiderIncidents error:", error);
    res.status(500).json({ success: false, message: "Failed to list incidents." });
  }
}

// Coordinator confirms incident
async function confirmRiderIncident(req, res) {
  try {
    await ensureCustomerSchema();
    const incidentId = Number(req.params.incidentId);
    if (!incidentId) {
      return res.status(400).json({ success: false, message: "Valid incident ID is required." });
    }

    const [rows] = await pool.query(
      `SELECT incident_id, rider_id, incident_type, status
       FROM rider_incidents WHERE incident_id = ? LIMIT 1`,
      [incidentId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Incident not found." });
    }
    const incident = rows[0];

    await pool.query(
      `UPDATE rider_incidents
       SET status = 'CONFIRMED',
           coordinator_id = ?,
           updated_at = NOW()
       WHERE incident_id = ?`,
      [req.user.user_id, incidentId]
    );

    // Ensure delivery hold is set
    await pool.query(
      `UPDATE parcels
       SET delivery_hold = TRUE,
           delivery_hold_reason = ?,
           delivery_hold_at = COALESCE(delivery_hold_at, NOW())
       WHERE rider_id = ?
         AND (delivery_status IS NULL OR delivery_status = 'TO_DELIVER')
         AND delivery_status <> 'DELIVERED'`,
      [incident.incident_type, incident.rider_id]
    );

    await logAudit(req.user, {
      category: "Incident",
      action: "Confirmed rider incident",
      target: `Incident #${incidentId}`,
      detail: `Coordinator confirmed ${incident.incident_type} for rider ID ${incident.rider_id}. Delivery hold confirmed.`,
      riderId: incident.rider_id
    });

    res.json({ success: true, message: "Incident confirmed and delivery hold verified." });
  } catch (error) {
    console.error("confirmRiderIncident error:", error);
    res.status(500).json({ success: false, message: "Failed to confirm incident." });
  }
}

// Coordinator actions strictly: (1) Resume Delivery, (2) Reschedule Delivery, (3) Extend Hold.
// Strictly DO NOT implement Reassign Rider.
async function actionRiderIncident(req, res) {
  try {
    await ensureCustomerSchema();
    const incidentId = Number(req.params.incidentId);
    const { action, notes = "", new_date = "", extend_hours = 24 } = req.body;
    if (!incidentId || !action) {
      return res.status(400).json({ success: false, message: "Incident ID and action are required." });
    }

    const allowedActions = ["resume", "reschedule", "extend_hold"];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Permitted actions: resume, reschedule, extend_hold."
      });
    }

    const [rows] = await pool.query(
      `SELECT incident_id, rider_id, incident_type, status FROM rider_incidents WHERE incident_id = ? LIMIT 1`,
      [incidentId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Incident not found." });
    }
    const incident = rows[0];
    const todayStr = getManilaDateStr();

    if (action === "resume") {
      // Lift hold and resume delivery
      await pool.query(
        `UPDATE parcels
         SET delivery_hold = FALSE,
             delivery_hold_reason = NULL,
             delivery_hold_until = NULL,
             scheduled_for = CASE WHEN scheduled_for < ? THEN ? ELSE scheduled_for END,
             updated_at = NOW()
         WHERE rider_id = ?
           AND (delivery_status IS NULL OR delivery_status = 'TO_DELIVER')
           AND delivery_status <> 'DELIVERED'`,
        [todayStr, todayStr, incident.rider_id]
      );

      await pool.query(
        `UPDATE rider_incidents
         SET status = 'RESOLVED',
             hold_active = FALSE,
             coordinator_id = ?,
             coordinator_action = 'RESUMED',
             coordinator_notes = ?,
             action_at = NOW(),
             updated_at = NOW()
         WHERE incident_id = ?`,
        [req.user.user_id, notes || "Delivery resumed by Coordinator", incidentId]
      );

      await logAudit(req.user, {
        category: "Incident",
        action: "Resumed deliveries after incident",
        target: `Incident #${incidentId}`,
        detail: `Hold lifted for rider ${incident.rider_id}. Undelivered parcels resumed.`,
        riderId: incident.rider_id
      });

      return res.json({ success: true, message: "Deliveries resumed and hold lifted." });
    }

    if (action === "reschedule") {
      const targetDate = String(new_date || addCalendarDays(todayStr, 1)).slice(0, 10);
      await pool.query(
        `UPDATE parcels
         SET delivery_hold = FALSE,
             delivery_hold_reason = NULL,
             delivery_hold_until = NULL,
             scheduled_for = ?,
             updated_at = NOW()
         WHERE rider_id = ?
           AND (delivery_status IS NULL OR delivery_status = 'TO_DELIVER')
           AND delivery_status <> 'DELIVERED'`,
        [targetDate, incident.rider_id]
      );

      await pool.query(
        `UPDATE rider_incidents
         SET status = 'RESOLVED',
             hold_active = FALSE,
             coordinator_id = ?,
             coordinator_action = 'RESCHEDULED',
             coordinator_notes = ?,
             action_at = NOW(),
             updated_at = NOW()
         WHERE incident_id = ?`,
        [req.user.user_id, notes || `Deliveries rescheduled to ${targetDate}`, incidentId]
      );

      await logAudit(req.user, {
        category: "Incident",
        action: "Rescheduled deliveries after incident",
        target: `Incident #${incidentId}`,
        detail: `Coordinated rescheduling to ${targetDate} for rider ${incident.rider_id} undelivered parcels.`,
        riderId: incident.rider_id
      });

      return res.json({ success: true, message: `Deliveries rescheduled to ${targetDate}.` });
    }

    if (action === "extend_hold") {
      const hours = Number(extend_hours) || 24;
      await pool.query(
        `UPDATE parcels
         SET delivery_hold = TRUE,
             delivery_hold_until = NOW() + (? || ' hours')::INTERVAL,
             updated_at = NOW()
         WHERE rider_id = ?
           AND (delivery_status IS NULL OR delivery_status = 'TO_DELIVER')
           AND delivery_status <> 'DELIVERED'`,
        [String(hours), incident.rider_id]
      );

      await pool.query(
        `UPDATE rider_incidents
         SET hold_active = TRUE,
             hold_until = NOW() + (? || ' hours')::INTERVAL,
             coordinator_id = ?,
             coordinator_action = 'HOLD_EXTENDED',
             coordinator_notes = ?,
             action_at = NOW(),
             updated_at = NOW()
         WHERE incident_id = ?`,
        [String(hours), req.user.user_id, notes || `Hold extended by ${hours} hours`, incidentId]
      );

      await logAudit(req.user, {
        category: "Incident",
        action: "Extended delivery hold",
        target: `Incident #${incidentId}`,
        detail: `Delivery hold extended by ${hours} hours for rider ${incident.rider_id}.`,
        riderId: incident.rider_id
      });

      return res.json({ success: true, message: `Delivery hold extended by ${hours} hours.` });
    }
  } catch (error) {
    console.error("actionRiderIncident error:", error);
    res.status(500).json({ success: false, message: "Failed to process incident action." });
  }
}

module.exports = {
  listSellerCustomers,
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
  reviewDiscreetRequest,
  verifyParcel,
  rejectParcel,
  requestReupload,
  streamVideo,
  coordinatorInitiateReturnToHub,
  coordinatorHubVerify,
  coordinatorRtsDispatch,
  sellerConfirmReturned,
  reportRiderIncident,
  listRiderIncidents,
  confirmRiderIncident,
  actionRiderIncident
};
