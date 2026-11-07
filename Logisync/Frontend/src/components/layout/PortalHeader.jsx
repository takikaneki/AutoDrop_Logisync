import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import UserAvatar from "../Avatar.jsx";
import useClickOutside from "../../hooks/useClickOutside.js";
import { toggleDark, usePrefs } from "../../store/prefs.js";
import { useProfile } from "../../store/profile.js";
import { TOP_LINKS, toPath } from "./navConfig.js";
import NotificationMenu from "./NotificationMenu.jsx";

const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555] hover:bg-brand-soft hover:text-brand transition dark:bg-night-line dark:text-[#d1c9c2]";

// Navigation bar for Seller and Rider portals directly underneath GlobalBanner.
// Uses the identical 3-column balanced grid layout as SiteHeader so navigation links remain horizontally centered.
export default function PortalHeader({ role, onToggleSidebar }) {
  const { dark } = usePrefs();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const nav = [{ path: "", label: "Home" }, ...TOP_LINKS];
  const item =
    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-[#fff3e8] dark:hover:bg-night-line";

  return (
    <>
      <header className="sticky top-0 z-50 h-14 w-full border-b border-[#eee] bg-white px-4 sm:px-6 shadow-sm print:hidden max-[800px]:hidden dark:bg-night-panel dark:border-night-line">
        <div className="grid h-full w-full grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center">
          {/* Left Column: Sidebar Toggle */}
          <div className="flex items-center justify-start">
            <button
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              className={`${iconBtn} max-[800px]:hidden`}
            >
              <i className="fa-solid fa-bars text-[15px]" />
            </button>
          </div>

          {/* Center Column: Perfectly Horizontally Centered Navigation Links */}
          <nav
            className="flex h-full items-stretch justify-center gap-1 sm:gap-2 md:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Main Navigation"
          >
            {nav.map((n) => (
              <NavLink
                key={n.label}
                to={toPath(role, n.path)}
                end={n.path === ""}
                className={({ isActive }) =>
                  `relative flex items-center justify-center whitespace-nowrap px-3.5 sm:px-4 text-[14px] font-semibold tracking-wide transition-all ${
                    isActive
                      ? "text-brand after:absolute after:bottom-0 after:inset-x-2 after:h-[3px] after:rounded-t-full after:bg-brand"
                      : "text-[#555] hover:text-brand dark:text-[#d1c9c2]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Column: Theme Toggle, Notifications, and Profile */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            <button
              onClick={toggleDark}
              className={`${iconBtn} max-[480px]:hidden`}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-[15px]`} />
            </button>

            <NotificationMenu role={role} />

            <div ref={menuRef} className="relative ml-1 max-[600px]:ml-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2.5 rounded-full p-1 pl-1 pr-2.5 hover:bg-[#fafafa] border border-transparent hover:border-[#eee] transition dark:hover:bg-night-line dark:hover:border-night-line"
              >
                <UserAvatar className="w-[36px] h-[36px]" />
                <span className="text-left max-[700px]:hidden">
                  <strong className="block text-[13.5px] leading-tight text-slate-800 dark:text-white">
                    {profile.name}
                  </strong>
                  <small className="block text-[11px] text-[#999] mt-[1px]">
                    {profile.role}
                  </small>
                </span>
                <i className="fa-solid fa-chevron-down text-[10px] text-[#999] max-[700px]:hidden" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[52px] z-[1500] w-[230px] overflow-hidden rounded-[14px] border border-[#eee] bg-white shadow-[0_18px_50px_rgba(0,0,0,.15)] animate-popup dark:bg-night-panel dark:border-night-line">
                  <div className="px-4 py-3 border-b border-[#f1f1f1] dark:border-night-line">
                    <strong className="block text-[14px] truncate">{profile.name}</strong>
                    <small className="block text-[12px] text-[#999] truncate">
                      {profile.email || profile.role}
                    </small>
                  </div>
                  <Link
                    to={toPath(role, "settings")}
                    onClick={() => setMenuOpen(false)}
                    className={item}
                  >
                    <i className="fa-solid fa-gear w-4 text-center text-[#888]" /> Settings
                  </Link>
                  <Link
                    to={toPath(role, "help")}
                    onClick={() => setMenuOpen(false)}
                    className={item}
                  >
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
        </div>
      </header>

      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
