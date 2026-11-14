import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../Footer.jsx";
import Toaster from "../Toaster.jsx";
import PortalHeader from "./PortalHeader.jsx";
import PortalSidebar from "./PortalSidebar.jsx";
import MobileBottomNav from "./MobileBottomNav.jsx";
import useResponsiveSidebar from "../../hooks/useResponsiveSidebar.js";
import { syncRiderDeliveriesWithServer } from "../../store/riderDeliveries.js";

// Shared responsive layout shell for Seller and Rider portals.
// role = "seller" | "rider". Page content renders inside <Outlet />.
export default function DashboardLayout({ role }) {
  const { collapsed, mobileOpen, closeMobile, closeDesktop, toggleSidebar } = useResponsiveSidebar();
  const { pathname } = useLocation();

  useEffect(() => {
    closeMobile();
    window.scrollTo(0, 0);
    if (role === "rider") {
      syncRiderDeliveriesWithServer();
    }
  }, [pathname, role, closeMobile]);

  useEffect(() => {
    if (role !== "rider") return;
    const onFocus = () => syncRiderDeliveriesWithServer();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(onFocus, 10000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [role]);

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-clip">
      <PortalHeader role={role} collapsed={collapsed} mobileOpen={mobileOpen} onToggleSidebar={toggleSidebar} />
      <div className="flex items-stretch max-w-full">
        <PortalSidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} onClose={closeMobile} onCloseDesktop={closeDesktop} />
        <main className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip px-[35px] pt-6 pb-6 max-[1280px]:px-6 max-[1024px]:px-5 max-[820px]:px-3.5 max-[820px]:pt-3.5 max-[820px]:pb-24 max-[380px]:px-2.5 print:p-0">
          <div className="min-h-[calc(100vh-80px)] max-[820px]:min-h-[calc(100dvh-136px)] min-w-0 flex-1 pb-10 max-[820px]:pb-6">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
      <MobileBottomNav role={role} mobileOpen={mobileOpen} onToggleMenu={toggleSidebar} />
      <Toaster />
    </div>
  );
}
