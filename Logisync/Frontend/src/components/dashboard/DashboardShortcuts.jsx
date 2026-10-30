import { Link } from "react-router-dom";
import { btnGhost, btnPrimary } from "../styles.js";

// Mga shortcut sa itaas-kanan ng summary cards. Iisang component para pare-pareho ang puwesto sa
// dashboard ng Coordinator, Seller at Rider. (Ang Scan Parcel at Generate Report ay may kani-kaniyang destinasyon bawat role.)
// Seller: "Create Parcel" ang unang shortcut (ang pag-scan ng QR ay nasa loob na ng Create Parcel).
const TARGETS = {
  coordinator: { scan: "/verification?scan=1", report: "/reports" },
  seller: { scan: "/seller/create", label: "Create Parcel", icon: "fa-square-plus", report: "/seller/parcels?report=1" },
  rider: { scan: "/rider/scan", report: "/rider/reports" },
};

export default function DashboardShortcuts({ role }) {
  const t = TARGETS[role];
  return (
    <div className="mb-4 flex flex-wrap justify-end gap-2.5" aria-label="Shortcuts">
      <Link to={t.scan} className={btnPrimary}>
        <i className={`fa-solid ${t.icon || "fa-qrcode"}`} /> {t.label || "Scan Parcel"}
      </Link>
      <Link to={t.report} className={btnGhost}>
        <i className="fa-solid fa-file-lines" /> Generate Report
      </Link>
    </div>
  );
}
