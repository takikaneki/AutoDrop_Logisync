import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState } from "../components/ui.jsx";
import { btnGhost, panel } from "../components/styles.js";
import AnnouncementsPanel from "../components/AnnouncementsPanel.jsx";
import FailedDeliveryReview from "../components/delivery/FailedDeliveryReview.jsx";
import { useAnnouncements } from "../store/announcements.js";
import { markAllRead, markRead, timeAgo, useNotifications } from "../store/notifications.js";

const tones = {
  orange: "bg-[#fff0e7] text-[#ff6818]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  red: "bg-[#fff0f0] text-[#d94747]",
};
const tabs = [["all", "All"], ["unread", "Unread"], ["rider", "Riders"], ["seller", "Sellers"], ["delivery", "Deliveries"], ["parcel", "Parcels"], ["system", "System"]];

export default function Notifications() {
  const items = useNotifications();
  const announcements = useAnnouncements();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const unread = items.filter((n) => !n.read).length;

  const list = useMemo(
    () => (tab === "all" ? items : tab === "unread" ? items.filter((n) => !n.read) : items.filter((n) => n.kind === tab)),
    [items, tab]
  );

  return (
    <>
      <Topbar title="Notifications" subtitle={unread ? `You have ${unread} unread notification${unread > 1 ? "s" : ""}.` : "You're all caught up."}>
        <button onClick={markAllRead} disabled={!unread} className={`${btnGhost} disabled:opacity-50`}><i className="fa-solid fa-check-double" /> Mark all as read</button>
      </Topbar>

      {/* Announcements (nasa itaas ng notification table). Dito rin ang link papunta sa pamamahala nito. */}
      <AnnouncementsPanel
        items={announcements.map((a) => ({ id: a.id, title: a.title, text: a.message, ts: a.ts, toRiders: !!a.toRiders, toSellers: !!a.toSellers }))}
        limit={3}
        manageTo="/announcements"
        heading="Announcements"
      />

      {/* Failed deliveries na naghihintay ng desisyon */}
      <FailedDeliveryReview />

      <div className="flex gap-2 flex-wrap mb-5">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${tab === k ? "bg-brand text-white" : "bg-white border border-[#eee] text-[#777] hover:text-brand dark:bg-night-panel dark:border-night-line dark:text-[#d1c9c2]"}`}>
            {l}{k === "unread" && unread > 0 ? ` (${unread})` : ""}
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
              onClick={() => { markRead(n.id); if (n.to) navigate(n.to); }}
              className={`w-full flex items-start gap-4 px-6 py-4 text-left border-b border-[#f3f3f3] last:border-0 hover:bg-[#fff7f2] dark:border-night-line dark:hover:bg-night-head ${n.read ? "" : "bg-[#fffaf7] dark:bg-night-head"}`}
            >
              <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${tones[n.tone] || tones.orange}`}><i className={`fa-solid ${n.icon}`} /></span>
              <span className="flex-1 min-w-0">
                <strong className="block text-[14px]">{n.title}</strong>
                <span className="block text-[13px] text-[#888] mt-0.5">{n.text}</span>
                <small className="block text-[12px] text-[#aaa] mt-1">{timeAgo(n.ts)}</small>
              </span>
              {!n.read && <span className="mt-2 w-2.5 h-2.5 rounded-full bg-brand shrink-0" aria-label="Unread" />}
            </button>
          ))
        )}
      </section>
    </>
  );
}
