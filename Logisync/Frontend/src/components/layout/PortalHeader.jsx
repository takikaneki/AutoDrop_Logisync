import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import LogoutModal from "../LogoutModal.jsx";
import UserAvatar from "../Avatar.jsx";
import useClickOutside from "../../hooks/useClickOutside.js";
import { toggleDark, usePrefs } from "../../store/prefs.js";
import { useProfile } from "../../store/profile.js";
import { ROLE_LABEL, toPath } from "./navConfig.js";
import NotificationMenu from "./NotificationMenu.jsx";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

const iconBtn =
  "flex h-10 w-10 max-[480px]:h-9 max-[480px]:w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555] hover:bg-brand-soft hover:text-brand transition dark:bg-night-line dark:text-[#d1c9c2]";

// Navigation bar for Seller and Rider portals.
export default function PortalHeader({ role, collapsed = false, mobileOpen = false, onToggleSidebar }) {
  const { dark } = usePrefs();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const item =
    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-[#fff3e8] dark:hover:bg-night-line";

  return (
    <>
      <header className="sticky top-0 z-50 h-14 w-full border-b border-[#eee] bg-white px-3 sm:px-6 shadow-sm print:hidden dark:bg-night-panel dark:border-night-line">
        <div className="flex h-full w-full items-center justify-between gap-2">
          {/* Left Column: Sidebar Toggle & Brand */}
          <div className="flex min-w-0 items-center justify-start gap-2 sm:gap-3">
            <button
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              aria-expanded={typeof window !== "undefined" && window.innerWidth <= 820 ? mobileOpen : !collapsed}
              title="Toggle sidebar"
              className={iconBtn}
            >
              <i className="fa-solid fa-bars text-[15px]" />
            </button>
            <Link to={toPath(role, "")} className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="h-5 sm:h-6 w-auto shrink-0 object-contain"
              />
              <span className="h-4 w-[1.5px] shrink-0 bg-slate-200 max-[380px]:hidden dark:bg-slate-700" aria-hidden="true" />
              <span className="truncate text-[15px] sm:text-[16px] font-black tracking-tight text-slate-900 max-[380px]:hidden dark:text-white">
                LogiSync
              </span>
              <span className="hidden min-[821px]:inline-flex shrink-0 items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand border border-brand/20">
                {ROLE_LABEL[role]}
              </span>
            </Link>
          </div>

          {/* Right Column: Theme Toggle, Notifications, and Profile */}
          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
            <button
              onClick={toggleDark}
              className={iconBtn}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-[14px] sm:text-[15px]`} />
            </button>

            <NotificationMenu role={role} />

            <div ref={menuRef} className="relative ml-0.5 sm:ml-1 max-[600px]:ml-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-full p-1 min-[769px]:pr-2.5 hover:bg-[#fafafa] border border-transparent hover:border-[#eee] transition dark:hover:bg-night-line dark:hover:border-night-line"
              >
                <UserAvatar className="w-[34px] h-[34px] sm:w-[36px] sm:h-[36px]" />
                <span className="text-left max-[820px]:hidden">
                  <strong className="block max-w-[110px] truncate text-[13.5px] leading-tight text-slate-800 dark:text-white">
                    {profile.name}
                  </strong>
                  <small className="block text-[11px] text-[#999] mt-[1px]">
                    {profile.role}
                  </small>
                </span>
                <i className="fa-solid fa-chevron-down text-[10px] text-[#999] max-[820px]:hidden" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[50px] z-[1500] w-[230px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#eee] bg-white shadow-[0_18px_50px_rgba(0,0,0,.15)] animate-popup dark:bg-night-panel dark:border-night-line">
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
                    <i className="fa-solid fa-headset w-4 text-center text-[#888]" /> Help
                  </Link>
                  <Link
                    to={`${toPath(role, "help")}#faq`}
                    onClick={() => setMenuOpen(false)}
                    className={item}
                  >
                    <i className="fa-regular fa-circle-question w-4 text-center text-[#888]" /> FAQ
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
