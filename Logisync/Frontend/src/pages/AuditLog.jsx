import Topbar from "../components/Topbar.jsx";
import AuditTable from "../components/audit/AuditTable.jsx";

// Audit Log ng coordinator: LAHAT ng aksyon ng lahat ng role (galing sa backend).
export default function AuditLog() {
  return (
    <>
      <Topbar title="Activity Log" subtitle="Click any activity to open the related section of the system." />
      <AuditTable note="As coordinator, you can see everyone's activity." />
    </>
  );
}
