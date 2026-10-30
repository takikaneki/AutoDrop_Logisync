import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../Footer.jsx";
import Toaster from "../Toaster.jsx";
import PortalHeader from "./PortalHeader.jsx";
import PortalSidebar from "./PortalSidebar.jsx";

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
      <PortalHeader role={role} onToggleSidebar={toggle} />
      <PortalSidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main
        className={`flex min-h-screen flex-col pt-[94px] px-[35px] pb-4 transition-[margin] duration-200 max-[800px]:px-5 max-[800px]:ml-0 print:ml-0 print:pt-0 ${
          collapsed ? "ml-[78px]" : "ml-[250px]"
        }`}
      >
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>
      <Toaster />
    </div>
  );
}
