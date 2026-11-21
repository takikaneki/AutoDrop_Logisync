import Topbar from "../../components/Topbar.jsx";
import UnifiedSettings from "../../components/settings/UnifiedSettings.jsx";
import RiderMobileSettings from "../../components/settings/RiderMobileSettings.jsx";
import { getRole } from "../../api.js";

export default function SettingsPage() {
  const isRider = getRole() === "rider";

  if (isRider) {
    return (
      <>
        {/* Desktop / Laptop Rider Settings (100% unchanged) */}
        <div className="hidden min-[821px]:block">
          <Topbar title="Settings" />
          <UnifiedSettings />
        </div>
        {/* Rider Mobile Settings Redesign (max-[820px] ONLY) */}
        <div className="min-[821px]:hidden">
          <RiderMobileSettings />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Settings" />
      <UnifiedSettings />
    </>
  );
}
