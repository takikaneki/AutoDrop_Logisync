import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../Footer.jsx";
import Toaster from "../Toaster.jsx";
import PortalHeader from "./PortalHeader.jsx";
import GlobalBanner from "./GlobalBanner.jsx";
import PortalSidebar from "./PortalSidebar.jsx";
import MobileBottomNav from "./MobileBottomNav.jsx";

// Iisang layout para sa Seller at Rider, kapareho ng AppLayout ng Coordinator.
// role = "seller" | "rider". Ang laman ng page ay lumalabas sa <Outlet />.
export default function DashboardLayout({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  // Sa maliit na screen, ang menu button ay nagbubukas ng sidebar; sa malaki ay nagko-collapse ito
  const toggle = () => {
    if (window.matchMedia("(max-width: 800px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  return (
    <div className="min-h-screen">
      <GlobalBanner role={role} />
      <PortalHeader role={role} onToggleSidebar={toggle} />
      <div className="flex items-start">
        <PortalSidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex min-h-[calc(100vh-56px)] min-w-0 flex-1 flex-col px-[35px] pt-6 pb-6 max-[800px]:px-4 max-[800px]:pt-5 max-[800px]:pb-24 print:p-0">
          <div className="flex-1">
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
