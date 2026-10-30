import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import UserAvatar from "../Avatar.jsx";
import useClickOutside from "../../hooks/useClickOutside.js";
import { toggleDark, usePrefs } from "../../store/prefs.js";
import { useProfile } from "../../store/profile.js";
import { TOP_LINKS, ROLE_LABEL, toPath } from "./navConfig.js";
import NotificationMenu from "./NotificationMenu.jsx";

const iconBtn =
  "w-[40px] h-[40px] rounded-full bg-[#f5f5f5] text-[#555] hover:bg-brand-soft hover:text-brand transition dark:bg-night-line dark:text-[#d1c9c2]";

// Header sa itaas ng Seller/Rider. Kapareho ng header ng Coordinator (logo, menu, dark mode, notifications, profile).
export default function PortalHeader({ role, onToggleSidebar }) {
  const { dark } = usePrefs();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const nav = [{ path: "", label: "Home" }, ...TOP_LINKS];
  const item = "w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-[#fff3e8] dark:hover:bg-night-line";

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 bg-white border-b border-[#eee] print:hidden dark:bg-night-panel dark:border-night-line">
        <div className="flex items-center gap-4 justify-self-start">
          <button onClick={onToggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar" className={iconBtn}>
            <i className="fa-solid fa-bars" />
          </button>

          <Link to={toPath(role, "")} className="flex items-center gap-2.5 mr-2">
            <span className="w-[38px] h-[38px] rounded-[10px] bg-brand text-white flex items-center justify-center text-[17px]">
              <i className="fa-solid fa-box" />
            </span>
            <span className="leading-tight max-[500px]:hidden">
              <strong className="block text-[17px]">LogiSync</strong>
              <small className="block text-[10px] text-[#999]">{ROLE_LABEL[role]}</small>
            </span>
          </Link>
        </div>

        <nav className="flex items-center justify-center gap-1 max-[900px]:hidden" aria-label="Main">
          {nav.map((n) => (
            <NavLink
              key={n.label}
              to={toPath(role, n.path)}
              end={n.path === ""}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-[14px] font-semibold transition ${
                  isActive ? "text-brand bg-brand-soft dark:bg-night-line" : "text-[#666] hover:text-brand dark:text-[#d1c9c2]"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 justify-self-end">
          <button
            onClick={toggleDark}
            className={iconBtn}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"}`} />
          </button>
          <NotificationMenu role={role} />

          <div ref={menuRef} className="relative ml-1">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex items-center gap-2.5 rounded-full pr-2 hover:bg-[#fafafa] dark:hover:bg-night-line"
            >
              <UserAvatar className="w-[40px] h-[40px]" />
              <span className="text-left max-[700px]:hidden">
                <strong className="block text-[14px] leading-tight">{profile.name}</strong>
                <small className="block text-[11px] text-[#999] mt-[2px]">{profile.role}</small>
              </span>
              <i className="fa-solid fa-chevron-down text-[11px] text-[#999] max-[700px]:hidden" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[52px] w-[230px] overflow-hidden rounded-[14px] border border-[#eee] bg-white shadow-[0_18px_50px_rgba(0,0,0,.15)] animate-popup dark:bg-night-panel dark:border-night-line">
                <div className="px-4 py-3 border-b border-[#f1f1f1] dark:border-night-line">
                  <strong className="block text-[14px] truncate">{profile.name}</strong>
                  <small className="block text-[12px] text-[#999] truncate">{profile.email || profile.role}</small>
                </div>
                <Link to={toPath(role, "settings")} onClick={() => setMenuOpen(false)} className={item}>
                  <i className="fa-solid fa-gear w-4 text-center text-[#888]" /> Settings
                </Link>
                <Link to={toPath(role, "help")} onClick={() => setMenuOpen(false)} className={item}>
                  <i className="fa-regular fa-circle-question w-4 text-center text-[#888]" /> Help
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLogoutOpen(true);
                  }}
                  className={`${item} border-t border-[#f1f1f1] text-[#d94747] dark:border-night-line`}
                >
                  <i className="fa-solid fa-right-from-bracket w-4 text-center" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
