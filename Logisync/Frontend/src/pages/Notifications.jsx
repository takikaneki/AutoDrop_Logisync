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
  useNotifications,
} from "../store/notifications.js";
import Icon from "../components/Icon.jsx";

const tones = {
  orange: "bg-[#fff0e7] text-[#ff6818]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  red: "bg-[#fff0f0] text-[#d94747]",
};
const tabs = [
  ["all", "All"],
  ["unread", "Unread"],
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
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");

  useEffect(() => {
    syncCoordinatorNotificationsFromServer();
  }, []);
  const unread = items.filter((n) => !n.read).length;

  const list = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "unread") return items.filter((n) => !n.read);
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
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${tab === k ? "bg-brand text-white shadow-xs" : "bg-white border border-[#e5e8ee] text-[#64748b] hover:border-brand hover:text-brand dark:bg-night-panel dark:border-night-line dark:text-[#d1c9c2]"}`}>
              {l}{k === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>
        <button onClick={markAllRead} disabled={!unread} className={`${btnGhost} !py-2 disabled:opacity-50`}>
          <Icon name="check-check" /> Mark all as read
        </button>
      </div>

      {/* Rescheduled & Return-to-Hub review panel (only shown under their dedicated filter tabs) */}
      {(tab === "rescheduled" || tab === "return_to_hub") && <FailedDeliveryReview mode={tab} />}

      <section className={`${panel} h-[calc(100vh-260px)] min-h-[380px] overflow-y-auto`}>
        {list.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon="bell-off" title="No notifications here" />
          </div>
        ) : (
          list.map((n) => (
            <button
              key={n.id}
              onClick={() => { markRead(n.id); if (n.to) navigate(n.to); }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 text-left border-b border-[#edf0f4] last:border-0 hover:bg-[#fff7f2] dark:border-night-line dark:hover:bg-night-head ${n.read ? "" : "bg-[#fffaf7] dark:bg-night-head/60"}`}
            >
              <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[14px] ${tones[n.tone] || tones.orange}`}><Icon name={n.icon} /></span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <strong className="truncate text-[14px]">{n.title}</strong>
                  <small className="shrink-0 text-[11.5px] text-[#94a3b8]">{timeAgo(n.ts)}</small>
                </span>
                <span className="block truncate text-[12.5px] text-[#64748b] dark:text-[#b8b0a8] mt-0.5">
                  {compactNotifText(n.text)}
                </span>
              </span>
              {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" aria-label="Unread" />}
            </button>
          ))
        )}
      </section>
    </>
  );
}
