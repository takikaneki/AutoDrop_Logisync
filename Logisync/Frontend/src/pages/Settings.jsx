import Topbar from "../components/Topbar.jsx";
import UnifiedSettings from "../components/settings/UnifiedSettings.jsx";
import RiderMobileSettings from "../components/settings/RiderMobileSettings.jsx";

export default function Settings() {
  return (
    <>
      {/* Desktop / Laptop Coordinator Settings (100% unchanged) */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Settings" />
        <UnifiedSettings />
      </div>
      {/* Coordinator Mobile Settings (max-[820px] ONLY) */}
      <div className="min-[821px]:hidden">
        <RiderMobileSettings role="coordinator" />
      </div>
    </>
  );
}
