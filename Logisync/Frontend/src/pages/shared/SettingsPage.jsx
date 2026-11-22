import Topbar from "../../components/Topbar.jsx";
import UnifiedSettings from "../../components/settings/UnifiedSettings.jsx";
import RiderMobileSettings from "../../components/settings/RiderMobileSettings.jsx";
import { getRole } from "../../api.js";

export default function SettingsPage() {
  const role = getRole() === "seller" ? "seller" : "rider";

  return (
    <>
      {/* Desktop / Laptop Portal Settings (100% unchanged) */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Settings" />
        <UnifiedSettings />
      </div>
      {/* Rider & Seller Mobile Settings (max-[820px] ONLY) */}
      <div className="min-[821px]:hidden">
        <RiderMobileSettings role={role} />
      </div>
    </>
  );
}
