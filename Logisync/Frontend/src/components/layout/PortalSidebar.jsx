import { useState } from "react";
import { NavLink } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import UserAvatar from "../Avatar.jsx";
import { toggleDark, usePrefs } from "../../store/prefs.js";
import { useProfile } from "../../store/profile.js";
import { ROLE_LABEL, TOP_LINKS, navFor, toPath } from "./navConfig.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";
import { useSidebarTooltip } from "./SidebarTooltip.jsx";

const TOP_ICONS = {
  about: "fa-circle-info",
  contact: "fa-envelope",
  help: "fa-circle-question",
};

// Sidebar for Seller and Rider portals, matching Coordinator's responsive behavior:
// full expanded on large desktop, icon-only on medium screens/laptops, overlay drawer on mobile.
export default function PortalSidebar({ role, collapsed, mobileOpen, onClose }) {
  const { dark } = usePrefs();
  const profile = useProfile();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { tipProps, Tooltip } = useSidebarTooltip(collapsed);

  const navClass = ({ isActive }) =>
    `relative flex items-center gap-[13px] rounded-[10px] px-3.5 py-[11px] text-[14px] transition ${
      isActive
        ? "bg-white text-brand font-bold shadow-sm"
        : "text-white/95 hover:bg-white hover:text-brand hover:font-semibold"
    }`;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/30 backdrop-blur-[1px] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex h-[100dvh] w-[276px] max-w-[85vw] shrink-0 flex-col overflow-y-auto border-r border-brand-dark bg-brand px-4 py-4 text-white shadow-2xl transition-transform duration-200 dark:border-[#9a3412] dark:bg-brand-dark print:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-3.5 border-b border-white/20 px-1 pb-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
              <span className="inline-flex rounded-lg bg-white px-2 py-1 shadow-xs">
                <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-4 w-auto shrink-0 object-contain" />
              </span>
              <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/95">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-brand min-[821px]:hidden"
              >
                <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-xs`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                title="Close sidebar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-brand"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 min-[821px]:hidden">
            <UserAvatar className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[13px] leading-tight text-white">
                {profile.name}
              </strong>
              <small className="mt-0.5 block truncate text-[11px] text-white/80">
                {profile.email || profile.role}
              </small>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
          {navFor(role).map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <>
                  <div className="mx-3 my-2 border-t border-white/20 first:hidden max-[820px]:hidden" />
                  <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">{g.title}</p>
                </>
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">{g.title}</p>
              )}
              {g.links.map((l) => (
                <NavLink
                  key={l.path}
                  to={toPath(role, l.path)}
                  end={l.path === ""}
                  onClick={onClose}
                  className={navClass}
                  title={l.label}
                  aria-label={l.label}
                  {...tipProps(l.label)}
                >
                  <i className={`fa-solid ${l.icon} w-5 text-center`} />
                  <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{l.label}</span>
                  {l.soon && (
                    <span className={`rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#aaa] dark:bg-night-head ${collapsed ? "min-[821px]:hidden" : ""}`}>Soon</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Mobile/Tablet Info Links (hidden from top header on screens < 960px) */}
          <div className="mb-2 min-[960px]:hidden">
            {collapsed ? (
              <>
                <div className="mx-3 my-2 border-t border-white/20 max-[820px]:hidden" />
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">
                  Information
                </p>
              </>
            ) : (
              <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">
                Information
              </p>
            )}
            {TOP_LINKS.map((l) => (
              <NavLink
                key={l.path}
                to={toPath(role, l.path)}
                onClick={onClose}
                className={navClass}
                title={l.label}
                aria-label={l.label}
                {...tipProps(l.label)}
              >
                <i className={`fa-solid ${TOP_ICONS[l.path] || "fa-circle-info"} w-5 text-center`} />
                <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{l.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mt-auto pt-3 border-t border-white/20">
          <NavLink
            to={toPath(role, "settings")}
            onClick={onClose}
            className={navClass}
            title="Settings"
            aria-label="Settings"
            {...tipProps("Settings")}
          >
            <i className="fa-solid fa-gear w-5 text-center" />
            <span className={collapsed ? "min-[821px]:hidden" : ""}>Settings</span>
          </NavLink>
          <button
            onClick={() => {
              onClose?.();
              setLogoutOpen(true);
            }}
            title="Logout"
            aria-label="Logout"
            {...tipProps("Logout")}
            className="w-full flex items-center gap-[13px] rounded-[10px] px-3.5 py-[11px] text-[14px] text-white/95 transition hover:bg-white hover:text-brand hover:font-semibold"
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      {Tooltip}
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
