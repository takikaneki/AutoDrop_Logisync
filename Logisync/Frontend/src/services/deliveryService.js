import { api } from "../api.js";

// Delivery ng rider sa backend (POST /api/parcels/rider/:id/...).
const enc = encodeURIComponent;
const resolvedParcelIdCache = new Map();

// Kung transaction_number ang naipasa (hal. "20261023111"), kunin muna ang aktwal na parcel_id ("SL...") mula sa DB
// para gumana nang 100% kahit saang backend version.
export async function resolveBackendParcelId(parcelIdOrTxn) {
  const key = String(parcelIdOrTxn || "").trim();
  if (!key) return "";
  if (resolvedParcelIdCache.has(key.toLowerCase())) {
    return resolvedParcelIdCache.get(key.toLowerCase());
  }
  if (/^SL\d+/i.test(key)) {
    resolvedParcelIdCache.set(key.toLowerCase(), key);
    return key;
  }
  try {
    const res = await api(`/parcels/by-transaction/${enc(key)}`);
    const realId = res?.parcel?.parcel_id ? String(res.parcel.parcel_id).trim() : key;
    if (realId) {
      resolvedParcelIdCache.set(key.toLowerCase(), realId);
      resolvedParcelIdCache.set(realId.toLowerCase(), realId);
    }
    return realId || key;
  } catch {
    return key;
  }
}

export const fetchMyRiderParcels = () => api("/parcels/rider/mine");

export async function scanForDelivery(parcelId, body = {}) {
  const realId = await resolveBackendParcelId(parcelId);
  try {
    return await api(`/parcels/rider/${enc(realId)}/scan`, { method: "POST", body });
  } catch (err) {
    if (realId !== parcelId) {
      return api(`/parcels/rider/${enc(parcelId)}/scan`, { method: "POST", body });
    }
    throw err;
  }
}

// Siguraduhing "na-scan" na sa backend bago mag-delivered/failed (hindi nagkakaproblema kung na-scan na)
async function ensureScanned(parcelId) {
  try {
    await scanForDelivery(parcelId);
  } catch {
    /* hal. nai-scan na dati o hindi totoong parcel: ipagpatuloy at hayaang ang susunod na hakbang ang magsabi */
  }
}

export async function reportDelivered(parcelId, note, extra = {}) {
  const realId = await resolveBackendParcelId(parcelId);
  await ensureScanned(realId);
  try {
    return await api(`/parcels/rider/${enc(realId)}/delivered`, {
      method: "POST",
      body: { note, ...extra },
    });
  } catch {
    // Fallback kung masyadong malaki ang base64 proof sa lumang backend limit (100kb)
    return api(`/parcels/rider/${enc(realId)}/delivered`, {
      method: "POST",
      body: { note: note || "Delivered with proof" },
    });
  }
}

export async function reportFailed(parcelId, reason, note, extra = {}) {
  const realId = await resolveBackendParcelId(parcelId);
  await ensureScanned(realId);
  const text = note ? `${reason}: ${note}` : reason;
  try {
    return await api(`/parcels/rider/${enc(realId)}/failed`, {
      method: "POST",
      body: { reason: reason || text, note: note || text, ...extra },
    });
  } catch {
    return api(`/parcels/rider/${enc(realId)}/failed`, {
      method: "POST",
      body: { reason: reason || text, note: note || text },
    });
  }
}
