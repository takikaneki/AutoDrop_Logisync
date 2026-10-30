import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import AnnouncementsPanel from "../../components/AnnouncementsPanel.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { btnGhost, panel } from "../../components/styles.js";
import useBase from "../../hooks/useBase.js";
import { timeAgo } from "../../store/notifications.js";
import { markAllPortalRead, markPortalRead, usePortalNotifications } from "../../store/portalNotifications.js";

const tones = {
  orange: "bg-[#fff0e7] text-[#ff6818]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  red: "bg-[#fff0f0] text-[#d94747]",
};

// Iisang pahina para sa Notifications at Announcements ng Seller/Rider (parehong data ng bell sa header).
// Ang announcements ng Coordinator ay nasa pinakaitaas at may ibang kulay; ang regular na notifications ay nasa ilalim.
export default function PortalNotifications() {
  const role = useBase().slice(1);
  const navigate = useNavigate();
  const { items, announcements, notifications, unread } = usePortalNotifications(role);
  const [tab, setTab] = useState("all");

  const tabs = [
    ["all", "All"],
    ["unread", "Unread"],
    ["message", "Messages"],
    ["complaint", "Complaints"],
    ["parcel", "Parcels"],
  ];
  const list = useMemo(
    () => (tab === "all" ? notifications : tab === "unread" ? notifications.filter((n) => !n.read) : notifications.filter((n) => n.kind === tab)),
    [notifications, tab]
  );

  return (
    <>
      <Topbar title="Notifications" subtitle={unread ? `You have ${unread} unread update${unread > 1 ? "s" : ""}, including announcements.` : "You're all caught up."}>
        <button onClick={() => markAllPortalRead(items.map((n) => n.id))} disabled={!unread} className={`${btnGhost} disabled:opacity-50`}>
          <i className="fa-solid fa-check-double" /> Mark all as read
        </button>
      </Topbar>

      {/* ANNOUNCEMENTS NG COORDINATOR (laging nasa itaas) */}
      <AnnouncementsPanel items={announcements} onOpen={(a) => markPortalRead(a.id)} />

      {/* REGULAR NA NOTIFICATIONS */}
      <h2 className="mb-3 text-[17px] font-bold"><i className="fa-regular fa-bell mr-2 text-orange-500" />Notifications</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${tab === k ? "bg-brand text-white" : "border border-[#eee] bg-white text-[#777] hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"}`}
          >
            {l}{k === "unread" && notifications.filter((n) => !n.read).length > 0 ? ` (${notifications.filter((n) => !n.read).length})` : ""}
          </button>
        ))}
      </div>

      <section className={`${panel} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon="fa-bell-slash" title="No notifications here" />
        ) : (
          list.map((n) => (
            <button
              key={n.id}
              onClick={() => { markPortalRead(n.id); if (n.to) navigate(n.to); }}
              className={`flex w-full items-start gap-4 border-b border-[#f3f3f3] px-6 py-4 text-left last:border-0 hover:bg-[#fff7f2] dark:border-night-line dark:hover:bg-night-head ${n.read ? "" : "bg-[#fffaf7] dark:bg-night-head"}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tones[n.tone] || tones.orange}`}><i className={`fa-solid ${n.icon}`} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[14px]">{n.title}</strong>
                <span className="mt-0.5 block text-[13px] text-[#888]">{n.text}</span>
                <small className="mt-1 block text-[12px] text-[#aaa]">{timeAgo(n.ts)}</small>
              </span>
              {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
            </button>
          ))
        )}
      </section>
    </>
  );
}
