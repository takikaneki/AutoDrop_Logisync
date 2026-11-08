import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../Footer.jsx";
import Toaster from "../Toaster.jsx";
import PortalHeader from "./PortalHeader.jsx";
import PortalSidebar from "./PortalSidebar.jsx";
import MobileBottomNav from "./MobileBottomNav.jsx";
import { syncRiderDeliveriesWithServer } from "../../store/riderDeliveries.js";

// Iisang layout para sa Seller at Rider, kapareho ng AppLayout ng Coordinator.
// role = "seller" | "rider". Ang laman ng page ay lumalabas sa <Outlet />.
export default function DashboardLayout({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
    if (role === "rider") {
      syncRiderDeliveriesWithServer();
    }
  }, [pathname, role]);

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

  // Sa maliit na screen, ang menu button ay nagbubukas ng sidebar; sa malaki ay nagko-collapse ito
  const toggle = () => {
    if (window.matchMedia("(max-width: 820px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden">
      <PortalHeader role={role} onToggleSidebar={toggle} />
      <div className="flex items-start max-w-full">
        <PortalSidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex min-h-[calc(100vh-56px)] min-w-0 max-w-full flex-1 flex-col overflow-x-hidden px-[35px] pt-6 pb-6 max-[1280px]:px-6 max-[1024px]:px-5 max-[820px]:min-h-0 max-[820px]:px-3.5 max-[820px]:pt-3.5 max-[820px]:pb-24 max-[380px]:px-2.5 print:p-0">
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
      <MobileBottomNav role={role} mobileOpen={mobileOpen} onToggleMenu={() => setMobileOpen((v) => !v)} />
      <Toaster />
    </div>
  );
}
