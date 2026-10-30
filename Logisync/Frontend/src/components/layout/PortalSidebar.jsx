import { useState } from "react";
import { NavLink } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import { NAV, toPath } from "./navConfig.js";

// Sidebar ng Seller/Rider. Kapareho ng itsura at galaw ng sidebar ng Coordinator.
// Sa mobile ay nakatago hanggang buksan ng menu button.
export default function PortalSidebar({ role, collapsed, mobileOpen, onClose }) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `relative flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] transition ${
      collapsed ? "justify-center px-0" : "px-3.5"
    } ${
      isActive
        ? "bg-brand-soft text-brand font-semibold dark:bg-night-line"
        : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
    }`;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 top-16 z-30 bg-black/40 min-[801px]:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col overflow-y-auto bg-white border-r border-[#eee] py-4 z-40 transition-[width,transform] duration-200 print:hidden dark:bg-night-panel dark:border-night-line max-[800px]:w-[250px] max-[800px]:px-[18px] ${
          collapsed ? "min-[801px]:w-[78px] min-[801px]:px-2.5" : "min-[801px]:w-[250px] min-[801px]:px-[18px]"
        } ${mobileOpen ? "max-[800px]:translate-x-0" : "max-[800px]:-translate-x-full"}`}
      >
        <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
          {NAV[role].map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line first:hidden max-[800px]:hidden" />
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">{g.title}</p>
              )}
              {g.links.map((l) => (
                <NavLink key={l.path} to={toPath(role, l.path)} end={l.path === ""} onClick={onClose} className={navClass} title={l.label}>
                  <i className={`fa-solid ${l.icon} w-5 text-center`} />
                  {!collapsed && <span className="flex-1">{l.label}</span>}
                  {!collapsed && l.soon && (
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#aaa] dark:bg-night-head">Soon</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-3 border-t border-[#eee] dark:border-night-line">
          <NavLink to={toPath(role, "settings")} onClick={onClose} className={navClass} title="Settings">
            <i className="fa-solid fa-gear w-5 text-center" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            title="Logout"
            className={`w-full flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line ${
              collapsed ? "justify-center px-0" : "px-3.5"
            }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
