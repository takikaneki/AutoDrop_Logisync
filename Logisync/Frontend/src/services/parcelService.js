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
    rts_status: p.rts_status || null,
    hub_verified_at: p.hub_verified_at || null,
    rts_dispatched_at: p.rts_dispatched_at || null,
    returned_to_seller_at: p.returned_to_seller_at || null,
    returned_received_by: p.returned_received_by || null,
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

  if (p.delivery_status || p.rescheduled || p.return_to_hub || p.rts_status) {
    let status = next.status;
    if (p.rts_status === "RETURNED_TO_SELLER" || p.status === "RETURNED") {
      status = "RETURNED_TO_SELLER";
    } else if (p.rts_status === "RTS_IN_TRANSIT") {
      status = "RTS_IN_TRANSIT";
    } else if (p.rts_status === "HUB_VERIFIED") {
      status = "HUB_VERIFIED";
    } else if (p.delivery_status === "DELIVERED" || p.delivered_at) {
      status = "DELIVERED";
    } else if (p.return_to_hub || p.delivery_status === "RETURN_TO_HUB" || p.rts_status === "RETURN_TO_HUB") {
      status = "RETURN_TO_HUB";
    } else if (p.rescheduled && p.delivery_status === "TO_DELIVER") {
      status = "RESCHEDULED";
    } else if (p.delivery_status === "TO_DELIVER") {
      status = "OUT_FOR_DELIVERY";
    } else if (p.delivery_status === "FAILED") {
      status = "DELIVERY_FAILED";
    }

    next = {
      ...next,
      status,
      rescheduled: Boolean(p.rescheduled),
      scheduledFor: p.scheduled_for || null,
      rescheduleCount: Number(p.reschedule_count || 0),
      maxReschedules: 3,
      attempts: dbAttempts,
      lastFailure: p.last_failure || p.delivery_note || "",
      returnToHub: Boolean(p.return_to_hub || p.delivery_status === "RETURN_TO_HUB"),
      returnCoordinated: Boolean(p.return_coordinated),
      returnNote: p.return_note || "",
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
  content_category = "",
  other_category_description = "",
  discrete_item = false,
  discreet_reason = "",
  updateExistingCustomer = false,
  is_cod = false,
  payment_method = "NON_COD",
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
      content_category,
      other_category_description,
      discrete_item,
      discreet_reason,
      updateExistingCustomer,
      is_cod,
      payment_method,
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
  const list = Array.isArray(data.parcels) ? data.parcels : [];
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

// POST /api/parcels/seller/:parcelId/video  (multipart, field name = "video")
export function uploadVideo(parcelId, file, onProgress) {
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

// Coordinator: Stage 1 Return to Hub Initiation / Approval
export const initiateReturnToHub = (parcelId, reason = "") =>
  api(`/parcels/coordinator/${enc(parcelId)}/return-to-hub`, {
    method: "POST",
    body: { reason },
  });

// Coordinator: Stage 2 Hub Verification
export const hubVerifyParcel = (parcelId) =>
  api(`/parcels/coordinator/${enc(parcelId)}/hub-verify`, { method: "POST" });

// Coordinator: Stage 3 RTS Dispatch to Seller
export const rtsDispatchParcel = (parcelId) =>
  api(`/parcels/coordinator/${enc(parcelId)}/rts-dispatch`, { method: "POST" });

// Seller / Coordinator: Stage 4 Confirm Returned to Seller
export const confirmReturnedParcel = (parcelId, receivedBy = "") =>
  api(`/parcels/seller/${enc(parcelId)}/confirm-returned`, {
    method: "POST",
    body: { received_by: receivedBy },
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
