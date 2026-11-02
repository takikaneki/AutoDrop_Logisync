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
  WAITING_FOR_VIDEO: { label: "Waiting for video", cls: amber },
  VIDEO_SUBMITTED: { label: "Under verification", cls: blue },
  VERIFIED: { label: "Verified", cls: green },
  REJECTED: { label: "Rejected", cls: red },
  REUPLOAD_REQUESTED: { label: "Reupload requested", cls: orange },
  RESCHEDULED: { label: "Rescheduled", cls: amber },
  Rescheduled: { label: "Rescheduled", cls: amber },
  RETURN_TO_HUB: { label: "Return to Hub", cls: purple },
  "Return to Hub": { label: "Return to Hub", cls: purple },
  RETURNED_TO_SELLER: { label: "Returned to Seller", cls: blue },
  "Returned to Seller": { label: "Returned to Seller", cls: blue },
  DELIVERED: { label: "Delivered", cls: green },
  Delivered: { label: "Delivered", cls: green },
  FAILED: { label: "Failed Delivery", cls: red },
  "Failed Delivery": { label: "Failed Delivery", cls: red },
};

// Delivery label na ginagamit ng Parcels page AT ng Dashboard cards, kaya laging tugma ang bilang
// ng card sa listahang bubukas kapag na-click: "Delivered" | "Return to Hub" | "Returned to Seller" | "Rescheduled" | "Failed Delivery" | "In Transit".
export function getParcelStatus(parcel) {
  if (!parcel) return "In Transit";
  const status = String(parcel.delivery_status || "").toLowerCase();
  const parcelStatus = String(parcel.status || "").toLowerCase();

  if (parcel.returnCoordinated || status === "returned_to_seller" || parcelStatus === "returned to seller") {
    return "Returned to Seller";
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
  if (parcel.rescheduled || status === "rescheduled" || parcelStatus === "rescheduled") {
    return "Rescheduled";
  }
  return "In Transit";
}

export const statusInfo = (status) => STATUS[status] || { label: status || "Unknown", cls: gray };
