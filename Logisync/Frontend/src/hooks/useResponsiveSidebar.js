import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_MAX = 820;
const MEDIUM_MAX = 1199;

function getViewportTier() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= MOBILE_MAX) return "mobile";
  if (w <= MEDIUM_MAX) return "medium";
  return "desktop";
}

/**
 * Shared responsive sidebar state across Seller, Coordinator, and Rider portals:
 * - >= 1200px (large desktop): expanded sidebar by default
 * - 821px..1199px (medium screens / smaller laptops): auto-collapsed icon-only sidebar
 * - <= 820px (mobile / small tablets): hamburger-triggered overlay drawer
 */
export default function useResponsiveSidebar() {
  const initialTier = getViewportTier();
  const prevTierRef = useRef(initialTier);
  const [collapsed, setCollapsed] = useState(initialTier === "medium");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const syncTier = () => {
      const nextTier = getViewportTier();
      const prevTier = prevTierRef.current;
      if (nextTier === prevTier) return;
      prevTierRef.current = nextTier;

      setMobileOpen(false);
      if (nextTier === "medium") setCollapsed(true);
      else if (nextTier === "desktop") setCollapsed(false);
    };

    window.addEventListener("resize", syncTier, { passive: true });
    return () => window.removeEventListener("resize", syncTier);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const toggleSidebar = useCallback(() => {
    setMobileOpen((v) => !v);
  }, []);

  return { collapsed, mobileOpen, closeMobile, toggleSidebar, setMobileOpen };
}

