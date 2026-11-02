import { useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "../api.js";
import { listMessages } from "../services/messageService.js";
import { listParcels } from "../services/parcelService.js";
import { useAnnouncements } from "./announcements.js";
import { useComplaints } from "./records.js";
import { MAX_RESCHEDULES, STAGE, useAllDeliveries, useAssignedParcels, useMyDeliveries } from "./riderDeliveries.js";
import { useFailedDeliveries } from "./failedDeliveries.js";
import { formatDay } from "../utils/format.js";
import { createStore } from "./createStore.js";

// Kumpletong notifications ng Seller at Rider. Iisang hook para sa bell at sa Notifications page.
// Pinagmumulan: mensahe (backend), announcements ng coordinator, sagot sa complaints,
// automatic/manual delivery reschedules (max 3 days), at Return to Hub status.

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
  const myDeliveries = useMyDeliveries();
  const allDeliveries = useAllDeliveries();
  const failures = useFailedDeliveries();
  const [remote, setRemote] = useState([]);
  const [sellerParcelKeys, setSellerParcelKeys] = useState([]);
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
        setSellerParcelKeys(
          parcels.flatMap((p) => [String(p.parcel_id || "").toLowerCase(), String(p.transaction_number || "").toLowerCase()]).filter(Boolean)
        );
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

    // Notifications para sa Rider kapag may bagong delivery date na in-assign o naging Return to Hub
    if (role === "rider") {
      myDeliveries.forEach((d) => {
        const txn = d.transaction_number || d.parcel_id;
        if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB) {
          list.push({
            id: `rth-rider:${d.parcel_id}:${d.returnCoordinated ? "coord" : "hub"}`,
            kind: "parcel",
            icon: "fa-warehouse",
            tone: "red",
            title: `Return to Hub: ${txn}`,
            text: d.returnCoordinated
              ? `Maximum ${MAX_RESCHEDULES}-day rescheduling limit reached. Coordinator is coordinating return to seller (${d.seller || "Seller"}).`
              : `${txn} (${d.receiver || "Customer"}) remained undelivered after the ${MAX_RESCHEDULES}-day rescheduling period and was removed from your pending deliveries. Please return it to the hub.`,
            ts: d.returnCoordinatedAt || d.returnToHubAt || d.doneAt || Date.now(),
            to: "/rider/deliveries?tab=failed",
          });
        } else if (d.rescheduled && d.stage === STAGE.TO_DELIVER) {
          const dayNum = Number(d.rescheduleCount || 1);
          list.push({
            id: `resched-rider:${d.parcel_id}:${dayNum}:${d.scheduledFor}`,
            kind: "parcel",
            icon: "fa-calendar-check",
            tone: "orange",
            title: `New delivery date assigned: ${formatDay(d.scheduledFor)} (Day ${dayNum} of ${MAX_RESCHEDULES})`,
            text: `${txn} · ${d.receiver || "Customer"} — ${d.lastFailure || "Scheduled for next available delivery day"}.`,
            ts: d.lastRescheduledAt || d.scannedAt || Date.now(),
            to: "/rider/deliveries",
          });
        }
      });
    }

    // Notifications para sa Seller kapag na-reschedule o naging Return to Hub ang parcel niya
    if (role === "seller") {
      const sellerKeySet = new Set(sellerParcelKeys);
      const sellerNameLower = String(name || "").trim().toLowerCase();
      allDeliveries
        .filter((d) => {
          const pid = String(d.parcel_id || "").toLowerCase();
          const txn = String(d.transaction_number || "").toLowerCase();
          const shop = String(d.seller || "").trim().toLowerCase();
          return sellerKeySet.has(pid) || sellerKeySet.has(txn) || (sellerNameLower && shop === sellerNameLower);
        })
        .forEach((d) => {
          const txn = d.transaction_number || d.parcel_id;
          if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB) {
            list.push({
              id: `rth-seller:${d.parcel_id}:${d.returnCoordinated ? "coord" : "hub"}`,
              kind: "parcel",
              icon: d.returnCoordinated ? "fa-rotate-left" : "fa-warehouse",
              tone: d.returnCoordinated ? "blue" : "red",
              title: d.returnCoordinated
                ? `Return to Seller Coordinated: ${txn}`
                : `Parcel Marked Return to Hub: ${txn}`,
              text: d.returnCoordinated
                ? `Coordinator is returning ${txn} (${d.receiver || "Customer"}) to you after reaching the ${MAX_RESCHEDULES}-day delivery limit.`
                : `${txn} (${d.receiver || "Customer"}) remained undelivered after ${MAX_RESCHEDULES} rescheduled days and is being returned to the hub.`,
              ts: d.returnCoordinatedAt || d.returnToHubAt || d.doneAt || Date.now(),
              to: `/seller/scan?txn=${encodeURIComponent(txn)}`,
            });
          } else if (d.rescheduled && d.stage === STAGE.TO_DELIVER) {
            const dayNum = Number(d.rescheduleCount || 1);
            list.push({
              id: `resched-seller:${d.parcel_id}:${dayNum}:${d.scheduledFor}`,
              kind: "parcel",
              icon: "fa-calendar-day",
              tone: "orange",
              title: `Delivery Rescheduled (Day ${dayNum}/${MAX_RESCHEDULES}): ${txn}`,
              text: `${d.receiver || "Customer"} · New delivery date: ${formatDay(d.scheduledFor)} (${d.lastFailure || "Delivery attempt failed"}).`,
              ts: d.lastRescheduledAt || d.scannedAt || Date.now(),
              to: `/seller/scan?txn=${encodeURIComponent(txn)}`,
            });
          }
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
  }, [remote, announcements, complaints, assigned, myDeliveries, allDeliveries, sellerParcelKeys, failures, readMap, role, me, name]);

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
