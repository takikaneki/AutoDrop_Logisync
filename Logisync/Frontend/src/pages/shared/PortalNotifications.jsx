import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import AnnouncementsPanel from "../../components/AnnouncementsPanel.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { btnGhost, panel } from "../../components/styles.js";
import useBase from "../../hooks/useBase.js";
import { timeAgo } from "../../store/notifications.js";
import { markAllPortalRead, markPortalRead, usePortalNotifications } from "../../store/portalNotifications.js";
import { useNetworkStatus } from "../../utils/network.js";
import {
  CachedDataNotice,
  NotificationListSkeleton,
  OfflineState,
} from "../../components/Skeletons.jsx";
import Icon from "../../components/Icon.jsx";

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
  const { online } = useNetworkStatus();
  const { items, announcements, notifications, unread, loading, syncedOnce, lastSyncedAt, reload } = usePortalNotifications(role);
  const [tab, setTab] = useState("all");
  const offlineEmpty = !online && items.length === 0 && !syncedOnce;
  const showCachedNotice = !online && items.length > 0;

  const tabs = [
    ["all", "All"],
    ["unread", "Unread"],
    ["emergency", "Emergency"],
    ["message", "Messages"],
    ["parcel", "Parcels"],
  ];
  const list = useMemo(
    () => (tab === "all" ? notifications : tab === "unread" ? notifications.filter((n) => !n.read) : notifications.filter((n) => n.kind === tab)),
    [notifications, tab]
  );

  return (
    <>
      <Topbar title="Notifications" subtitle={unread ? `You have ${unread} unread update${unread > 1 ? "s" : ""}, including announcements.` : "You're all caught up."} />

      {showCachedNotice && <CachedDataNotice updatedAt={lastSyncedAt} />}

      {/* ANNOUNCEMENTS NG COORDINATOR (laging nasa itaas) */}
      <AnnouncementsPanel items={announcements} onOpen={(a) => markPortalRead(a.id)} />

      {/* REGULAR NA NOTIFICATIONS */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${tab === k ? "bg-brand text-white shadow-xs" : "border border-[#e5e8ee] bg-white text-[#64748b] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"}`}
            >
              {l}{k === "unread" && notifications.filter((n) => !n.read).length > 0 ? ` (${notifications.filter((n) => !n.read).length})` : ""}
            </button>
          ))}
        </div>
        <button onClick={() => markAllPortalRead(items.map((n) => n.id))} disabled={!unread} className={`${btnGhost} !py-2 disabled:opacity-50`}>
          <Icon name="check-check" /> Mark all as read
        </button>
      </div>

      <section className={`${panel} h-[calc(100vh-260px)] min-h-[380px] overflow-y-auto`}>
        {loading ? (
          <NotificationListSkeleton count={6} />
        ) : offlineEmpty ? (
          <div className="p-6">
            <OfflineState
              title="Notifications unavailable offline"
              text="Reconnect to the internet to check for new updates and announcements."
              onRetry={reload}
            />
          </div>
        ) : list.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon="bell-off" title="No notifications here" />
          </div>
        ) : (
          list.map((n) => {
            const isEmergency = n.kind === "emergency" || n.category === "emergency";
            return (
              <button
                key={n.id}
                onClick={() => { markPortalRead(n.id); if (n.to) navigate(n.to); }}
                className={`flex w-full items-center gap-4 border-b border-[#edf0f4] px-5 py-3.5 text-left last:border-0 dark:border-night-line ${
                  isEmergency
                    ? "border-l-4 border-l-[#dc2626] bg-[#fef2f2]/85 hover:bg-[#fee2e2]/80 dark:bg-red-950/35 dark:hover:bg-red-950/50"
                    : `hover:bg-[#fff7f2] dark:hover:bg-night-head ${n.read ? "" : "bg-[#fffaf7] dark:bg-night-head/60"}`
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] ${
                    isEmergency ? "bg-[#dc2626] text-white" : tones[n.tone] || tones.orange
                  }`}
                >
                  <Icon name={n.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {isEmergency && (
                        <span className="shrink-0 rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          Emergency
                        </span>
                      )}
                      <strong className={`truncate text-[14px] ${isEmergency ? "text-[#991b1b] dark:text-red-200" : ""}`}>
                        {n.title}
                      </strong>
                    </span>
                    <small className="shrink-0 text-[11.5px] text-[#94a3b8]">{timeAgo(n.ts)}</small>
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">{n.text}</span>
                </span>
                {!n.read && (
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${isEmergency ? "bg-[#dc2626]" : "bg-brand"}`}
                    aria-label="Unread"
                  />
                )}
              </button>
            );
          })
        )}
      </section>
    </>
  );
}
