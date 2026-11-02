import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import SiteHeader from "./SiteHeader.jsx";
import Footer from "./Footer.jsx";
import Toaster from "./Toaster.jsx";
import MobileBottomNav from "./layout/MobileBottomNav.jsx";

// Keyboard shortcuts: "g" tapos d/p/r/v/m/n  ·  "?" = Help
const go = { d: "/dashboard", p: "/parcels", r: "/parcels?report=1", v: "/verification", m: "/messages", n: "/notifications" };

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gPressed = useRef(0);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        setMobileOpen(false);
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
  }, [navigate]);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 800px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader onToggleSidebar={toggleSidebar} />
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main
        className={`flex min-h-screen flex-col pt-[88px] px-[35px] pb-6 transition-[margin] duration-200 max-[800px]:ml-0 max-[800px]:px-4 max-[800px]:pt-[76px] max-[800px]:pb-24 print:ml-0 print:pt-0 ${
          collapsed ? "ml-[78px]" : "ml-[250px]"
        }`}
      >
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>
      <MobileBottomNav role="coordinator" mobileOpen={mobileOpen} onToggleMenu={() => setMobileOpen((v) => !v)} />
      <Toaster />
    </div>
  );
}
