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
  let next = addr && !p.receiver_address ? { ...p, receiver_address: addr } : { ...p };

  if (d) {
    let status = next.status;
    if (d.stage === STAGE.DELIVERED) {
      status = "DELIVERED";
    } else if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB) {
      status = "RETURN_TO_HUB";
    } else if (d.rescheduled && d.stage === STAGE.TO_DELIVER) {
      status = "RESCHEDULED";
    } else if (d.stage === STAGE.TO_DELIVER) {
      status = "OUT_FOR_DELIVERY";
    } else if (d.stage === STAGE.FAILED) {
      status = "DELIVERY_FAILED";
    }

    next = {
      ...next,
      status,
      rescheduled: Boolean(d.rescheduled),
      scheduledFor: d.scheduledFor || null,
      rescheduleCount: Number(d.rescheduleCount || 0),
      maxReschedules: Number(d.maxReschedules || 3),
      attempts: Array.isArray(d.attempts) ? d.attempts : [],
      lastFailure: d.lastFailure || d.reason || "",
      returnToHub: Boolean(d.returnToHub || d.stage === STAGE.RETURN_TO_HUB),
      returnCoordinated: Boolean(d.returnCoordinated),
      returnNote: d.returnNote || "",
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
  receiver_contact,
  contents,
  discrete_item = false,
  updateExistingCustomer = false,
}) {
  const data = await api("/parcels", {
    method: "POST",
    body: {
      transaction_number,
      receiver_name,
      receiver_address,
      receiver_contact,
      contents,
      discrete_item,
      updateExistingCustomer,
    },
  });
  const created = {
    ...data.parcel,
    receiver_address: data.parcel?.receiver_address || receiver_address,
  };
  saveCustomerFromParcel({
    name: receiver_name,
    contact: receiver_contact,
    address: receiver_address,
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
  try {
    return await getByTransaction(value);
  } catch (err) {
    if (!/not found/i.test(err.message)) throw err;
    const path = role === "seller" ? "/parcels/seller" : role === "coordinator" ? "/parcels/coordinator" : "/parcels";
    const res = await api(`${path}/${enc(value)}`);
    return res?.parcel ? { ...res, parcel: enrichParcel(res.parcel) } : res;
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
export const decideParcel = (parcelId, action, remarks) =>
  api(`/parcels/coordinator/${enc(parcelId)}/${action}`, { method: "POST", body: { remarks: remarks || "" } });

// GET /api/parcels/videos/:videoId (coordinator lang) -> blob URL
export const getVideoUrl = (videoId) => apiBlobUrl(`/parcels/videos/${enc(videoId)}`);
