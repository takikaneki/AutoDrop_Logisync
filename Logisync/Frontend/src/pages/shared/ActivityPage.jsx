import Topbar from "../../components/Topbar.jsx";
import AuditTable from "../../components/audit/AuditTable.jsx";
import { getRole } from "../../api.js";

// Activity Log ng Seller at Rider: ang makikita lang ay ang sariling ginawa at ang mga nangyari sa sarili nilang parcel.
export default function ActivityPage() {
  const role = getRole();
  const note =
    role === "seller"
      ? "You only see your own actions and what happened to your own parcels."
      : "You only see your own actions and what happened to parcels you scanned.";
  return (
    <>
      <Topbar title="Activity Log" subtitle="A record of your actions and updates on your parcels." />
      <AuditTable note={note} />
    </>
  );
}
