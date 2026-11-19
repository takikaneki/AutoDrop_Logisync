import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [coordinators, setCoordinators] = useState([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [loading, setLoading] = useState(false);

  // Strictly enforce Rider role
  if (role !== "rider") {
    return null;
  }

  // Pre-load coordinator contact info on mount
  useEffect(() => {
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
  }, []);

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
      {/* Mobile-only floating call button (bottom-left) */}
      <button
        type="button"
        onClick={handleClick}
        aria-label="Call Coordinator"
        title="Call Coordinator"
        className="fixed bottom-20 left-4 z-40 md:hidden flex items-center gap-2 rounded-full bg-brand px-3.5 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,104,24,0.35)] transition-all active:scale-95 hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:focus:ring-offset-night-bg print:hidden"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
          <i className="fa-solid fa-phone text-[10px]" />
        </span>
        <span className="leading-none">Call Coordinator</span>
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
