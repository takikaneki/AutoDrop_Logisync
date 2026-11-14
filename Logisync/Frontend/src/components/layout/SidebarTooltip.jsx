import { useCallback, useEffect, useState } from "react";

/**
 * Floating tooltip controller for icon-only collapsed sidebars.
 * Renders with position:fixed so scrollable <aside> containers never clip labels.
 */
export function useSidebarTooltip(collapsed) {
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!collapsed) setTip(null);
  }, [collapsed]);

  useEffect(() => {
    if (!tip) return undefined;
    const clear = () => setTip(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, [tip]);

  const tipProps = useCallback(
    (label) => {
      if (!collapsed || !label) return {};
      const show = (el) => {
        if (!el || window.innerWidth <= 820) return;
        const rect = el.getBoundingClientRect();
        setTip({
          label,
          left: rect.right + 10,
          top: rect.top + rect.height / 2,
        });
      };
      return {
        onMouseEnter: (e) => show(e.currentTarget),
        onMouseLeave: () => setTip(null),
        onFocus: (e) => show(e.currentTarget),
        onBlur: () => setTip(null),
      };
    },
    [collapsed]
  );

  const Tooltip = tip && collapsed ? (
    <div
      role="tooltip"
      style={{ left: `${tip.left}px`, top: `${tip.top}px` }}
      className="pointer-events-none fixed z-[120] -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#27364f] px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg max-[820px]:hidden dark:border dark:border-night-line dark:bg-night-head"
    >
      {tip.label}
    </div>
  ) : null;

  return { tipProps, Tooltip };
}

