import { statusInfo } from "../utils/parcelStatus.js";

// Kulay na label ng status ng parcel. Parehong hugis ng StatusBadge ng Coordinator.
export default function StatusBadge({ status }) {
  const { label, cls } = statusInfo(status);
  return <span className={`inline-flex items-center text-[12px] font-bold leading-snug ${cls}`}>{label}</span>;
}
