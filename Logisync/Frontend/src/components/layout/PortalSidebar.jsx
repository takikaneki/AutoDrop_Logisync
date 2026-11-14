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
    `relative flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] transition ${collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:px-3.5" : "px-3.5"
    } ${isActive
      ? "bg-brand-soft text-brand font-semibold dark:bg-night-line"
      : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
    }`;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-[1px] min-[821px]:hidden" onClick={onClose} aria-hidden="true" />}

      <div className="max-[820px]:contents min-[821px]:shrink-0 min-[821px]:bg-white min-[821px]:border-r min-[821px]:border-[#eee] print:hidden dark:min-[821px]:bg-night-panel dark:min-[821px]:border-night-line">
        <aside
          className={`flex shrink-0 flex-col overflow-y-auto bg-white py-4 z-40 transition-[width,transform] duration-200 dark:bg-night-panel min-[821px]:sticky min-[821px]:top-14 min-[821px]:h-[calc(100vh-56px)] max-[820px]:fixed max-[820px]:inset-y-0 max-[820px]:left-0 max-[820px]:z-[70] max-[820px]:h-[100dvh] max-[820px]:w-[288px] max-[820px]:max-w-[86vw] max-[820px]:border-r max-[820px]:border-[#eee] dark:max-[820px]:border-night-line max-[820px]:px-4 max-[820px]:pb-20 max-[820px]:shadow-2xl ${collapsed ? "min-[821px]:w-[78px] min-[821px]:px-2.5" : "min-[821px]:w-[224px] xl:w-[250px] min-[821px]:px-3.5 xl:px-[18px]"
            } ${mobileOpen ? "max-[820px]:translate-x-0" : "max-[820px]:-translate-x-full"}`}
        >
        <div className="mb-3.5 border-b border-[#f1f1f1] px-1 pb-3.5 min-[821px]:hidden dark:border-night-line">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
              <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-5 w-auto shrink-0 object-contain" />
              <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#666] transition hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
              >
                <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-xs`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#666] transition hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5 dark:border-night-line dark:bg-night-head">
            <UserAvatar className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[13px] leading-tight text-slate-800 dark:text-white">
                {profile.name}
              </strong>
              <small className="mt-0.5 block truncate text-[11px] text-[#888]">
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
                  <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line first:hidden max-[820px]:hidden" />
                  <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5] min-[821px]:hidden">{g.title}</p>
                </>
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">{g.title}</p>
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
                <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line max-[820px]:hidden" />
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5] min-[821px]:hidden">
                  Information
                </p>
              </>
            ) : (
              <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">
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

        <div className="mt-auto pt-3 border-t border-[#eee] dark:border-night-line">
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
            className={`w-full flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line ${collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:px-3.5" : "px-3.5"
              }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            <span className={collapsed ? "min-[821px]:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
      </div>
      {Tooltip}
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
