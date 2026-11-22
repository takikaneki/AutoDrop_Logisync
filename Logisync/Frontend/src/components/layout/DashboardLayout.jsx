import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Footer from "../Footer.jsx";
import Toaster from "../Toaster.jsx";
import PortalHeader from "./PortalHeader.jsx";
import PortalSidebar from "./PortalSidebar.jsx";
import MobileBottomNav from "./MobileBottomNav.jsx";
import useResponsiveSidebar from "../../hooks/useResponsiveSidebar.js";
import { riderTypeOf, toPath } from "./navConfig.js";
import { syncRiderDeliveriesWithServer } from "../../store/riderDeliveries.js";
import RiderFloatingCallButton from "../rider/RiderFloatingCallButton.jsx";
import { syncPrefsFromServer } from "../../store/prefs.js";
import { syncProfileFromServer } from "../../store/profile.js";

// Shared responsive layout shell for Seller and Rider portals.
// role = "seller" | "rider". Page content renders inside <Outlet />.
export default function DashboardLayout({ role }) {
  const { collapsed, mobileOpen, closeMobile, closeDesktop, toggleSidebar } = useResponsiveSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gPressed = useRef(0);

  useEffect(() => {
    syncPrefsFromServer();
    syncProfileFromServer();
  }, []);

  useEffect(() => {
    closeMobile();
    window.scrollTo(0, 0);
    if (role === "rider") {
      syncRiderDeliveriesWithServer();
    }
  }, [pathname, role, closeMobile]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        closeMobile();
        return;
      }
      if (e.key === "?") return navigate(toPath(role, "help"));
      if (e.key === "g") {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current >= 1200) return;

      const isLmRider = role === "rider" && riderTypeOf() !== "FM";
      const go = {
        d: toPath(role, ""),
        a: toPath(role, "activity"),
        m: toPath(role, "messages"),
        n: toPath(role, "notifications"),
        s: toPath(role, "settings"),
        ...(role === "seller"
          ? { p: toPath(role, "parcels"), c: toPath(role, "create"), v: toPath(role, "scan") }
          : isLmRider
            ? { p: toPath(role, "parcels"), v: toPath(role, "scan"), l: toPath(role, "deliveries") }
            : {}),
      };
      if (go[e.key]) {
        gPressed.current = 0;
        navigate(go[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, role, closeMobile]);

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

  const isRider = role === "rider";
  const isSeller = role === "seller";
  const isEdgeMobile =
    (isRider &&
      (pathname.startsWith("/rider/profile") ||
        pathname.startsWith("/rider/settings") ||
        pathname.startsWith("/rider/analytics"))) ||
    (isSeller &&
      (pathname.startsWith("/seller/profile") ||
        pathname.startsWith("/seller/settings") ||
        pathname.startsWith("/seller/analytics")));

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-x-clip">
      <PortalSidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} onClose={closeMobile} onCloseDesktop={closeDesktop} onToggleSidebar={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader role={role} collapsed={collapsed} mobileOpen={mobileOpen} onToggleSidebar={toggleSidebar} />
        <main
          className={`flex min-w-0 max-w-full flex-1 flex-col overflow-x-clip px-[35px] pt-6 pb-6 max-[1280px]:px-6 max-[1024px]:px-5 print:p-0 ${
            isEdgeMobile
              ? "max-[820px]:px-0 max-[820px]:pt-0 max-[820px]:pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
              : "max-[820px]:px-3.5 max-[820px]:pt-3.5 max-[820px]:pb-[calc(5.75rem+env(safe-area-inset-bottom))] max-[380px]:px-2.5"
          }`}
        >
          <div
            className={`min-h-[calc(100vh-80px)] min-w-0 flex-1 ${
              isEdgeMobile
                ? "pb-10 max-[820px]:min-h-[calc(100dvh-124px)] max-[820px]:pb-0"
                : "pb-10 max-[820px]:min-h-[calc(100dvh-136px)] max-[820px]:pb-6"
            }`}
          >
            <Outlet />
          </div>
          <div className="max-[820px]:hidden">
            <Footer />
          </div>
        </main>
      </div>
      <MobileBottomNav role={role} mobileOpen={mobileOpen} onToggleMenu={toggleSidebar} />
      {role === "rider" && <RiderFloatingCallButton />}
      <Toaster />
    </div>
  );
}
