import { createStore } from "./createStore.js";
import { getUser } from "../api.js";

// Talaan ng mga na-scan ng rider SA DEVICE NA ITO (naka-save sa browser).
// Hindi ito galing sa backend: wala pang endpoint para sa delivery history ng rider.
const MAX = 30;
const store = createStore([], "pt-rider-scans");

export const getRiderScans = () => {
  const all = store.get();
  const me = Number(getUser()?.user_id);
  const myName = String(getUser()?.name || "").trim().toLowerCase();
  return all.filter(
    (s) =>
      Number(s.user_id) === me ||
      (myName && s.rider_name && String(s.rider_name).trim().toLowerCase() === myName)
  );
};

export const useRiderScans = () => {
  const all = store.use();
  const me = Number(getUser()?.user_id);
  const myName = String(getUser()?.name || "").trim().toLowerCase();
  return all.filter(
    (s) =>
      Number(s.user_id) === me ||
      (myName && s.rider_name && String(s.rider_name).trim().toLowerCase() === myName)
  );
};

export function logScan(parcel, scanned) {
  const user = getUser();
  const entry = {
    user_id: Number(user?.user_id),
    rider_name: user?.name || "",
    parcel_id: parcel.parcel_id,
    scanned: scanned || parcel.transaction_number || parcel.parcel_id,
    transaction_number: parcel.transaction_number || scanned || parcel.parcel_id,
    receiver: parcel.receiver || parcel.receiver_name || "",
    contact: parcel.contact || parcel.receiver_contact || "",
    address: parcel.address || parcel.receiver_address || "",
    contents: parcel.contents || "",
    seller: parcel.seller || parcel.seller_name || "",
    status: parcel.raw_status || parcel.verification_status || parcel.status || "VERIFIED",
    at: parcel.scanned_at ? new Date(parcel.scanned_at).toISOString() : new Date().toISOString(),
  };
  store.set((list) =>
    [entry, ...list.filter((s) => !(Number(s.user_id) === Number(entry.user_id) && s.parcel_id === entry.parcel_id))].slice(
      0,
      MAX
    )
  );
}

export function syncScansFromServerParcels(riderId, parcels = []) {
  if (!riderId || !Array.isArray(parcels) || parcels.length === 0) return;
  store.set((list) => {
    const existingByParcelId = new Map(
      list.filter((s) => s.user_id === riderId).map((s) => [String(s.parcel_id), s])
    );
    let changed = false;
    const additions = [];

    parcels.forEach((p) => {
      if (!p?.parcel_id) return;
      const key = String(p.parcel_id);
      if (!existingByParcelId.has(key)) {
        changed = true;
        additions.push({
          user_id: riderId,
          parcel_id: p.parcel_id,
          scanned: p.transaction_number || p.parcel_id,
          transaction_number: p.transaction_number || p.parcel_id,
          receiver: p.receiver || p.receiver_name || "",
          seller: p.seller || p.seller_name || "",
          status: p.status || "VERIFIED",
          at: p.scanned_at
            ? new Date(p.scanned_at).toISOString()
            : p.updated_at
            ? new Date(p.updated_at).toISOString()
            : new Date().toISOString(),
        });
      }
    });

    if (!changed) return list;
    const otherUsers = list.filter((s) => s.user_id !== riderId);
    const mineMerged = [...list.filter((s) => s.user_id === riderId), ...additions]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, MAX);
    return [...mineMerged, ...otherUsers];
  });
}

export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
