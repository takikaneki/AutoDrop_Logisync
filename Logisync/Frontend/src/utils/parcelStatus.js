// Ang mga halaga sa kaliwa ay ang nakaimbak sa database (hindi natin binabago).
// Ang "label" ay ang madaling basahin na bersyon para sa user.
const gray = "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
const amber = "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
const blue = "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300";
const green = "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300";
const red = "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
const orange = "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300";
const purple = "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300";

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
  RTH_PENDING: { label: "Return to Hub – Pending Confirmation", cls: orange },
  "Return to Hub – Pending Confirmation": { label: "Return to Hub – Pending Confirmation", cls: orange },
  "Return to Hub - Pending Confirmation": { label: "Return to Hub – Pending Confirmation", cls: orange },
  RTH_CONFIRMED: { label: "Return to Hub – Confirmed", cls: purple },
  "Return to Hub – Confirmed": { label: "Return to Hub – Confirmed", cls: purple },
  "Return to Hub - Confirmed": { label: "Return to Hub – Confirmed", cls: purple },
  RETURN_TO_HUB: { label: "Return to Hub", cls: purple },
  "Return to Hub": { label: "Return to Hub", cls: purple },
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
    rthStatus === "PENDING_CONFIRMATION" ||
    parcelStatus === "rth_pending" ||
    parcelStatus === "return to hub – pending confirmation" ||
    parcelStatus === "return to hub - pending confirmation"
  ) {
    return "Return to Hub – Pending Confirmation";
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
