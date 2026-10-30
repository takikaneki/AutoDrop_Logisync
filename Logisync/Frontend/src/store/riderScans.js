import { createStore } from "./createStore.js";
import { getUser } from "../api.js";

// Talaan ng mga na-scan ng rider SA DEVICE NA ITO (naka-save sa browser).
// Hindi ito galing sa backend: wala pang endpoint para sa delivery history ng rider.
const MAX = 30;
const store = createStore([], "pt-rider-scans");

export const useRiderScans = () => {
  const all = store.use();
  const me = Number(getUser()?.user_id);
  return all.filter((s) => s.user_id === me);
};

export function logScan(parcel, scanned) {
  const entry = {
    user_id: Number(getUser()?.user_id),
    parcel_id: parcel.parcel_id,
    scanned,
    transaction_number: parcel.transaction_number || scanned,
    receiver: parcel.receiver,
    seller: parcel.seller,
    status: parcel.status,
    at: new Date().toISOString(),
  };
  store.set((list) => [entry, ...list.filter((s) => !(s.user_id === entry.user_id && s.parcel_id === entry.parcel_id))].slice(0, MAX));
}

export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
