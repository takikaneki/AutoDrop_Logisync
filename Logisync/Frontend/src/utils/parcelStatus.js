// Ang mga halaga sa kaliwa ay ang nakaimbak sa database (hindi natin binabago).
// Ang "label" ay ang madaling basahin na bersyon para sa user.
const gray = "text-slate-600 dark:text-slate-300";
const amber = "text-[#b45309] dark:text-[#fcd34d]";
const blue = "text-[#c84227] dark:text-[#ff8a65]";
const green = "text-[#15803d] dark:text-[#4ade80]";
const red = "text-[#dc2626] dark:text-[#ff7b7b]";
const orange = "text-[#c84227] dark:text-[#ff8a65]";
const purple = "text-[#dc2626] dark:text-[#ff7b7b]";

const STATUS = {
  PENDING: { label: "Pending", cls: gray },
  WAITING_FOR_VIDEO: { label: "Waiting for video", cls: blue },
  VIDEO_SUBMITTED: { label: "Under verification", cls: amber },
  VERIFIED: { label: "Ready for Delivery", cls: green },
  READY_FOR_DELIVERY: { label: "Ready for Delivery", cls: green },
  "Ready for Delivery": { label: "Ready for Delivery", cls: green },
  REJECTED: { label: "Rejected", cls: red },
  REUPLOAD_REQUESTED: { label: "Reupload requested", cls: orange },
  RESCHEDULED: { label: "Rescheduled for Delivery", cls: amber },
  Rescheduled: { label: "Rescheduled for Delivery", cls: amber },
  "Rescheduled for Delivery": { label: "Rescheduled for Delivery", cls: amber },
  RTH_PENDING: { label: "Return to Hub", cls: red },
  "Return to Hub – Pending Confirmation": { label: "Return to Hub", cls: red },
  "Return to Hub - Pending Confirmation": { label: "Return to Hub", cls: red },
  RTH_CONFIRMED: { label: "Return to Hub – Confirmed", cls: red },
  "Return to Hub – Confirmed": { label: "Return to Hub – Confirmed", cls: red },
  "Return to Hub - Confirmed": { label: "Return to Hub – Confirmed", cls: red },
  RETURN_TO_HUB: { label: "Return to Hub", cls: red },
  "Return to Hub": { label: "Return to Hub", cls: red },
  DELIVERY_HOLD: { label: "Delivery Hold", cls: amber },
  "Delivery Hold": { label: "Delivery Hold", cls: amber },
  DELIVERED: { label: "Delivered", cls: green },
  Delivered: { label: "Delivered", cls: green },
  FAILED: { label: "Failed Delivery", cls: red },
  "Failed Delivery": { label: "Failed Delivery", cls: red },
};

// Delivery label na ginagamit ng Parcels page AT ng Dashboard cards
export function getParcelStatus(parcel) {
  if (!parcel) return "In Transit";
  const status = String(parcel.delivery_status || "").toLowerCase();
  const parcelStatus = String(parcel.status || "").toLowerCase();
  const rthStatus = String(parcel.rth_status || "").toUpperCase();

  if (
    rthStatus === "CONFIRMED" ||
    parcelStatus === "rth_confirmed" ||
    parcelStatus === "return to hub – confirmed" ||
    parcelStatus === "return to hub - confirmed"
  ) {
    return "Return to Hub – Confirmed";
  }
  if (
    rthStatus === "PENDING" ||
    rthStatus === "PENDING_CONFIRMATION" ||
    parcelStatus === "return_to_hub" ||
    parcelStatus === "return to hub" ||
    parcelStatus === "rth_pending" ||
    parcelStatus === "return to hub – pending confirmation" ||
    parcelStatus === "return to hub - pending confirmation" ||
    parcel.returnToHub ||
    status === "return_to_hub" ||
    status === "return to hub"
  ) {
    return "Return to Hub";
  }

  if (parcel.delivery_hold) {
    return "Delivery Hold";
  }
  if (
    parcel.returnToHub ||
    status === "return_to_hub" ||
    status === "return to hub" ||
    parcelStatus === "return_to_hub" ||
    parcelStatus === "return to hub"
  ) {
    return "Return to Hub";
  }
  if (parcel.delivered_at || status === "delivered" || parcelStatus === "delivered") {
    return "Delivered";
  }
  if (status === "failed" || status === "failed delivery" || parcelStatus === "failed" || parcelStatus === "failed delivery") {
    return "Failed Delivery";
  }
  if (parcel.rescheduled || status === "rescheduled" || parcelStatus === "rescheduled" || parcelStatus === "rescheduled for delivery") {
    return "Rescheduled for Delivery";
  }
  if (parcel.verification_status === "VERIFIED" || parcelStatus === "verified" || parcelStatus === "ready for delivery") {
    return "Ready for Delivery";
  }
  return "In Transit";
}

export const statusInfo = (status) => STATUS[status] || { label: status || "Unknown", cls: gray };
