import { api } from "../api.js";

// Delivery ng rider sa backend (POST /api/parcels/rider/:id/...).
const enc = encodeURIComponent;

export const scanForDelivery = (parcelId) => api(`/parcels/rider/${enc(parcelId)}/scan`, { method: "POST" });

// Siguraduhing "na-scan" na sa backend bago mag-delivered/failed (hindi nagkakaproblema kung na-scan na)
async function ensureScanned(parcelId) {
  try {
    await scanForDelivery(parcelId);
  } catch {
    /* hal. nai-scan na dati o hindi totoong parcel: ipagpatuloy at hayaang ang susunod na hakbang ang magsabi */
  }
}

export async function reportDelivered(parcelId, note) {
  await ensureScanned(parcelId);
  return api(`/parcels/rider/${enc(parcelId)}/delivered`, { method: "POST", body: { note } });
}

export async function reportFailed(parcelId, reason, note) {
  await ensureScanned(parcelId);
  const text = note ? `${reason}: ${note}` : reason;
  return api(`/parcels/rider/${enc(parcelId)}/failed`, { method: "POST", body: { reason: text } });
}
