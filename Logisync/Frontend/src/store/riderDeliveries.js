import { createStore } from "./createStore.js";
import { getUser } from "../api.js";
import { getParcels, useParcels } from "./records.js";
import { useRiderScans } from "./riderScans.js";
import { reportDelivered, reportFailed, scanForDelivery } from "../services/deliveryService.js";

// Delivery ng rider. Dumadaan ang parcel sa: Assigned -> (na-scan) To Be Delivered -> Delivered / Failed.
// Naka-save sa browser (localStorage) dahil wala pang endpoint para sa delivery status.
// TODO: palitan ng API kapag handa na ang backend:
//   GET /api/rider/parcels/assigned · POST /api/rider/parcels/:id/scan
//   POST /api/rider/parcels/:id/delivered (proof) · POST /api/rider/parcels/:id/failed (reason)
// Lahat ng pagbabasa/pagsulat ay dumadaan sa mga function sa file na ito, kaya dito lang kailangang palitan.

const store = createStore([], "pt-rider-deliveries");
const me = () => Number(getUser()?.user_id);

export const STAGE = { TO_DELIVER: "to_deliver", DELIVERED: "delivered", FAILED: "failed" };
export const FAIL_REASONS = [
  "Recipient not home",
  "Wrong or incomplete address",
  "Recipient refused the parcel",
  "Cannot contact the recipient",
  "Parcel damaged",
  "Other",
];

export const isCleared = (parcel) => parcel?.status === "VERIFIED";

export const useMyDeliveries = () => {
  const all = store.use();
  const id = me();
  return all.filter((d) => d.user_id === id);
};

// Mga parcel na in-assign ng coordinator sa rider na ito (galing sa Parcels ng coordinator).
// Pagtutugma ay sa pangalan ng rider. TODO: palitan ng GET /api/rider/parcels/assigned
function assignedFor(parcels) {
  const name = (getUser()?.name || "").trim().toLowerCase();
  if (!name) return [];
  return parcels
    .filter((p) => String(p.rider || "").trim().toLowerCase() === name && p.status === "In Transit")
    .map((p) => ({
      parcel_id: p.id,
      transaction_number: p.id,
      receiver: p.recipient,
      receiver_contact: "",
      address: p.address,
      contents: p.item,
      seller: p.shop,
      amount: p.amount,
      // Hugis na kapareho ng backend para pareho ang daloy ng scan
      status: p.verification === "Verified" ? "VERIFIED" : p.verification === "Flagged" ? "REJECTED" : "VIDEO_SUBMITTED",
      verification_status: p.verification,
      updated_at: new Date(p.ts).toISOString(),
    }));
}

// Assigned pa lang (hindi pa na-scan ng rider)
export function useAssignedParcels() {
  const parcels = useParcels();
  const deliveries = useMyDeliveries();
  const scans = useRiderScans();
  const taken = new Set([...deliveries, ...scans].flatMap((x) => [x.parcel_id, x.transaction_number]));
  return assignedFor(parcels).filter((p) => !taken.has(p.parcel_id) && !taken.has(p.transaction_number));
}

// Hanapin sa assigned parcels ng rider ang na-scan/na-type na value
export function findAssigned(value) {
  const v = String(value || "").trim().toLowerCase();
  return assignedFor(getParcels()).find((p) => [p.parcel_id, p.transaction_number].some((x) => String(x).toLowerCase() === v)) || null;
}

// Pagkatapos ma-scan: kapag verified, mapupunta sa To Be Delivered. Ibinabalik ang resulta.
export function addToDeliver(parcel, scanned) {
  if (!isCleared(parcel)) return "not_cleared";
  const id = me();
  const exists = store.get().some((d) => d.user_id === id && d.parcel_id === parcel.parcel_id);
  if (exists) return "exists";
  store.set((l) => [
    {
      user_id: id,
      parcel_id: parcel.parcel_id,
      transaction_number: parcel.transaction_number || scanned,
      receiver: parcel.receiver,
      contact: parcel.receiver_contact || "",
      address: parcel.address || "",
      contents: parcel.contents || "",
      seller: parcel.seller || "",
      scannedAt: Date.now(),
      stage: STAGE.TO_DELIVER,
    },
    ...l,
  ]);
  sync(() => scanForDelivery(parcel.parcel_id));
  return "added";
}

// Ipinapadala rin sa backend para makita ng coordinator at seller ang totoong delivery status.
// Best-effort: kung walang koneksyon o hindi totoong parcel sa backend (hal. sample data), tahimik na lang.
const sync = (fn) => fn().catch(() => {});

const patch = (parcelId, change) =>
  store.set((l) => l.map((d) => (d.user_id === me() && d.parcel_id === parcelId ? { ...d, ...change } : d)));

export const markDelivered = (parcelId, { proof, note }) => {
  patch(parcelId, { stage: STAGE.DELIVERED, doneAt: Date.now(), proof, note: note || "", reason: "" });
  sync(() => reportDelivered(parcelId, note)); // ang proof (larawan) ay nananatili sa device na ito
};

export const markFailed = (parcelId, { reason, note }) => {
  patch(parcelId, { stage: STAGE.FAILED, doneAt: Date.now(), reason, note: note || "", proof: "" });
  sync(() => reportFailed(parcelId, reason, note));
};

// Subukan ulit ang failed delivery
export const reattempt = (parcelId) => {
  patch(parcelId, { stage: STAGE.TO_DELIVER, doneAt: null, reason: "", note: "", scheduledFor: null, rescheduled: false });
  sync(() => scanForDelivery(parcelId));
};

// Kinumpirma ng Coordinator ang reschedule: bumalik ang parcel sa To Be Delivered ng rider, may bagong petsa.
// Tinatawag ito mula sa store/failedDeliveries.js (iisang browser storage ang gamit ng lahat ng role sa demo na ito).
export const rescheduleDelivery = (userId, parcelId, date) =>
  store.set((l) =>
    l.map((d) =>
      d.user_id === userId && d.parcel_id === parcelId
        ? { ...d, stage: STAGE.TO_DELIVER, doneAt: null, lastFailure: d.reason, reason: "", note: "", scheduledFor: date, rescheduled: true }
        : d
    )
  );
