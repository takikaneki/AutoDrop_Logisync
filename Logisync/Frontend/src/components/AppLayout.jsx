import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import SiteHeader from "./SiteHeader.jsx";
import Footer from "./Footer.jsx";
import Toaster from "./Toaster.jsx";
import NetworkStatusBanner from "./NetworkStatusBanner.jsx";
import MobileBottomNav from "./layout/MobileBottomNav.jsx";
import useResponsiveSidebar from "../hooks/useResponsiveSidebar.js";
import { syncPrefsFromServer } from "../store/prefs.js";
import { syncProfileFromServer } from "../store/profile.js";
import { syncAnnouncementsFromServer } from "../store/announcements.js";
import { syncCoordinatorNotificationsFromServer } from "../store/notifications.js";
import { useReconnectRefresh } from "../utils/network.js";

// Keyboard shortcuts: "g" tapos d/p/r/v/m/n/a/s  ·  "?" = Help
const go = {
  d: "/dashboard",
  p: "/parcels",
  r: "/parcels?report=1",
  v: "/verification",
  m: "/messages",
  n: "/notifications",
  a: "/audit",
  s: "/settings",
};

export default function AppLayout() {
  const { collapsed, mobileOpen, closeMobile, closeDesktop, toggleSidebar } = useResponsiveSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gPressed = useRef(0);

  useEffect(() => {
    syncPrefsFromServer();
    syncProfileFromServer();
    syncAnnouncementsFromServer();
  }, []);

  useReconnectRefresh(() => {
    syncPrefsFromServer();
    syncProfileFromServer();
    syncAnnouncementsFromServer();
    syncCoordinatorNotificationsFromServer();
  });

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

  const isEdgeMobile =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/analytics");

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-x-clip">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={closeMobile}
        onCloseDesktop={closeDesktop}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader collapsed={collapsed} mobileOpen={mobileOpen} onToggleSidebar={toggleSidebar} />
        <NetworkStatusBanner />
        <main
          className={`flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip px-7 pt-5 pb-6 max-[1280px]:px-5 max-[1024px]:px-4 max-[1024px]:pt-4 print:p-0 ${
            isEdgeMobile
              ? "max-[820px]:px-0 max-[820px]:pt-0 max-[820px]:pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
              : "max-[820px]:px-3.5 max-[820px]:pt-3.5 max-[820px]:pb-[calc(5.75rem+env(safe-area-inset-bottom))] max-[380px]:px-2.5"
          }`}
        >
          <div
            className={`mx-auto w-full max-w-[1440px] min-w-0 flex-1 ${
              isEdgeMobile
                ? "pb-8 max-[820px]:pb-0"
                : "pb-8 max-[820px]:pb-5"
            }`}
          >
            <Outlet />
          </div>
          <div className="mx-auto mt-auto w-full max-w-[1440px] max-[820px]:hidden">
            <Footer />
          </div>
        </main>
      </div>
      <MobileBottomNav role="coordinator" mobileOpen={mobileOpen} onToggleMenu={toggleSidebar} />
      <Toaster />
    </div>
  );
}
