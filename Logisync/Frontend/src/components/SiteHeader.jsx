import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import AnnouncementModal from "./AnnouncementModal.jsx";
import NotificationBell from "./NotificationBell.jsx";
import LogoutModal from "./LogoutModal.jsx";
import UserAvatar from "./Avatar.jsx";
import { toggleDark, usePrefs, useT } from "../store/prefs.js";
import { useProfile } from "../store/profile.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";

const nav = [
  { to: "/dashboard", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
  { to: "/help", label: "Help" },
];

const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555] hover:bg-brand-soft hover:text-brand transition dark:bg-night-line dark:text-[#d1c9c2]";

// Navigation bar directly underneath the GlobalBanner.
// Uses a balanced 3-column layout (Left: Sidebar Toggle; Center: Nav Links; Right: Controls)
// to ensure the navigation links remain strictly horizontally centered across all screen sizes.
export default function SiteHeader({ onToggleSidebar }) {
  const t = useT();
  const { dark } = usePrefs();
  const profile = useProfile();
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const item =
    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-[#fff3e8] dark:hover:bg-night-line";

  return (
    <>
      <header className="sticky top-0 z-50 h-14 w-full border-b border-[#eee] bg-white px-4 sm:px-6 shadow-sm print:hidden max-[800px]:hidden dark:bg-night-panel dark:border-night-line">
        <div className="grid h-full w-full grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center">
          {/* Left Column: Sidebar toggle & Brand */}
          <div className="flex items-center justify-start gap-3">
            <button
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              className={`${iconBtn} max-[800px]:hidden`}
            >
              <i className="fa-solid fa-bars text-[15px]" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="h-6 w-auto shrink-0 object-contain"
              />
              <span className="h-4 w-[1.5px] bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <span className="text-[16px] font-black tracking-tight text-slate-900 dark:text-white">
                LogiSync
              </span>
              <span className="hidden lg:inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand border border-brand/20">
                Coordinator Hub
              </span>
            </Link>
          </div>

          {/* Center Column: Perfectly Horizontally Centered Navigation Links */}
          <nav
            className="flex h-full items-stretch justify-center gap-1 sm:gap-2 md:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Main Navigation"
          >
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/dashboard"}
                className={({ isActive }) =>
                  `relative flex items-center justify-center whitespace-nowrap px-3.5 sm:px-4 text-[14px] font-semibold tracking-wide transition-all ${
                    isActive
                      ? "text-brand after:absolute after:bottom-0 after:inset-x-2 after:h-[3px] after:rounded-t-full after:bg-brand"
                      : "text-[#555] hover:text-brand dark:text-[#d1c9c2]"
                  }`
                }
              >
                {t(n.label)}
              </NavLink>
            ))}
          </nav>

          {/* Right Column: Theme Toggle, Announcement, Notifications, and Profile */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            <button
              onClick={toggleDark}
              className={`${iconBtn} max-[480px]:hidden`}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-[15px]`} />
            </button>

            <button
              onClick={() => setAnnounceOpen(true)}
              title="Send announcement"
              aria-label="Send announcement"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand hover:bg-brand hover:text-white transition dark:bg-night-line"
            >
              <i className="fa-solid fa-bullhorn text-[15px]" />
            </button>

            <NotificationBell />

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
                    to="/settings?tab=profile"
                    onClick={() => setMenuOpen(false)}
                    className={item}
                  >
                    <i className="fa-solid fa-user w-4 text-center text-[#888]" /> Profile
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className={item}>
                    <i className="fa-solid fa-gear w-4 text-center text-[#888]" /> Settings
                  </Link>
                  <Link to="/help" onClick={() => setMenuOpen(false)} className={item}>
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

      <AnnouncementModal open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
