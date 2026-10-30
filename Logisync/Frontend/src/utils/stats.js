import { STAGE } from "../store/riderDeliveries.js";

// Apat na bilang na pareho ang kahulugan sa Coordinator, Seller at Rider. Bawat parcel ay napupunta
// sa ISA lang sa tatlo, kaya Total = Flagged + Pending + Delivered.
//   Delivered = naihatid na ng rider
//   Flagged   = may problema: Rejected, Reupload requested, o Failed delivery
//   Pending   = lahat ng iba (naghihintay ng video, ng verification, o ng delivery)
const FLAGGED_STATUS = ["REJECTED", "REUPLOAD_REQUESTED"];

export function bucketOf(parcel) {
  if (parcel.delivery_status === "DELIVERED") return "DELIVERED";
  if (FLAGGED_STATUS.includes(parcel.status) || parcel.delivery_status === "FAILED") return "FLAGGED";
  return "PENDING";
}

// parcels = galing sa GET /api/parcels (seller: sarili lang, coordinator: lahat)
export function parcelStats(parcels) {
  const out = { total: parcels.length, flagged: 0, pending: 0, delivered: 0 };
  parcels.forEach((p) => {
    const b = bucketOf(p);
    if (b === "DELIVERED") out.delivered += 1;
    else if (b === "FLAGGED") out.flagged += 1;
    else out.pending += 1;
  });
  return out;
}

// Para sa rider: mga parcel na na-scan niya. scans = riderScans store, deliveries = riderDeliveries store.
// (Naka-save sa device na ito, dahil dito ginagawa ang pag-scan ng rider.)
export function riderStats(scans, deliveries) {
  const byId = new Map();
  scans.forEach((s) => byId.set(s.parcel_id, { status: s.status, stage: null }));
  deliveries.forEach((d) => byId.set(d.parcel_id, { ...(byId.get(d.parcel_id) || {}), stage: d.stage }));

  const out = { total: byId.size, flagged: 0, pending: 0, delivered: 0 };
  byId.forEach(({ status, stage }) => {
    if (stage === STAGE.DELIVERED) out.delivered += 1;
    else if (stage === STAGE.FAILED || FLAGGED_STATUS.includes(status)) out.flagged += 1;
    else out.pending += 1;
  });
  return out;
}

// Rider dashboard: galing sa parehong data na ginagamit ng mga listahan (Assigned + To Be Delivered / Delivered / Failed),
// kaya laging tugma ang bilang sa card at sa pahinang bubukas.
//   assigned   = naka-assign pa lang, hindi pa na-scan (useAssignedParcels)
//   deliveries = useMyDeliveries
export function riderCounts(assigned, deliveries) {
  const n = (stage) => deliveries.filter((d) => d.stage === stage).length;
  const toDeliver = n(STAGE.TO_DELIVER);
  const delivered = n(STAGE.DELIVERED);
  const failed = n(STAGE.FAILED);
  return { total: assigned.length + toDeliver + delivered + failed, waiting: assigned.length, toDeliver, delivered, failed };
}

export const STAT_NOTES = {
  total: "All parcels",
  flagged: "Rejected, reupload requested or failed delivery",
  pending: "Not delivered yet",
  delivered: "Delivered by a rider",
};
