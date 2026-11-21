import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRole } from "../../api.js";
import { listContacts } from "../../services/messageService.js";
import CallUserModal from "../messaging/CallUserModal.jsx";

/**
 * Mobile-only floating Call button for Rider account.
 * Allows Riders to quickly call their Hub Coordinator via the device's native dialer.
 *
 * Rules:
 * - Appears ONLY for logged-in Riders (role === "rider").
 * - Appears ONLY on mobile screens (hidden on tablet and desktop via `md:hidden`).
 * - Fixed near bottom-left corner, positioned above MobileBottomNav without overlapping.
 * - Reuses CallUserModal for phone number display and sanitized `tel:` dialer link.
 */
export default function RiderFloatingCallButton() {
  const role = getRole();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [coordinators, setCoordinators] = useState([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [loading, setLoading] = useState(false);

  const hideOnCleanScreens =
    pathname.startsWith("/rider/profile") ||
    pathname.startsWith("/rider/settings") ||
    pathname.startsWith("/rider/analytics");

  // Pre-load coordinator contact info on mount
  useEffect(() => {
    if (role !== "rider") return;
    let active = true;
    listContacts()
      .then((contacts) => {
        if (!active) return;
        const coords = (contacts || []).filter((c) => c.role === "coordinator");
        setCoordinators(coords);
        if (coords.length > 0) {
          setSelectedCoordinator(coords[0]);
        }
      })
      .catch((err) => {
        console.warn("Failed to prefetch coordinator contact:", err);
      });

    return () => {
      active = false;
    };
  }, [role]);

  // Strictly enforce Rider role & keep redesigned Home/Profile/Settings unobstructed
  if (role !== "rider" || hideOnCleanScreens) {
    return null;
  }

  const handleClick = async () => {
    if (coordinators.length === 0) {
      setLoading(true);
      try {
        const contacts = await listContacts();
        const coords = (contacts || []).filter((c) => c.role === "coordinator");
        setCoordinators(coords);
        if (coords.length > 0) {
          setSelectedCoordinator(coords[0]);
        }
      } catch (err) {
        console.warn("Failed to fetch coordinator contacts on click:", err);
      } finally {
        setLoading(false);
      }
    }
    setOpen(true);
  };

  return (
    <>
      {/* Mobile-only floating call icon button (bottom-right) */}
      <button
        type="button"
        onClick={handleClick}
        aria-label="Call Coordinator"
        title="Call Coordinator"
        className="fixed bottom-[82px] right-4 z-30 min-[821px]:hidden flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_rgba(238,77,45,0.42)] ring-2 ring-white/80 transition-all active:scale-95 hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:ring-night-panel dark:focus:ring-offset-night-bg print:hidden"
      >
        <i className="fa-solid fa-phone text-[18px]" />
      </button>

      {/* Call Coordinator Modal */}
      {open && (
        <CallUserModal
          active={selectedCoordinator}
          coordinators={coordinators}
          onSelectCoordinator={setSelectedCoordinator}
          onClose={() => setOpen(false)}
          title={selectedCoordinator ? `Call ${selectedCoordinator.name}` : "Call Coordinator"}
          subtitle="Hub Coordinator"
        />
      )}
    </>
  );
}
