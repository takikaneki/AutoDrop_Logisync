import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import AnnouncementModal from "./AnnouncementModal.jsx";
import LogoutModal from "./LogoutModal.jsx";
import UserAvatar from "./Avatar.jsx";
import { useNotifications } from "../store/notifications.js";
import { toggleDark, usePrefs, useT } from "../store/prefs.js";
import { useProfile } from "../store/profile.js";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";
import { fetchUnreviewedEmergencyCount } from "../services/emergencyService.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";
import { useSidebarTooltip } from "./layout/SidebarTooltip.jsx";
import Icon from "./Icon.jsx";

const groups = [
  {
    title: "Overview",
    links: [
      { to: "/dashboard", icon: "house", label: "Dashboard" },
      { to: "/audit", icon: "history", label: "Activity Log" },
    ],
  },
  {
    title: "Operations",
    links: [
      { to: "/parcels", icon: "package", label: "Parcel Records" },
      { to: "/verification", icon: "circle-check", label: "Verification" },
      { to: "/scan", icon: "scan-line", label: "Scan QR" },
    ],
  },
  {
    title: "Account Management",
    links: [
      { to: "/accounts", icon: "user-plus", label: "Account Creation" },
      { to: "/riders", icon: "bike", label: "Riders" },
      { to: "/sellers", icon: "store", label: "Sellers" },
    ],
  },
  {
    title: "Communication",
    links: [
      { to: "/messages", icon: "message-circle", label: "Messages" },
      { to: "/emergency-reports", icon: "triangle-alert", label: "Emergency Reports", badge: "emergencies" },
      { to: "/notifications", icon: "bell", label: "Notifications", badge: "notifications" },
    ],
  },
];

const supportLinks = [
  { to: "/contact", icon: "mail", label: "Contact Us" },
  { to: "/help", icon: "circle-help", label: "FAQs" },
  { to: "/about", icon: "info", label: "About LOGISYNC" },
];

export default function Sidebar({ collapsed, mobileOpen = false, onClose, onCloseDesktop, onToggleSidebar }) {
  const t = useT();
  const { dark } = usePrefs();
  const profile = useProfile();
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [unreviewedEmergencies, setUnreviewedEmergencies] = useState(0);
  const currentUserId = Number(getUser()?.user_id);
  const { tipProps, Tooltip } = useSidebarTooltip(collapsed);

  useEffect(() => {
    let mounted = true;
    const refreshCounts = async () => {
      try {
        const [messages, emergencyCount] = await Promise.all([
          listMessages().catch(() => []),
          fetchUnreviewedEmergencyCount().catch(() => 0),
        ]);
        if (!mounted) return;
        const senders = new Set(
          messages
            .filter((m) => Number(m.receiver_id) === currentUserId && !m.is_read)
            .map((m) => Number(m.sender_id))
        );
        setUnreadConversations(senders.size);
        setUnreviewedEmergencies(Number(emergencyCount) || 0);
      } catch {
        // Keep the sidebar usable
      }
    };
    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    window.addEventListener("logisync:emergency-updated", refreshCounts);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("logisync:emergency-updated", refreshCounts);
    };
  }, [currentUserId]);

  const unread = useNotifications().filter((n) => !n.read).length;
  const badges = { messages: unreadConversations, notifications: unread, emergencies: unreviewedEmergencies };

  const navClass = ({ isActive }) =>
    `group relative flex items-center rounded-[10px] py-[11px] text-[14px] transition ${
      collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:gap-[13px] max-[820px]:px-3.5" : "gap-[13px] px-3.5"
    } ${
      isActive
        ? "bg-[#0f172a] text-white font-bold shadow-sm dark:bg-[#d9482b] dark:text-white"
        : "text-white/95 hover:bg-[#0f172a]/20 hover:text-white hover:font-semibold dark:text-slate-300 dark:hover:bg-[#1e293b] dark:hover:text-white"
    }`;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/35 backdrop-blur-[1px] transition-opacity min-[821px]:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`relative shrink-0 bg-[#d9482b] text-white border-r border-[#bf3a20] shadow-lg transition-[width,transform] duration-200 dark:border-night-line dark:bg-night-panel print:hidden max-[820px]:fixed max-[820px]:inset-y-0 max-[820px]:left-0 max-[820px]:z-[70] max-[820px]:h-[100dvh] max-[820px]:w-[280px] max-[820px]:max-w-[85vw] max-[820px]:shadow-2xl ${
          mobileOpen ? "max-[820px]:translate-x-0" : "max-[820px]:-translate-x-full"
        } min-[821px]:sticky min-[821px]:top-0 min-[821px]:z-40 min-[821px]:h-screen min-[821px]:translate-x-0 ${
          collapsed ? "min-[821px]:w-0 min-[821px]:overflow-hidden min-[821px]:border-r-0" : "min-[821px]:w-[250px]"
        }`}
      >
        <div className={`logisync-sidebar-scroll flex h-full flex-col overflow-y-auto overflow-x-hidden py-4 ${collapsed ? "min-[821px]:px-2.5 max-[820px]:px-4" : "px-4"}`}>
          {/* Branding Header + Upper-Right Hamburger Toggle */}
          <div className={`mb-3.5 border-b border-white/20 pb-3.5 ${collapsed ? "min-[821px]:flex min-[821px]:flex-col min-[821px]:items-center min-[821px]:gap-2.5 min-[821px]:px-0 max-[820px]:px-1" : "px-1"}`}>
            <div className={`flex items-center justify-between gap-2.5 ${collapsed ? "min-[821px]:flex-col min-[821px]:justify-center" : ""}`}>
              <div className={`flex min-w-0 items-center gap-2 ${collapsed ? "min-[821px]:justify-center" : "flex-1"}`}>
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  draggable={false}
                  className={`${collapsed ? "min-[821px]:h-3.5 max-[820px]:h-5" : "h-5"} w-auto shrink-0 object-contain brightness-0 invert dark:brightness-100 dark:invert-0`}
                />
                <span className={`truncate text-[16px] font-black tracking-tight text-white leading-tight ${collapsed ? "min-[821px]:hidden" : ""}`}>
                  LogiSync
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden min-[821px]:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/95 transition hover:bg-white/15 hover:text-white"
              >
                <Icon name="menu" className="h-[18px] w-[18px]" />
              </button>
              <div className="flex shrink-0 items-center gap-1.5 min-[821px]:hidden">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-brand"
              >
                <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  setAnnounceOpen(true);
                }}
                aria-label="Send announcement"
                title="Send announcement"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand transition hover:bg-white/90"
              >
                <Icon name="megaphone" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onCloseDesktop?.();
                }}
                aria-label="Close sidebar"
                title="Close sidebar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-brand"
              >
                <Icon name="x" className="h-4 w-4" />
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

        <nav className="flex flex-col gap-0.5">
          {groups.map((g, gIdx) => (
            <div key={g.title} className={gIdx > 0 ? "mt-2 border-t border-white/20 pt-2.5" : "mb-1"}>
              {collapsed ? (
                <>
                  <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">{t(g.title)}</p>
                </>
              ) : (
                <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">{t(g.title)}</p>
              )}
              {g.links.map((l) => {
                const count = l.badge ? badges[l.badge] : l.to === "/messages" ? unreadConversations : 0;
                const labelText = t(l.label);
                return (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={onClose}
                    className={navClass}
                    title={labelText}
                    aria-label={labelText}
                    {...tipProps(labelText)}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={l.icon}
                          filled={isActive}
                          strokeWidth={isActive ? 2.4 : 2.15}
                          className={`h-[18px] w-[18px] ${isActive ? "text-[#d9482b] dark:text-white" : ""}`}
                        />
                        <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{labelText}</span>
                        {count > 0 && (
                          <span
                            className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shadow-xs ${
                              l.badge === "emergencies"
                                ? "bg-[#dc2626] text-white ring-1 ring-white/70"
                                : "bg-white text-brand"
                            } ${collapsed ? "min-[821px]:hidden" : ""}`}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Support Links */}
          <div className="mt-2 border-t border-white/20 pt-2.5 pb-2">
            {collapsed ? (
              <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">
                {t("Support")}
              </p>
            ) : (
              <p className="px-3.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">
                {t("Support")}
              </p>
            )}
            {supportLinks.map((l) => {
              const labelText = t(l.label);
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onClose}
                  className={navClass}
                  title={labelText}
                  aria-label={labelText}
                  {...tipProps(labelText)}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        name={l.icon}
                        filled={isActive}
                        strokeWidth={isActive ? 2.4 : 2.15}
                        className={`h-[18px] w-[18px] ${isActive ? "text-[#d9482b] dark:text-white" : ""}`}
                      />
                      <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{labelText}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Pinakababa: Settings at Logout */}
        <div className="mt-auto pt-3 border-t border-white/20">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={navClass}
            title={t("Settings")}
            aria-label={t("Settings")}
            {...tipProps(t("Settings"))}
          >
            {({ isActive }) => (
              <>
                <Icon
                  name="settings"
                  filled={isActive}
                  strokeWidth={isActive ? 2.4 : 2.15}
                  className={`h-[18px] w-[18px] ${isActive ? "text-[#d9482b] dark:text-white" : ""}`}
                />
                <span className={collapsed ? "min-[821px]:hidden" : ""}>{t("Settings")}</span>
              </>
            )}
          </NavLink>
          <button
            onClick={() => {
              onClose?.();
              setLogoutOpen(true);
            }}
            title={t("Logout")}
            aria-label={t("Logout")}
            {...tipProps(t("Logout"))}
            className={`w-full flex items-center rounded-[10px] py-[11px] text-[14px] text-white/95 transition hover:bg-[#0f172a]/20 hover:text-white hover:font-semibold ${
              collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:gap-[13px] max-[820px]:px-3.5" : "gap-[13px] px-3.5"
            }`}
          >
            <Icon name="log-out" className="h-[18px] w-[18px]" />
            <span className={collapsed ? "min-[821px]:hidden" : ""}>{t("Logout")}</span>
          </button>
        </div>
        </div>
      </aside>
      {Tooltip}
      <AnnouncementModal open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
