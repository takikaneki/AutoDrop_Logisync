import { api, apiBlobUrl, apiUpload } from "../api.js";

// Lahat ng usapan sa /api/parcels ay dito. Walang peke: totoong backend lang ang sinasagot.
const enc = encodeURIComponent;

// POST /api/parcels  (seller lang)
// Ang backend ang gumagawa ng parcel_id at nagtatakda ng status na WAITING_FOR_VIDEO.
export async function createParcel({ transaction_number, receiver_name, receiver_contact, contents, discrete_item = false }) {
  const data = await api("/parcels", {
    method: "POST",
    body: { transaction_number, receiver_name, receiver_contact, contents, discrete_item },
  });
  return data.parcel;
}

// GET /api/parcels  -> seller: sariling parcels lang | coordinator: lahat
export async function listParcels() {
  const data = await api("/parcels");
  return data.parcels;
}

// GET /api/parcels/by-transaction/:txn
// Ang hugis ng sagot ay depende sa role ng naka-login (seller / coordinator / rider).
export const getByTransaction = (txn) => api(`/parcels/by-transaction/${enc(txn)}`);

// Hahanapin muna bilang transaction number; kung wala, susubukan bilang parcel ID.
// (Para pwede ring i-type ang parcel ID bilang fallback.)
export async function findParcel(value, role) {
  try {
    return await getByTransaction(value);
  } catch (err) {
    if (!/not found/i.test(err.message)) throw err;
    const path = role === "seller" ? "/parcels/seller" : role === "coordinator" ? "/parcels/coordinator" : "/parcels";
    return api(`${path}/${enc(value)}`);
  }
}

export const getSellerParcel = (parcelId) => api(`/parcels/seller/${enc(parcelId)}`);
export const getCoordinatorParcel = (parcelId) => api(`/parcels/coordinator/${enc(parcelId)}`);

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
