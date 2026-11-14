import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import SiteHeader from "./SiteHeader.jsx";
import Footer from "./Footer.jsx";
import Toaster from "./Toaster.jsx";
import MobileBottomNav from "./layout/MobileBottomNav.jsx";
import useResponsiveSidebar from "../hooks/useResponsiveSidebar.js";

// Keyboard shortcuts: "g" tapos d/p/r/v/m/n  ·  "?" = Help
const go = { d: "/dashboard", p: "/parcels", r: "/parcels?report=1", v: "/verification", m: "/messages", n: "/notifications" };

export default function AppLayout() {
  const { collapsed, mobileOpen, closeMobile, toggleSidebar } = useResponsiveSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gPressed = useRef(0);

  useEffect(() => {
    closeMobile();
    window.scrollTo(0, 0);
  }, [pathname, closeMobile]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        closeMobile();
        return;
      }
      if (e.key === "?") return navigate("/help");
      if (e.key === "g") {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current < 1200 && go[e.key]) {
        gPressed.current = 0;
        navigate(go[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, closeMobile]);

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-clip">
      <SiteHeader collapsed={collapsed} mobileOpen={mobileOpen} onToggleSidebar={toggleSidebar} />
      <div className="flex items-stretch max-w-full">
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={closeMobile} />
        <main className="flex min-h-[calc(100vh-56px)] min-w-0 max-w-full flex-1 flex-col overflow-x-clip px-[35px] pt-6 pb-6 max-[1280px]:px-6 max-[1024px]:px-5 max-[820px]:min-h-0 max-[820px]:px-3.5 max-[820px]:pt-3.5 max-[820px]:pb-24 max-[380px]:px-2.5 print:p-0">
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
      <MobileBottomNav role="coordinator" mobileOpen={mobileOpen} onToggleMenu={toggleSidebar} />
      <Toaster />
    </div>
  );
}
