import { NavLink, useLocation } from "react-router-dom";
import { useT } from "../../store/prefs.js";

const ITEMS = {
  coordinator: [
    { to: "/dashboard", end: true, icon: "fa-chart-pie", label: "Home" },
    { to: "/parcels", icon: "fa-box-open", label: "Parcels" },
    { to: "/verification", icon: "fa-circle-check", label: "Verify" },
    { to: "/messages", icon: "fa-comments", label: "Messages" },
  ],
  seller: [
    { to: "/seller", end: true, icon: "fa-chart-pie", label: "Home" },
    { to: "/seller/parcels", icon: "fa-box-open", label: "Parcels" },
    { to: "/seller/create", icon: "fa-square-plus", label: "Create" },
    { to: "/seller/scan", icon: "fa-qrcode", label: "Scan/Video" },
  ],
};

const RIDER_MOBILE_ITEMS = [
  { to: "/rider", end: true, icon: "fa-house", label: "Home" },
  { to: "/rider/deliveries", icon: "fa-box", label: "My Deliveries" },
  { to: "/rider/scan", icon: "fa-qrcode", label: "Scan QR", featured: true },
  { to: "/rider/messages", icon: "fa-comment-dots", label: "Messages" },
  { to: "/rider/profile", icon: "fa-user", label: "Profile" },
];

export default function MobileBottomNav({ role = "coordinator", mobileOpen, onToggleMenu }) {
  const t = useT();
  const { pathname } = useLocation();

  // Dedicated 5-item mobile bottom navigation for Rider Portal (no Menu tab)
  if (role === "rider") {
    const isProfileSection =
      pathname.startsWith("/rider/profile") ||
      pathname.startsWith("/rider/settings") ||
      pathname.startsWith("/rider/analytics") ||
      pathname.startsWith("/rider/complaints") ||
      pathname.startsWith("/rider/help");

    return (
      <nav
        aria-label="Rider mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 hidden max-[820px]:block border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-6px_24px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)] print:hidden dark:border-night-line dark:bg-night-panel/95"
      >
        <div className="grid h-[64px] grid-cols-5 items-end px-1 pb-1.5">
          {RIDER_MOBILE_ITEMS.map((item) => {
            if (item.featured) {
              const active = pathname.startsWith("/rider/scan");
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className="group relative flex flex-col items-center justify-end gap-1 pb-0.5 text-[10px] font-bold transition"
                >
                  <span
                    className={`-mt-6 flex h-[48px] w-[48px] items-center justify-center rounded-full shadow-[0_8px_20px_rgba(15,23,42,0.28)] ring-4 ring-white transition-transform active:scale-95 dark:ring-night-panel ${
                      active
                        ? "bg-brand text-white"
                        : "bg-[#0f172a] text-white group-hover:bg-[#1e293b] dark:bg-brand"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
                      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
                      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                    </svg>
                  </span>
                  <span
                    className={`whitespace-nowrap leading-none tracking-tight ${
                      active ? "text-brand" : "text-[#0f172a] dark:text-[#f1eeeb]"
                    }`}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => {
                  const active = item.to === "/rider/profile" ? isActive || isProfileSection : isActive;
                  return `flex h-full flex-col items-center justify-end gap-1 rounded-xl pb-0.5 pt-2 text-[10px] font-semibold transition ${
                    active
                      ? "text-brand font-bold"
                      : "text-slate-500 hover:text-brand dark:text-[#b8b0a8]"
                  }`;
                }}
              >
                {({ isActive }) => {
                  const active = item.to === "/rider/profile" ? isActive || isProfileSection : isActive;
                  return (
                    <>
                      <span
                        className={`flex h-7 w-10 items-center justify-center rounded-full transition ${
                          active ? "bg-brand/12 text-brand" : ""
                        }`}
                      >
                        <i className={`fa-solid ${item.icon} text-[16px]`} />
                      </span>
                      <span className="max-w-full whitespace-nowrap px-0.5 leading-none tracking-tight">
                        {item.label}
                      </span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </div>
      </nav>
    );
  }

  // Coordinator and Seller mobile navigation (unchanged)
  const links = ITEMS[role] || ITEMS.coordinator;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 hidden max-[820px]:grid grid-cols-5 h-16 bg-white/95 backdrop-blur-md border-t border-[#eaeaea] px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden dark:bg-night-panel/95 dark:border-night-line"
    >
      {links.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 rounded-xl mx-0.5 my-1 text-[11px] font-semibold transition ${
              isActive && !mobileOpen
                ? "text-brand bg-brand-soft/70 dark:bg-night-line"
                : "text-[#666] hover:text-brand dark:text-[#d1c9c2]"
            }`
          }
        >
          <i className={`fa-solid ${item.icon} text-[16px]`} />
          <span className="truncate max-w-full px-1 leading-none">{t(item.label)}</span>
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={mobileOpen}
        aria-label="Open menu"
        className={`flex flex-col items-center justify-center gap-1 rounded-xl mx-0.5 my-1 text-[11px] font-semibold transition ${
          mobileOpen
            ? "text-brand bg-brand-soft/70 dark:bg-night-line"
            : "text-[#666] hover:text-brand dark:text-[#d1c9c2]"
        }`}
      >
        <i className={`fa-solid ${mobileOpen ? "fa-xmark" : "fa-bars"} text-[16px]`} />
        <span className="truncate max-w-full px-1 leading-none">Menu</span>
      </button>
    </nav>
  );
}
