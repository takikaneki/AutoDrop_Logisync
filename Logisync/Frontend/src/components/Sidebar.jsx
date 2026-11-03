import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import LogoutModal from "./LogoutModal.jsx";
import { useNotifications } from "../store/notifications.js";
import { useComplaints } from "../store/records.js";
import { useT } from "../store/prefs.js";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";

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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const currentUserId = Number(getUser()?.user_id);

  useEffect(() => {
    let mounted = true;
    const refreshUnreadConversations = async () => {
      try {
        const messages = await listMessages();
        if (!mounted) return;
        const senders = new Set(
          messages
            .filter((m) => Number(m.receiver_id) === currentUserId && !m.is_read)
            .map((m) => Number(m.sender_id))
        );
        setUnreadConversations(senders.size);
      } catch {
        // Keep the sidebar usable if the messages endpoint is temporarily unavailable.
      }
    };
    refreshUnreadConversations();
    const timer = setInterval(refreshUnreadConversations, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [currentUserId]);

  const unread = useNotifications().filter((n) => !n.read).length;
  const openComplaints = useComplaints().filter((c) => c.status === "Open").length;
  const badges = { messages: unreadConversations, notifications: unread, complaints: openComplaints };

  const navClass = ({ isActive }) =>
    `relative flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] transition ${
      collapsed ? "min-[801px]:justify-center min-[801px]:px-0 max-[800px]:px-3.5" : "px-3.5"
    } ${
      isActive
        ? "bg-brand-soft text-brand font-semibold dark:bg-night-line"
        : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
    }`;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[1px] min-[801px]:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`flex shrink-0 flex-col overflow-y-auto bg-white border-r border-[#eee] py-4 z-40 transition-[width,transform] duration-200 print:hidden dark:bg-night-panel dark:border-night-line min-[801px]:sticky min-[801px]:top-14 min-[801px]:h-[calc(100vh-56px)] min-[801px]:self-start max-[800px]:fixed max-[800px]:left-0 max-[800px]:top-0 max-[800px]:z-[60] max-[800px]:h-[calc(100vh-64px)] max-[800px]:w-[270px] max-[800px]:px-[18px] max-[800px]:shadow-2xl ${
          collapsed ? "min-[801px]:w-[78px] min-[801px]:px-2.5" : "min-[801px]:w-[250px] min-[801px]:px-[18px]"
        } ${mobileOpen ? "max-[800px]:translate-x-0" : "max-[800px]:-translate-x-full"}`}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[#f1f1f1] px-2 pb-3 min-[801px]:hidden dark:border-night-line">
          <div className="flex items-center gap-2">
            <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-6 w-auto object-contain" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-brand">Coordinator</span>
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

        <nav className="flex flex-col gap-0.5">
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <>
                  <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line first:hidden max-[800px]:hidden" />
                  <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5] min-[801px]:hidden">{t(g.title)}</p>
                </>
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">{t(g.title)}</p>
              )}
              {g.links.map((l) => {
                const count = l.badge ? badges[l.badge] : l.to === "/messages" ? unreadConversations : 0;
                return (
                  <NavLink key={l.to} to={l.to} onClick={onClose} className={navClass} title={t(l.label)}>
                    <i className={`fa-solid ${l.icon} w-5 text-center`} />
                    <span className={`flex-1 ${collapsed ? "min-[801px]:hidden" : ""}`}>{t(l.label)}</span>
                    {count > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center ${
                          collapsed ? "min-[801px]:absolute min-[801px]:top-1 min-[801px]:right-2" : ""
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

          {/* Mobile-only Info Links (hidden from top header on small screens) */}
          <div className="mb-2 min-[901px]:hidden">
            <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">
              {t("Quick Links")}
            </p>
            {infoLinks.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={onClose} className={navClass} title={t(l.label)}>
                <i className={`fa-solid ${l.icon} w-5 text-center`} />
                <span className={`flex-1 ${collapsed ? "min-[801px]:hidden" : ""}`}>{t(l.label)}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Pinakababa: Settings at Logout */}
        <div className="mt-auto pt-3 border-t border-[#eee] dark:border-night-line">
          <NavLink to="/settings" onClick={onClose} className={navClass} title={t("Settings")}>
            <i className="fa-solid fa-gear w-5 text-center" />
            <span className={collapsed ? "min-[801px]:hidden" : ""}>{t("Settings")}</span>
          </NavLink>
          <button
            onClick={() => {
              onClose?.();
              setLogoutOpen(true);
            }}
            title={t("Logout")}
            className={`w-full flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line ${
              collapsed ? "min-[801px]:justify-center min-[801px]:px-0 max-[800px]:px-3.5" : "px-3.5"
            }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            <span className={collapsed ? "min-[801px]:hidden" : ""}>{t("Logout")}</span>
          </button>
        </div>
      </aside>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
