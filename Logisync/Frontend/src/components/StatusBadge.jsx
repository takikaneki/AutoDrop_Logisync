import { statusInfo } from "../utils/parcelStatus.js";

// Kulay na label ng status ng parcel. Parehong hugis ng StatusBadge ng Coordinator.
export default function StatusBadge({ status }) {
  const { label, cls } = statusInfo(status);
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
