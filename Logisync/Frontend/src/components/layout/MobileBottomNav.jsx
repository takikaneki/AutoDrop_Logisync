import { NavLink } from "react-router-dom";
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
  rider: [
    { to: "/rider", end: true, icon: "fa-chart-pie", label: "Home" },
    { to: "/rider/deliveries", icon: "fa-truck-fast", label: "Deliveries" },
    { to: "/rider/scan", icon: "fa-qrcode", label: "Scan QR" },
    { to: "/rider/parcels", icon: "fa-boxes-stacked", label: "Parcels" },
  ],
};

export default function MobileBottomNav({ role = "coordinator", mobileOpen, onToggleMenu }) {
  const t = useT();
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

