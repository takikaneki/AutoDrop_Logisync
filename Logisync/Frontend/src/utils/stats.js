import { STAGE } from "../store/riderDeliveries.js";

// Apat na bilang na pareho ang kahulugan sa Coordinator, Seller at Rider. Bawat parcel ay napupunta
// sa ISA lang sa tatlo, kaya Total = Flagged + Pending + Delivered.
//   Delivered = naihatid na ng rider
//   Flagged   = may problema: Rejected, Reupload requested, Failed delivery, o Return to Hub
//   Pending   = lahat ng iba (naghihintay ng video, ng verification, o ng delivery / rescheduled)
const FLAGGED_STATUS = ["REJECTED", "REUPLOAD_REQUESTED", "RETURN_TO_HUB", "DELIVERY_FAILED"];

export function bucketOf(parcel) {
  if (parcel.status === "DELIVERED" || parcel.delivery_status === "DELIVERED") return "DELIVERED";
  if (FLAGGED_STATUS.includes(parcel.status) || parcel.returnToHub || parcel.delivery_status === "FAILED") return "FLAGGED";
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
export function riderStats(scans, deliveries) {
  const byId = new Map();
  scans.forEach((s) => byId.set(s.parcel_id, { status: s.status, stage: null }));
  deliveries.forEach((d) => byId.set(d.parcel_id, { ...(byId.get(d.parcel_id) || {}), stage: d.stage, returnToHub: d.returnToHub }));

  const out = { total: byId.size, flagged: 0, pending: 0, delivered: 0 };
  byId.forEach(({ status, stage, returnToHub }) => {
    if (stage === STAGE.DELIVERED) out.delivered += 1;
    else if (stage === STAGE.FAILED || stage === STAGE.RETURN_TO_HUB || returnToHub || FLAGGED_STATUS.includes(status)) out.flagged += 1;
    else out.pending += 1;
  });
  return out;
}

// Rider dashboard: galing sa parehong data na ginagamit ng mga listahan (Assigned + To Be Delivered / Delivered / Failed & Return to Hub)
export function riderCounts(assigned, deliveries) {
  const toDeliver = deliveries.filter((d) => d.stage === STAGE.TO_DELIVER && !d.returnToHub).length;
  const delivered = deliveries.filter((d) => d.stage === STAGE.DELIVERED).length;
  const returnToHub = deliveries.filter((d) => d.stage === STAGE.RETURN_TO_HUB || d.returnToHub).length;
  const failed = deliveries.filter((d) => d.stage === STAGE.FAILED || d.stage === STAGE.RETURN_TO_HUB || d.returnToHub).length;
  return {
    total: assigned.length + toDeliver + delivered + failed,
    waiting: assigned.length,
    toDeliver,
    delivered,
    failed,
    returnToHub,
  };
}

export const STAT_NOTES = {
  total: "All parcels",
  flagged: "Rejected, reupload requested, failed delivery or Return to Hub",
  pending: "Not delivered yet",
  delivered: "Delivered by a rider",
};
