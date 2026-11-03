import { useState } from "react";
import { NavLink } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import { NAV, ROLE_LABEL, TOP_LINKS, toPath } from "./navConfig.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

const TOP_ICONS = {
  about: "fa-circle-info",
  contact: "fa-envelope",
  help: "fa-circle-question",
};

// Sidebar ng Seller/Rider. Kapareho ng itsura at galaw ng sidebar ng Coordinator.
// Sa mobile ay nakatago hanggang buksan ng menu button.
export default function PortalSidebar({ role, collapsed, mobileOpen, onClose }) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `relative flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] transition ${collapsed ? "min-[801px]:justify-center min-[801px]:px-0 max-[800px]:px-3.5" : "px-3.5"
    } ${isActive
      ? "bg-brand-soft text-brand font-semibold dark:bg-night-line"
      : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
    }`;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[1px] min-[801px]:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`flex shrink-0 flex-col overflow-y-auto bg-white border-r border-[#eee] py-4 z-40 transition-[width,transform] duration-200 print:hidden dark:bg-night-panel dark:border-night-line min-[801px]:sticky min-[801px]:top-14 min-[801px]:h-[calc(100vh-56px)] min-[801px]:self-start max-[800px]:fixed max-[800px]:left-0 max-[800px]:top-0 max-[800px]:z-[60] max-[800px]:h-[calc(100vh-64px)] max-[800px]:w-[270px] max-[800px]:px-[18px] max-[800px]:shadow-2xl ${collapsed ? "min-[801px]:w-[78px] min-[801px]:px-2.5" : "min-[801px]:w-[250px] min-[801px]:px-[18px]"
          } ${mobileOpen ? "max-[800px]:translate-x-0" : "max-[800px]:-translate-x-full"}`}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[#f1f1f1] px-2 pb-3 min-[801px]:hidden dark:border-night-line">
          <div className="flex items-center gap-2">
            <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-6 w-auto object-contain" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-brand">{ROLE_LABEL[role]}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#666] hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
          {NAV[role].map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <>
                  <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line first:hidden max-[800px]:hidden" />
                  <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5] min-[801px]:hidden">{g.title}</p>
                </>
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">{g.title}</p>
              )}
              {g.links.map((l) => (
                <NavLink key={l.path} to={toPath(role, l.path)} end={l.path === ""} onClick={onClose} className={navClass} title={l.label}>
                  <i className={`fa-solid ${l.icon} w-5 text-center`} />
                  <span className={`flex-1 ${collapsed ? "min-[801px]:hidden" : ""}`}>{l.label}</span>
                  {l.soon && (
                    <span className={`rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#aaa] dark:bg-night-head ${collapsed ? "min-[801px]:hidden" : ""}`}>Soon</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Mobile-only Info Links (hidden from top header on small screens) */}
          <div className="mb-2 min-[901px]:hidden">
            <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">
              Information
            </p>
            {TOP_LINKS.map((l) => (
              <NavLink key={l.path} to={toPath(role, l.path)} onClick={onClose} className={navClass} title={l.label}>
                <i className={`fa-solid ${TOP_ICONS[l.path] || "fa-circle-info"} w-5 text-center`} />
                <span className={`flex-1 ${collapsed ? "min-[801px]:hidden" : ""}`}>{l.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mt-auto pt-3 border-t border-[#eee] dark:border-night-line">
          <NavLink to={toPath(role, "settings")} onClick={onClose} className={navClass} title="Settings">
            <i className="fa-solid fa-gear w-5 text-center" />
            <span className={collapsed ? "min-[801px]:hidden" : ""}>Settings</span>
          </NavLink>
          <button
            onClick={() => {
              onClose?.();
              setLogoutOpen(true);
            }}
            title="Logout"
            className={`w-full flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line ${collapsed ? "min-[801px]:justify-center min-[801px]:px-0 max-[800px]:px-3.5" : "px-3.5"
              }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            <span className={collapsed ? "min-[801px]:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
