import { useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";
import { listParcels } from "../services/parcelService.js";
import { useAnnouncements } from "./announcements.js";
import { useComplaints } from "./records.js";
import { useAssignedParcels } from "./riderDeliveries.js";
import { useFailedDeliveries } from "./failedDeliveries.js";
import { formatDay } from "../utils/format.js";
import { createStore } from "./createStore.js";

// Kumpletong notifications ng Seller at Rider. Iisang hook para sa bell at sa Notifications page.
// Pinagmumulan: mensahe (backend), announcements ng coordinator, sagot sa complaints, at (seller) parcels na kailangan ng aksyon.
// Ang "nabasa na" ay naka-save sa browser kada user.

const readStore = createStore({}, "pt-portal-read");
const uid = () => String(getUser()?.user_id ?? "");

export const markPortalRead = (id) => readStore.set((s) => ({ ...s, [uid()]: { ...(s[uid()] || {}), [id]: 1 } }));
export const markAllPortalRead = (ids) =>
  readStore.set((s) => ({ ...s, [uid()]: { ...(s[uid()] || {}), ...Object.fromEntries(ids.map((i) => [i, 1])) } }));

export function usePortalNotifications(role) {
  const readMap = readStore.use();
  const announcements = useAnnouncements();
  const complaints = useComplaints();
  const assigned = useAssignedParcels();
  const failures = useFailedDeliveries();
  const [remote, setRemote] = useState([]);
  const me = Number(getUser()?.user_id);
  const name = getUser()?.name;

  // Galing sa backend: hindi pa nababasang mensahe + (seller) parcels na reupload/rejected
  const load = useCallback(async () => {
    const next = [];
    try {
      const messages = await listMessages();
      messages
        .filter((m) => Number(m.receiver_id) === me && !m.is_read)
        .forEach((m) =>
          next.push({
            id: `msg:${m.message_id}`,
            kind: "message",
            icon: "fa-message",
            tone: "blue",
            title: `New message from ${m.sender_name || "Coordinator"}`,
            text: String(m.message || "").slice(0, 90),
            ts: new Date(m.created_at).getTime() || Date.now(),
            to: `/${role}/messages`,
          })
        );
      if (role === "seller") {
        const parcels = await listParcels();
        parcels
          .filter((p) => ["REUPLOAD_REQUESTED", "REJECTED"].includes(p.status))
          .forEach((p) =>
            next.push({
              id: `parcel:${p.parcel_id}:${p.status}`,
              kind: "parcel",
              icon: p.status === "REJECTED" ? "fa-ban" : "fa-rotate-left",
              tone: p.status === "REJECTED" ? "red" : "orange",
              title: p.status === "REJECTED" ? "Parcel rejected" : "Reupload requested",
              text: p.transaction_number || p.parcel_id,
              ts: new Date(p.updated_at || p.created_at).getTime() || Date.now(),
              to: `/seller/scan?txn=${encodeURIComponent(p.transaction_number || p.parcel_id)}`,
            })
          );
      }
    } catch {
      /* tahimik lang: hindi dapat masira ang header kapag may error */
    }
    setRemote(next);
  }, [me, role]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const items = useMemo(() => {
    const mine = readMap[uid()] || {};
    const list = [...remote];

    announcements
      .filter((a) => (role === "rider" ? a.toRiders : a.toSellers))
      .forEach((a) =>
        list.push({ id: `an:${a.id}`, kind: "announcement", icon: "fa-bullhorn", tone: "orange", title: a.title, text: a.message, ts: a.ts, to: `/${role}/notifications` })
      );

    // Sagot ng coordinator sa mga complaint/request ng user na ito
    complaints
      .filter((c) => c.userId === me || (!c.userId && c.from === name && c.role?.toLowerCase() === role))
      .filter((c) => c.status !== "Open" || c.notes?.length)
      .forEach((c) =>
        list.push({
          id: `cp:${c.id}:${c.status}:${c.notes?.length || 0}`,
          kind: "complaint",
          icon: c.status === "Resolved" ? "fa-circle-check" : "fa-headset",
          tone: c.status === "Resolved" ? "green" : "purple",
          title: `${c.id} is ${c.status.toLowerCase()}`,
          text: c.notes?.length ? c.notes[c.notes.length - 1] : c.subject,
          ts: c.updatedAt || c.createdAt || Date.now(),
          to: `/${role}/complaints`,
        })
      );

    // Desisyon ng coordinator sa failed delivery ng rider na ito (reschedule bukas o hindi)
    if (role === "rider") {
      failures
        .filter((f) => f.rider_id === me && (f.status === "confirmed" || f.status === "declined"))
        .forEach((f) => {
          const ok = f.status === "confirmed";
          list.push({
            id: `fdr:${f.id}:${f.status}`,
            kind: "parcel",
            icon: ok ? "fa-calendar-check" : "fa-calendar-xmark",
            tone: ok ? "green" : "red",
            title: ok ? `Delivery rescheduled for ${formatDay(f.scheduledFor)}` : "Reschedule not approved",
            text: ok ? `${f.transaction_number} is back in To Be Delivered.` : `${f.transaction_number}${f.decisionNote ? ` · ${f.decisionNote}` : ""}`,
            ts: f.decidedAt || f.failedAt,
            to: ok ? "/rider/deliveries" : "/rider/deliveries?tab=failed",
          });
        });
    }

    if (role === "rider" && assigned.length) {
      list.push({
        id: `assigned:${assigned.map((a) => a.parcel_id).join(",")}`,
        kind: "parcel",
        icon: "fa-box",
        tone: "orange",
        title: `${assigned.length} parcel${assigned.length > 1 ? "s" : ""} waiting to be scanned`,
        text: "Assigned to you by the coordinator.",
        ts: Math.max(...assigned.map((a) => new Date(a.updated_at).getTime())),
        to: "/rider",
      });
    }

    return list.map((n) => ({ ...n, read: !!mine[n.id] })).sort((a, b) => b.ts - a.ts);
  }, [remote, announcements, complaints, assigned, failures, readMap, role, me, name]);

  // Ang announcements ng Coordinator ay laging nasa pinakaitaas; ang regular na notifications ay nasa ilalim.
  const pinned = useMemo(() => items.filter((n) => n.kind === "announcement"), [items]);
  const regular = useMemo(() => items.filter((n) => n.kind !== "announcement"), [items]);

  return {
    items: [...pinned, ...regular],
    announcements: pinned,
    notifications: regular,
    unread: items.filter((n) => !n.read).length,
    reload: load,
  };
}
