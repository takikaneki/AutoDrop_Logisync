import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState } from "../components/ui.jsx";
import { btnGhost, panel } from "../components/styles.js";
import FailedDeliveryReview from "../components/delivery/FailedDeliveryReview.jsx";
import {
  markAllRead,
  markRead,
  syncCoordinatorNotificationsFromServer,
  timeAgo,
  useCoordinatorNotificationSyncState,
  useNotifications,
} from "../store/notifications.js";
import { useNetworkStatus, useReconnectRefresh } from "../utils/network.js";
import {
  CachedDataNotice,
  NotificationListSkeleton,
  OfflineState,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 10;

const tones = {
  orange: "bg-[#fff0e7] text-[#d9482b]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  red: "bg-[#fff0f0] text-[#d94747]",
};
const tabs = [
  ["all", "All"],
  ["unread", "Unread"],
  ["emergency", "Emergency"],
  ["rescheduled", "Rescheduled"],
  ["return_to_hub", "Return to Hub"],
  ["delivery", "Deliveries"],
  ["parcel", "Parcels"],
  ["system", "System"],
];

function compactNotifText(text = "") {
  return String(text || "")
    .replace(/\s*\(\[object Object\]\)/g, "")
    .replace(/remained undelivered after the \d+-day rescheduling limit and must be returned to the hub\.?/i, "Attempt limit reached · Return to Hub")
    .replace(/reached the \d+-attempt limit and must be returned to the hub\.?/i, "Attempt limit reached · Return to Hub")
    .trim();
}

export default function Notifications() {
  const items = useNotifications();
  const syncState = useCoordinatorNotificationSyncState();
  const { online } = useNetworkStatus();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    syncCoordinatorNotificationsFromServer();
  }, []);
  useReconnectRefresh(syncCoordinatorNotificationsFromServer);

  const loading = online && syncState.syncing && items.length === 0;
  const offlineEmpty = !online && items.length === 0 && !syncState.syncedOnce;
  const showCachedNotice = !online && items.length > 0;
  const unread = items.filter((n) => !n.read).length;
  const emergencyUnread = items.filter(
    (n) => !n.read && (n.kind === "emergency" || n.category === "emergency")
  ).length;

  const list = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "unread") return items.filter((n) => !n.read);
    if (tab === "emergency") {
      return items.filter((n) => n.kind === "emergency" || n.category === "emergency");
    }
    if (tab === "rescheduled") {
      return items.filter((n) => /reschedul/i.test(`${n.title || ""} ${n.text || ""}`));
    }
    if (tab === "return_to_hub") {
      return items.filter((n) => /return to hub/i.test(`${n.title || ""} ${n.text || ""}`));
    }
    if (tab === "delivery") {
      return items.filter(
        (n) =>
          n.kind === "delivery" ||
          n.kind === "rider" ||
          /deliver|reschedul|return to hub|rider/i.test(`${n.title || ""} ${n.text || ""}`)
      );
    }
    if (tab === "parcel") {
      return items.filter(
        (n) =>
          n.kind === "parcel" ||
          n.category === "parcel" ||
          n.category === "verification" ||
          /parcel|video|verif/i.test(`${n.title || ""} ${n.text || ""}`)
      );
    }
    if (tab === "system") {
      return items.filter(
        (n) =>
          n.kind === "system" ||
          n.category === "messages" ||
          n.category === "announcements"
      );
    }
    return items.filter((n) => n.kind === tab);
  }, [items, tab]);

  return (
    <>
      <Topbar title="Notifications" subtitle={unread ? `You have ${unread} unread notification${unread > 1 ? "s" : ""}.` : "You're all caught up."} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(([k, l]) => {
            const isEmergencyTab = k === "emergency";
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition ${
                  active
                    ? isEmergencyTab
                      ? "bg-[#dc2626] text-white shadow-xs"
                      : "bg-brand text-white shadow-xs"
                    : isEmergencyTab && emergencyUnread > 0
                      ? "bg-[#fef2f2] border border-[#fca5a5] text-[#dc2626] hover:bg-[#fee2e2] dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
                      : "bg-white border border-[#e5e8ee] text-[#64748b] hover:border-brand hover:text-brand dark:bg-night-panel dark:border-night-line dark:text-[#d1c9c2]"
                }`}
              >
                {l}
                {k === "unread" && unread > 0 ? ` (${unread})` : ""}
                {isEmergencyTab && emergencyUnread > 0 ? ` (${emergencyUnread})` : ""}
              </button>
            );
          })}
        </div>
        <button onClick={markAllRead} disabled={!unread} className={`${btnGhost} !py-2 disabled:opacity-50`}>
          <Icon name="check-check" /> Mark all as read
        </button>
      </div>

      {/* Rescheduled & Return-to-Hub review panel (only shown under their dedicated filter tabs) */}
      {(tab === "rescheduled" || tab === "return_to_hub") && <FailedDeliveryReview mode={tab} />}

      {showCachedNotice && <CachedDataNotice updatedAt={syncState.lastSyncedAt} />}

      <section className={`${panel} h-[calc(100vh-305px)] min-h-[360px] max-h-[560px] overflow-y-auto`}>
        {loading ? (
          <NotificationListSkeleton count={6} />
        ) : offlineEmpty ? (
          <div className="p-6">
            <OfflineState
              title="Notifications unavailable offline"
              text="Reconnect to fetch your latest hub alerts."
              onRetry={syncCoordinatorNotificationsFromServer}
            />
          </div>
        ) : list.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon="bell-off" title="No notifications here" />
          </div>
        ) : (
          list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((n) => {
            const isEmergency = n.kind === "emergency" || n.category === "emergency";
            return (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); if (n.to) navigate(n.to); }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 text-left border-b border-[#edf0f4] last:border-0 dark:border-night-line ${
                  isEmergency
                    ? "border-l-4 border-l-[#dc2626] bg-[#fef2f2]/90 hover:bg-[#fee2e2]/80 dark:bg-red-950/35 dark:hover:bg-red-950/50"
                    : `hover:bg-[#fff7f2] dark:hover:bg-night-head ${n.read ? "" : "bg-[#fffaf7] dark:bg-night-head/60"}`
                }`}
              >
                <span
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[14px] ${
                    isEmergency ? "bg-[#dc2626] text-white shadow-xs" : tones[n.tone] || tones.orange
                  }`}
                >
                  <Icon name={isEmergency ? "triangle-alert" : n.icon} />
                </span>
                <span className="flex-1 min-w-0">
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
                  <span className={`block truncate text-[12.5px] mt-0.5 ${isEmergency ? "text-[#7f1d1d] dark:text-red-200/80" : "text-[#64748b] dark:text-[#b8b0a8]"}`}>
                    {compactNotifText(n.text)}
                  </span>
                </span>
                {!n.read && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${isEmergency ? "bg-[#dc2626]" : "bg-brand"}`}
                    aria-label="Unread"
                  />
                )}
              </button>
            );
          })
        )}
      </section>
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
    </>
  );
}
