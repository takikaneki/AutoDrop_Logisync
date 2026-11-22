import { createStore } from "./createStore.js";
import { getUser } from "../api.js";

const MAX = 30;
const store = createStore([], "pt-portal-scans-v1");

export function usePortalScans(role) {
  const all = store.use();
  const me = Number(getUser()?.user_id);
  return all.filter((s) => s.role === role && Number(s.user_id) === me);
}

export function logPortalScan(role, parcel, scanned) {
  if (!parcel) return;
  const user = getUser();
  const parcelId = parcel.parcel_id || parcel.transaction_number || scanned;
  const entry = {
    role,
    user_id: Number(user?.user_id),
    parcel_id: parcelId,
    transaction_number: parcel.transaction_number || scanned || parcelId,
    receiver: parcel.receiver || parcel.receiver_name || "",
    seller: parcel.seller || parcel.seller_name || "",
    contents: parcel.contents || "",
    status: parcel.raw_status || parcel.verification_status || parcel.status || "PENDING",
    at: new Date().toISOString(),
  };

  store.set((list) => {
    const others = list.filter(
      (s) => !(s.role === role && Number(s.user_id) === Number(entry.user_id) && String(s.parcel_id) === String(entry.parcel_id))
    );
    const sameRole = [entry, ...others.filter((s) => s.role === role && Number(s.user_id) === Number(entry.user_id))].slice(0, MAX);
    const rest = others.filter((s) => !(s.role === role && Number(s.user_id) === Number(entry.user_id)));
    return [...sameRole, ...rest];
  });
}
