import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import LogoutModal from "./LogoutModal.jsx";
import { useNotifications } from "../store/notifications.js";
import { useComplaints } from "../store/records.js";
import { useT } from "../store/prefs.js";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";

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
      { to: "/reports", icon: "fa-file-lines", label: "Reports" },
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

export default function Sidebar({ collapsed }) {
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
        // Count each conversation once if it contains unread incoming messages.
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
      collapsed ? "justify-center px-0" : "px-3.5"
    } ${
      isActive
        ? "bg-brand-soft text-brand font-semibold dark:bg-night-line"
        : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
    }`;

  return (
    <>
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col overflow-y-auto bg-white border-r border-[#eee] py-4 z-40 transition-[width] duration-200 print:hidden dark:bg-night-panel dark:border-night-line ${
          collapsed ? "w-[78px] px-2.5" : "w-[250px] px-[18px]"
        }`}
      >
        <nav className="flex flex-col gap-0.5">
          {groups.map((g) => (
            <div key={g.title} className="mb-2">
              {collapsed ? (
                <div className="mx-3 my-2 border-t border-[#eee] dark:border-night-line first:hidden" />
              ) : (
                <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.6px] text-[#b5b5b5]">{t(g.title)}</p>
              )}
              {g.links.map((l) => {
                const count = l.badge ? badges[l.badge] : l.to === "/messages" ? unreadConversations : 0;
                return (
                  <NavLink key={l.to} to={l.to} className={navClass} title={t(l.label)}>
                    <i className={`fa-solid ${l.icon} w-5 text-center`} />
                    {!collapsed && <span className="flex-1">{t(l.label)}</span>}
                    {count > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center ${
                          collapsed ? "absolute top-1 right-2" : ""
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
        </nav>

        {/* Pinakababa: Settings at Logout */}
        <div className="mt-auto pt-3 border-t border-[#eee] dark:border-night-line">
          <NavLink to="/settings" className={navClass} title={t("Settings")}>
            <i className="fa-solid fa-gear w-5 text-center" />
            {!collapsed && <span>{t("Settings")}</span>}
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            title={t("Logout")}
            className={`w-full flex items-center gap-[13px] rounded-[9px] py-[11px] text-[14px] text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line ${
              collapsed ? "justify-center px-0" : "px-3.5"
            }`}
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center" />
            {!collapsed && <span>{t("Logout")}</span>}
          </button>
        </div>
      </aside>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
