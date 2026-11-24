import { api, apiBlobUrl, apiUpload } from "../api.js";
import {
  getParcelAddress,
  saveCustomerFromParcel,
  setCustomersFromDatabase,
  syncCustomersFromParcels,
} from "../store/customers.js";
import { STAGE, getDeliveryRecordForParcel, syncAutomaticReschedules } from "../store/riderDeliveries.js";

// Lahat ng usapan sa /api/parcels ay dito. Pinapayaman din ng database customer address at live delivery/reschedule status
// para consistent ang status sa Rider, Coordinator, at Seller dashboards.
const enc = encodeURIComponent;

export const enrichParcel = (p) => {
  if (!p) return p;
  syncAutomaticReschedules();
  const addr = getParcelAddress(p);
  const d = getDeliveryRecordForParcel(p.parcel_id) || getDeliveryRecordForParcel(p.transaction_number);
  const isCod = Boolean(p.is_cod || String(p.payment_method || "").toUpperCase() === "COD");

  let next = {
    ...(addr && !p.receiver_address ? { ...p, receiver_address: addr } : p),
    raw_status: p.status,
    verification_status: p.verification_status || (p.status === "VERIFIED" ? "VERIFIED" : p.verification_status),
    is_cod: isCod,
    payment_method: isCod ? "COD" : "NON_COD",
    delivery_hold: Boolean(p.delivery_hold),
    delivery_hold_reason: p.delivery_hold_reason || "",
    delivery_hold_until: p.delivery_hold_until || null,
  };

  let dbAttempts = [];
  if (Array.isArray(p.attempts)) {
    dbAttempts = p.attempts;
  } else if (typeof p.delivery_attempts === "string" && p.delivery_attempts.trim()) {
    try {
      const parsed = JSON.parse(p.delivery_attempts);
      if (Array.isArray(parsed)) dbAttempts = parsed;
    } catch {
      dbAttempts = [];
    }
  }

  if (p.delivery_status || p.rescheduled || p.return_to_hub || p.rth_status || p.status === "RTH_PENDING" || p.status === "RTH_CONFIRMED" || p.status === "RESCHEDULED") {
    let status = next.status;
    if (p.delivery_status === "DELIVERED" || p.delivered_at) {
      status = "DELIVERED";
    } else if (p.rth_status === "CONFIRMED" || p.status === "RTH_CONFIRMED") {
      status = "RTH_CONFIRMED";
    } else if (p.status === "RETURN_TO_HUB" || p.rth_status === "PENDING" || p.rth_status === "PENDING_CONFIRMATION" || p.status === "RTH_PENDING" || p.return_to_hub || p.delivery_status === "RETURN_TO_HUB") {
      status = "RETURN_TO_HUB";
    } else if ((p.rescheduled || p.status === "RESCHEDULED") && (p.delivery_status === "TO_DELIVER" || !p.delivery_status)) {
      status = "RESCHEDULED";
    } else if (p.delivery_status === "TO_DELIVER") {
      status = "OUT_FOR_DELIVERY";
    } else if (p.delivery_status === "FAILED") {
      status = "DELIVERY_FAILED";
    }

    next = {
      ...next,
      status,
      rth_status: p.rth_status || (status === "RTH_CONFIRMED" ? "CONFIRMED" : status === "RETURN_TO_HUB" ? "PENDING" : null),
      rth_reason: p.rth_reason || "",
      rth_requested_at: p.rth_requested_at || null,
      rth_confirmed_at: p.rth_confirmed_at || null,
      rth_confirmed_notes: p.rth_confirmed_notes || "",
      rescheduled: Boolean(p.rescheduled || p.status === "RESCHEDULED"),
      scheduledFor: p.scheduled_for || p.scheduledFor || null,
      rescheduleCount: Number(p.reschedule_count || p.rescheduleCount || 0),
      maxReschedules: 3,
      attempts: dbAttempts,
      lastFailure: p.last_failure || p.delivery_note || "",
      returnToHub: Boolean(p.return_to_hub || p.delivery_status === "RETURN_TO_HUB" || p.rth_status),
      returnCoordinated: Boolean(p.return_coordinated || p.rth_confirmed_at),
      returnNote: p.return_note || p.rth_confirmed_notes || "",
    };
  }

  if (d) {
    let status = next.status;
    const reschedCount = Math.max(Number(d.rescheduleCount || 0), Number(next.rescheduleCount || 0));
    const isDelivered = d.stage === STAGE.DELIVERED || next.status === "DELIVERED";
    const isRth =
      !isDelivered &&
      ((d.returnToHub || d.stage === STAGE.RETURN_TO_HUB || next.returnToHub) && reschedCount >= 3);

    if (isDelivered) {
      status = "DELIVERED";
    } else if (isRth) {
      status = "RETURN_TO_HUB";
    } else if ((d.rescheduled || next.rescheduled) && (d.stage === STAGE.TO_DELIVER || next.status === "RESCHEDULED")) {
      status = "RESCHEDULED";
    } else if (d.stage === STAGE.TO_DELIVER) {
      status = "OUT_FOR_DELIVERY";
    } else if (d.stage === STAGE.FAILED) {
      status = "DELIVERY_FAILED";
    }

    next = {
      ...next,
      status,
      rescheduled: Boolean(d.rescheduled || next.rescheduled),
      scheduledFor: d.scheduledFor || next.scheduledFor || null,
      rescheduleCount: reschedCount,
      maxReschedules: 3,
      attempts: Array.isArray(d.attempts) && d.attempts.length >= dbAttempts.length ? d.attempts : dbAttempts,
      lastFailure: d.lastFailure || d.reason || next.lastFailure || "",
      returnToHub: isRth,
      returnCoordinated: Boolean(d.returnCoordinated || next.returnCoordinated),
      returnNote: d.returnNote || next.returnNote || "",
      deliveryRecord: d,
    };
  }

  return next;
};

// GET /api/parcels/customers (seller lang)
// Kinukuha mula sa PostgreSQL database ang mga dating naisave na customer ng kasalukuyang seller.
export async function fetchSellerCustomers() {
  try {
    const data = await api("/parcels/customers");
    const list = Array.isArray(data?.customers) ? data.customers : [];
    setCustomersFromDatabase(list);
    return list;
  } catch {
    // Fallback kung hindi pa nare-restart ang backend server: kunin mula sa aktwal na DB parcels ng seller
    const data = await api("/parcels");
    const parcels = Array.isArray(data?.parcels) ? data.parcels : [];
    setCustomersFromDatabase([]);
    syncCustomersFromParcels(parcels);
    return parcels;
  }
}

// POST /api/parcels  (seller lang)
// Ang backend ang gumagawa ng parcel_id, nagse-save ng customer sa seller_customers table, at nagtatakda ng status na WAITING_FOR_VIDEO.
export async function createParcel({
  transaction_number,
  receiver_name,
  receiver_address = "",
  receiver_house_number = "",
  receiver_street = "",
  receiver_barangay = "",
  receiver_city = "",
  receiver_province = "",
  receiver_contact,
  contents,
  quantity = 1,
  content_category = "",
  other_category_description = "",
  discrete_item = false,
  discreet_reason = "",
  updateExistingCustomer = false,
  is_cod = false,
  payment_method = "NON_COD",
  draft_id = null,
  idempotency_key = null,
}) {
  const data = await api("/parcels", {
    method: "POST",
    body: {
      transaction_number,
      receiver_name,
      receiver_address,
      receiver_house_number,
      receiver_street,
      receiver_barangay,
      receiver_city,
      receiver_province,
      receiver_contact,
      contents,
      quantity,
      content_category,
      other_category_description,
      discrete_item,
      discreet_reason,
      updateExistingCustomer,
      is_cod,
      payment_method,
      ...(draft_id ? { draft_id } : {}),
      ...(idempotency_key ? { idempotency_key } : {}),
    },
  });
  const created = {
    ...data.parcel,
    receiver_address: data.parcel?.receiver_address || receiver_address,
    receiver_house_number: data.parcel?.receiver_house_number || receiver_house_number,
    receiver_street: data.parcel?.receiver_street || receiver_street,
    receiver_barangay: data.parcel?.receiver_barangay || receiver_barangay,
    receiver_city: data.parcel?.receiver_city || receiver_city,
    receiver_province: data.parcel?.receiver_province || receiver_province,
  };
  saveCustomerFromParcel({
    name: receiver_name,
    contact: receiver_contact,
    address: receiver_address,
    house_number: receiver_house_number,
    street: receiver_street,
    barangay: receiver_barangay,
    city: receiver_city,
    province: receiver_province,
    parcelId: created.parcel_id,
    transactionNumber: created.transaction_number || transaction_number,
    updateExisting: updateExistingCustomer,
  });
  return enrichParcel(created);
}

// GET /api/parcels  -> seller: sariling parcels lang | coordinator: lahat
export async function listParcels() {
  const data = await api("/parcels");
  if (!data || !Array.isArray(data.parcels)) {
    throw new Error("Invalid parcel response from server.");
  }
  const rawList = data.parcels;
  const list = rawList.filter((p) => {
    const txn = String(p?.transaction_number || "").trim();
    const pid = String(p?.parcel_id || "").trim();
    return (/^PH(?:\d{10}[A-Z]|\d{12})$/i.test(txn) || /^SPX\d{9}$/i.test(txn)) && pid.length > 0 && pid.length <= 10;
  });
  syncCustomersFromParcels(list);
  return list.map(enrichParcel);
}

// GET /api/parcels/by-transaction/:txn
// Ang hugis ng sagot ay depende sa role ng naka-login (seller / coordinator / rider).
export const getByTransaction = async (txn) => {
  const res = await api(`/parcels/by-transaction/${enc(txn)}`);
  return res?.parcel ? { ...res, parcel: enrichParcel(res.parcel) } : res;
};

// Hahanapin muna bilang transaction number; kung wala, susubukan bilang parcel ID.
// (Para pwede ring i-type ang parcel ID bilang fallback.)
export async function findParcel(value, role) {
  const restoreRiderStatus = (res) => {
    if (!res?.parcel) return res;
    if (role === "rider" && (res.parcel.raw_status === "VERIFIED" || res.parcel.verification_status === "VERIFIED")) {
      return { ...res, parcel: { ...res.parcel, status: "VERIFIED" } };
    }
    return res;
  };
  try {
    return restoreRiderStatus(await getByTransaction(value));
  } catch (err) {
    if (!/not found/i.test(err.message)) throw err;
    const path = role === "seller" ? "/parcels/seller" : role === "coordinator" ? "/parcels/coordinator" : "/parcels";
    const res = await api(`${path}/${enc(value)}`);
    return restoreRiderStatus(res?.parcel ? { ...res, parcel: enrichParcel(res.parcel) } : res);
  }
}

export const getSellerParcel = async (parcelId) => {
  const res = await api(`/parcels/seller/${enc(parcelId)}`);
  return res?.parcel ? { ...res, parcel: enrichParcel(res.parcel) } : res;
};

export const getCoordinatorParcel = async (parcelId) => {
  const res = await api(`/parcels/coordinator/${enc(parcelId)}`);
  return res?.parcel ? { ...res, parcel: enrichParcel(res.parcel) } : res;
};

// Direct-to-Cloudinary signed upload (bypasses Vercel's 4.5 MB serverless body limit for up to 50 MB videos),
// with automatic fallback to multipart upload if direct signing is unavailable.
export async function uploadVideo(parcelId, file, onProgress) {
  let sig = null;
  try {
    sig = await api(`/parcels/seller/${enc(parcelId)}/video-signature`, { method: "POST" });
  } catch {
    sig = null;
  }

  if (sig?.cloudName && sig?.apiKey && sig?.signature && sig?.timestamp) {
    const cloudForm = new FormData();
    cloudForm.append("file", file);
    cloudForm.append("api_key", sig.apiKey);
    cloudForm.append("timestamp", String(sig.timestamp));
    cloudForm.append("signature", sig.signature);
    if (sig.folder) cloudForm.append("folder", sig.folder);
    if (sig.publicId) cloudForm.append("public_id", sig.publicId);

    const cloudRes = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/video/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      };
      xhr.onerror = () => reject(new Error("Network error while uploading video to cloud storage. Please check your internet connection."));
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
          return resolve(data);
        }
        reject(new Error(data?.error?.message || `Video upload failed (${xhr.status}).`));
      };
      xhr.send(cloudForm);
    });

    onProgress?.(100);
    return api(`/parcels/seller/${enc(parcelId)}/video`, {
      method: "POST",
      body: {
        secure_url: cloudRes.secure_url,
        public_id: cloudRes.public_id,
        file_name: file.name,
        file_size: file.size || cloudRes.bytes || 0,
        mime_type: file.type || "video/mp4",
      },
    });
  }

  const form = new FormData();
  form.append("video", file);
  return apiUpload(`/parcels/seller/${enc(parcelId)}/video`, form, onProgress);
}

// Coordinator: action = "verify" | "reject" | "request-reupload"
export const decideParcel = (parcelId, action, remarks, discreetDecision) =>
  api(`/parcels/coordinator/${enc(parcelId)}/${action}`, {
    method: "POST",
    body: {
      remarks: remarks || "",
      ...(discreetDecision ? { discreet_decision: discreetDecision } : {}),
    },
  });

// Coordinator: approve or reject seller's discreet handling request
export const decideDiscreetHandling = (parcelId, decision, remarks = "") =>
  api(`/parcels/coordinator/${enc(parcelId)}/discreet`, {
    method: "POST",
    body: { decision, remarks },
  });

// Coordinator: Return to Hub Initiation / Approval
export const initiateReturnToHub = (parcelId, reason = "") =>
  api(`/parcels/coordinator/${enc(parcelId)}/return-to-hub`, {
    method: "POST",
    body: { reason },
  });

// Rider: Report incident
export const reportIncident = ({ incident_type, description }) =>
  api("/parcels/rider/incidents", {
    method: "POST",
    body: { incident_type, description },
  });

// List incidents (Coordinator sees all, Rider sees own)
export const fetchIncidents = (role = "coordinator") =>
  api(`/parcels/${role === "rider" ? "rider" : "coordinator"}/incidents`);

// Coordinator: Confirm incident
export const confirmIncident = (incidentId) =>
  api(`/parcels/coordinator/incidents/${incidentId}/confirm`, { method: "POST" });

// Coordinator: Action incident strictly: 'resume', 'reschedule', 'extend_hold'
export const actionIncident = (incidentId, { action, notes = "", new_date = "", extend_hours = 24 }) =>
  api(`/parcels/coordinator/incidents/${incidentId}/action`, {
    method: "POST",
    body: { action, notes, new_date, extend_hours },
  });

// GET /api/parcels/videos/:videoId (coordinator lang) -> blob URL
export const getVideoUrl = (videoId) => apiBlobUrl(`/parcels/videos/${enc(videoId)}`);

// Unified QR Code Scan (Roles: Rider, Coordinator, Seller)
export const scanUnifiedQr = (code) =>
  api("/parcels/scan-unified", {
    method: "POST",
    body: { code },
  });

// Rider: Reschedule for delivery (Buyer Unavailable)
export const riderRescheduleParcel = (parcelId, { reason, scheduledFor, notes, proof } = {}) =>
  api(`/parcels/rider/${enc(parcelId)}/reschedule`, {
    method: "POST",
    body: { reason, scheduledFor, notes, proof },
  });

// Rider: Return to Hub request (Buyer Cancelled / Refused / Damaged / Wrong Address)
export const riderRequestRth = (parcelId, { reason, notes, proof } = {}) =>
  api(`/parcels/rider/${enc(parcelId)}/rth-request`, {
    method: "POST",
    body: { reason, notes, proof },
  });

// Coordinator: List all RTH parcels (pending & confirmed)
export const fetchCoordinatorRth = () =>
  api("/parcels/coordinator/rth");

// Coordinator: Confirm Return to Hub
export const confirmCoordinatorRth = (parcelId, { notes } = {}) =>
  api(`/parcels/coordinator/${enc(parcelId)}/rth-confirm`, {
    method: "POST",
    body: { notes },
  });

// Complete movement and status history for a parcel
export const fetchParcelHistory = (parcelId) =>
  api(`/parcels/${enc(parcelId)}/history`);

// Seller Create Parcel Draft API (strictly isolated per authenticated Seller account)
export const fetchServerParcelDraft = () =>
  api("/parcels/draft");

export const saveServerParcelDraft = (payload) =>
  api("/parcels/draft", {
    method: "PUT",
    body: payload,
  });

export const deleteServerParcelDraft = () =>
  api("/parcels/draft", {
    method: "DELETE",
  });
