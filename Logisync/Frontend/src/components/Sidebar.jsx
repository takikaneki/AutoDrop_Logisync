import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import AnnouncementModal from "./AnnouncementModal.jsx";
import LogoutModal from "./LogoutModal.jsx";
import UserAvatar from "./Avatar.jsx";
import { useNotifications } from "../store/notifications.js";
import { useComplaints } from "../store/records.js";
import { toggleDark, usePrefs, useT } from "../store/prefs.js";
import { useProfile } from "../store/profile.js";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";
import { fetchUnreadComplaintCount } from "../services/complaintService.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";
import { useSidebarTooltip } from "./layout/SidebarTooltip.jsx";

const groups = [
  {
    title: "Overview",
    links: [
      { to: "/dashboard", icon: "fa-chart-pie", label: "Dashboard" },
      { to: "/audit", icon: "fa-clipboard-list", label: "Activity Log" },
    ],
  },
  {
    title: "Operations",
    links: [
      { to: "/parcels", icon: "fa-box-open", label: "Parcel Records" },
      { to: "/verification", icon: "fa-circle-check", label: "Verification" },
      { to: "/riders", icon: "fa-motorcycle", label: "Riders" },
      { to: "/sellers", icon: "fa-store", label: "Sellers" },
      { to: "/accounts", icon: "fa-user-plus", label: "Accounts" },
    ],
  },
  {
    title: "Communication",
    links: [
      { to: "/messages", icon: "fa-comments", label: "Messages" },
      { to: "/complaints", icon: "fa-triangle-exclamation", label: "Complaints", badge: "complaints" },
      { to: "/notifications", icon: "fa-bell", label: "Notifications", badge: "notifications" },
    ],
  },
];

const infoLinks = [
  { to: "/about", icon: "fa-circle-info", label: "About Us" },
  { to: "/contact", icon: "fa-envelope", label: "Contact" },
  { to: "/help", icon: "fa-circle-question", label: "Help" },
];

export default function Sidebar({ collapsed, mobileOpen = false, onClose }) {
  const t = useT();
  const { dark } = usePrefs();
  const profile = useProfile();
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [unreadComplaints, setUnreadComplaints] = useState(0);
  const currentUserId = Number(getUser()?.user_id);
  const { tipProps, Tooltip } = useSidebarTooltip(collapsed);

  useEffect(() => {
    let mounted = true;
    const refreshCounts = async () => {
      try {
        const [messages, complaintCount] = await Promise.all([
          listMessages().catch(() => []),
          fetchUnreadComplaintCount().catch(() => 0),
        ]);
        if (!mounted) return;
        const senders = new Set(
          messages
            .filter((m) => Number(m.receiver_id) === currentUserId && !m.is_read)
            .map((m) => Number(m.sender_id))
        );
        setUnreadConversations(senders.size);
        setUnreadComplaints(Number(complaintCount) || 0);
      } catch {
        // Keep the sidebar usable
      }
    };
    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [currentUserId]);

  const unread = useNotifications().filter((n) => !n.read).length;
  const badges = { messages: unreadConversations, notifications: unread, complaints: unreadComplaints };

  const navClass = ({ isActive }) =>
    `relative flex items-center gap-[13px] rounded-[10px] py-[11px] text-[14px] transition ${
      collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:px-3.5" : "px-3.5"
    } ${
      isActive
        ? "bg-white text-[#ee4d2d] font-bold shadow-sm"
        : "text-white/90 hover:bg-white hover:text-[#ee4d2d] hover:font-semibold"
    }`;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-[1px] min-[821px]:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div className="max-[820px]:contents min-[821px]:shrink-0 min-[821px]:bg-[#ee4d2d] min-[821px]:border-r min-[821px]:border-[#d94122] print:hidden dark:min-[821px]:bg-[#c83a1d] dark:min-[821px]:border-[#a82e15]">
        <aside
          className={`flex shrink-0 flex-col overflow-y-auto bg-[#ee4d2d] text-white py-4 z-40 transition-[width,transform] duration-200 dark:bg-[#c83a1d] min-[821px]:sticky min-[821px]:top-14 min-[821px]:h-[calc(100vh-56px)] max-[820px]:fixed max-[820px]:inset-y-0 max-[820px]:left-0 max-[820px]:z-[70] max-[820px]:h-[100dvh] max-[820px]:w-[288px] max-[820px]:max-w-[86vw] max-[820px]:border-r max-[820px]:border-[#d94122] max-[820px]:px-4 max-[820px]:pb-20 max-[820px]:shadow-2xl ${
            collapsed ? "min-[821px]:w-[78px] min-[821px]:px-2.5" : "min-[821px]:w-[224px] xl:w-[250px] min-[821px]:px-3.5 xl:px-[18px]"
          } ${mobileOpen ? "max-[820px]:translate-x-0" : "max-[820px]:-translate-x-full"}`}
        >
        <div className="mb-3.5 border-b border-white/20 px-1 pb-3.5 min-[821px]:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
              <span className="inline-flex rounded-lg bg-white px-2 py-1 shadow-xs">
                <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-4 w-auto shrink-0 object-contain" />
              </span>
              <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/95">
                Coordinator Hub
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-[#ee4d2d]"
              >
                <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"} text-xs`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  setAnnounceOpen(true);
                }}
                aria-label="Send announcement"
                title="Send announcement"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#ee4d2d] transition hover:bg-white/90"
              >
                <i className="fa-solid fa-bullhorn text-xs" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white hover:text-[#ee4d2d]"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 backdrop-blur-xs">
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
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <>
                  <div className="mx-3 my-2 border-t border-white/20 first:hidden max-[820px]:hidden" />
                  <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">{t(g.title)}</p>
                </>
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">{t(g.title)}</p>
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
                    <i className={`fa-solid ${l.icon} w-5 text-center`} />
                    <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{labelText}</span>
                    {count > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#ee4d2d] text-[11px] font-bold flex items-center justify-center shadow-xs ${
                          collapsed ? "min-[821px]:absolute min-[821px]:top-1 min-[821px]:right-2" : ""
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Mobile/Tablet Info Links (hidden from top header on screens < 960px) */}
          <div className="mb-2 min-[960px]:hidden">
            {collapsed ? (
              <>
                <div className="mx-3 my-2 border-t border-white/20 max-[820px]:hidden" />
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75 min-[821px]:hidden">
                  {t("Quick Links")}
                </p>
              </>
            ) : (
              <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-white/75">
                {t("Quick Links")}
              </p>
            )}
            {infoLinks.map((l) => {
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
                  <i className={`fa-solid ${l.icon} w-5 text-center`} />
                  <span className={`flex-1 ${collapsed ? "min-[821px]:hidden" : ""}`}>{labelText}</span>
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
            <i className="fa-solid fa-gear w-5 text-center" />
            <span className={collapsed ? "min-[821px]:hidden" : ""}>{t("Settings")}</span>
          </NavLink>
          <button
            onClick={() => {
              onClose?.();
              setLogoutOpen(true);
            }}
            title={t("Logout")}
            aria-label={t("Logout")}
            {...tipProps(t("Logout"))}
            className={`w-full flex items-center gap-[13px] rounded-[10px] py-[11px] text-[14px] text-white/90 transition hover:bg-white hover:text-[#ee4d2d] hover:font-semibold ${
              collapsed ? "min-[821px]:justify-center min-[821px]:px-0 max-[820px]:px-3.5" : "px-3.5"
            }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            <span className={collapsed ? "min-[821px]:hidden" : ""}>{t("Logout")}</span>
          </button>
        </div>
      </aside>
      </div>
      {Tooltip}
      <AnnouncementModal open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
