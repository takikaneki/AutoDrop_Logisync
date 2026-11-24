import { useCallback, useEffect, useMemo, useState } from "react";
import { getRole, getUser } from "../api.js";
import { fetchComplaints } from "../services/complaintService.js";
import { fetchMyRiderParcels } from "../services/deliveryService.js";
import { listMessages } from "../services/messageService.js";
import { listParcels } from "../services/parcelService.js";
import { filterAnnouncementsForRole, syncAnnouncementsFromServer, useAnnouncements } from "./announcements.js";
import { useComplaints } from "./records.js";
import { MAX_RESCHEDULES, STAGE, useAssignedParcels, useMyDeliveries } from "./riderDeliveries.js";
import { formatDay } from "../utils/format.js";
import { isOnline, readViewCache, useReconnectRefresh, writeViewCache } from "../utils/network.js";
import { createStore } from "./createStore.js";

// Role-Based at Owner-Isolated Notifications para sa Seller at Rider:
// - SELLER:
//   1. Announcements na naka-target sa Sellers (toSellers === true).
//   2. Sariling parcels lang (seller_id === me): Video Verification status (VERIFIED / REUPLOAD_REQUESTED / REJECTED),
//      Return to Hub (RTH), at Delivered status. (HINDI kasama ang Rider last-mile Delivery Rescheduled attempts).
//   3. Sagot / status update ng Coordinator sa sariling Complaints / Requests ng Seller.
//   4. Unread Direct Messages para sa Seller.
// - RIDER:
//   1. Announcements na naka-target sa Riders (toRiders === true).
//   2. Sariling assigned/scanned parcels lang (rider_id === me): Assigned parcels, Delivery Rescheduled (Day 1/2),
//      Return to Hub (RTH), at Delivery Hold.
//   3. Sagot / status update ng Coordinator sa sariling Complaints / Urgent Requests ng Rider.
//   4. Unread Direct Messages para sa Rider.

const readStore = createStore({}, "pt-portal-read");
const uid = () => String(getUser()?.user_id ?? "");

export const markPortalRead = (id) =>
  readStore.set((s) => ({ ...s, [uid()]: { ...(s[uid()] || {}), [id]: 1 } }));

export const markAllPortalRead = (ids) =>
  readStore.set((s) => ({
    ...s,
    [uid()]: { ...(s[uid()] || {}), ...Object.fromEntries(ids.map((i) => [i, 1])) },
  }));

function extractNoteText(note) {
  if (!note) return "";
  if (typeof note === "string") return note.trim();
  if (typeof note === "object") return String(note.text || note.note || note.message || "").trim();
  return String(note).trim();
}

function parseNotesList(rawNotes) {
  if (Array.isArray(rawNotes)) return rawNotes;
  if (typeof rawNotes === "string" && rawNotes.trim()) {
    try {
      const parsed = JSON.parse(rawNotes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export function usePortalNotifications(roleProp) {
  const activeRole = String(roleProp || getRole() || "").trim().toLowerCase();
  const readMap = readStore.use();
  const rawAnnouncements = useAnnouncements(activeRole);
  const localComplaints = useComplaints();
  const assigned = useAssignedParcels();
  const myDeliveries = useMyDeliveries();
  const cachedRemote = useMemo(
    () => (activeRole ? readViewCache(`portal-notifs-${activeRole}`) : null),
    [activeRole]
  );
  const [remote, setRemote] = useState(() =>
    Array.isArray(cachedRemote?.data) ? cachedRemote.data : []
  );
  const [serverRiderParcels, setServerRiderParcels] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(isOnline() && !cachedRemote?.data));
  const [syncedOnce, setSyncedOnce] = useState(() => Boolean(cachedRemote?.data));
  const [lastSyncedAt, setLastSyncedAt] = useState(() => cachedRemote?.updatedAt || null);
  const me = Number(getUser()?.user_id);
  const name = getUser()?.name;

  const load = useCallback(async () => {
    if (!me || (activeRole !== "seller" && activeRole !== "rider")) {
      setRemote([]);
      setLoading(false);
      return;
    }
    if (!isOnline()) {
      setLoading(false);
      return;
    }

    const next = [];
    try {
      await syncAnnouncementsFromServer();

      // 1. Direct Messages para lang sa naka-login na user (receiver_id === me)
      const messages = await listMessages().catch(() => []);
      if (Array.isArray(messages)) {
        messages
          .filter((m) => Number(m.receiver_id) === me && !m.is_read)
          .forEach((m) =>
            next.push({
              id: `msg:${m.message_id}`,
              kind: "message",
              icon: "message-circle",
              tone: "blue",
              title: `New message from ${m.sender_name || "Coordinator"}`,
              text: String(m.message || "").slice(0, 90),
              ts: new Date(m.created_at).getTime() || Date.now(),
              to: `/${activeRole}/messages`,
            })
          );
      }

      // 2. Complaints / Requests updates mula sa PostgreSQL backend para lang sa user na ito
      const dbComplaints = await fetchComplaints().catch(() => []);
      if (Array.isArray(dbComplaints)) {
        dbComplaints
          .filter((c) => {
            const ownerId = Number(c.user_id ?? c.userId);
            const cRole = String(c.complainant_role || c.role || "").trim().toLowerCase();
            if (ownerId) return ownerId === me;
            return cRole === activeRole && String(c.complainant_name || c.from || "").trim() === String(name || "").trim();
          })
          .forEach((c) => {
            const ticketId = c.complaint_id ? `C-${c.complaint_id}` : String(c.id || "C-0");
            const status = String(c.status || "Open");
            const notes = parseNotesList(c.notes);
            if (status === "Open" && notes.length === 0) return;

            const lastNoteText = notes.length > 0 ? extractNoteText(notes[notes.length - 1]) : "";
            next.push({
              id: `cp:${ticketId}:${status}:${notes.length}`,
              kind: "complaint",
              icon: status === "Resolved" ? "circle-check" : "headset",
              tone: status === "Resolved" ? "green" : "purple",
              title: notes.length > 0 && status === "Open"
                ? `Coordinator replied to ${ticketId}`
                : `${ticketId} is ${status.toLowerCase()}`,
              text: lastNoteText || String(c.subject || "Complaint update"),
              ts: new Date(c.updated_at || c.updatedAt || c.created_at || c.createdAt || Date.now()).getTime() || Date.now(),
              to: `/${activeRole}/complaints`,
            });
          });
      }

      // 3. SELLER: Sariling parcels lang mula sa backend (verification, RTH, delivered — WALANG rider reschedule spam)
      if (activeRole === "seller") {
        const parcels = await listParcels().catch(() => []);
        if (Array.isArray(parcels)) {
          parcels
            .filter((p) => !p.seller_id || Number(p.seller_id) === me)
            .forEach((p) => {
              const txn = p.transaction_number || p.parcel_id;
              const rawVerif = String(p.raw_status || p.verification_status || p.status || "").toUpperCase();
              const delivStatus = String(p.delivery_status || p.status || "").toUpperCase();
              const isRthConfirmed =
                p.rth_status === "CONFIRMED" ||
                p.status === "RTH_CONFIRMED" ||
                Boolean(p.rth_confirmed_at) ||
                Boolean(p.return_coordinated);
              const isRthPending =
                !isRthConfirmed &&
                (Boolean(p.return_to_hub) ||
                  delivStatus === "RETURN_TO_HUB" ||
                  p.status === "RETURN_TO_HUB" ||
                  p.rth_status === "PENDING" ||
                  p.rth_status === "PENDING_CONFIRMATION");

              // Verification notifications (Rejected / Reupload Requested / Verified)
              if (rawVerif === "REJECTED" || rawVerif === "REUPLOAD_REQUESTED") {
                next.push({
                  id: `parcel:${p.parcel_id}:${rawVerif}`,
                  kind: "parcel",
                  icon: rawVerif === "REJECTED" ? "circle-x" : "undo-2",
                  tone: rawVerif === "REJECTED" ? "red" : "orange",
                  title: rawVerif === "REJECTED" ? `Parcel rejected: ${txn}` : `Video re-upload requested: ${txn}`,
                  text: p.verification_remarks || `${p.receiver_name || "Customer"} · Tap to review and re-upload packing video.`,
                  ts: new Date(p.updated_at || p.created_at).getTime() || Date.now(),
                  to: `/seller/scan?txn=${encodeURIComponent(txn)}`,
                });
              } else if (rawVerif === "VERIFIED" && !isRthConfirmed && !isRthPending && delivStatus !== "DELIVERED") {
                next.push({
                  id: `parcel:${p.parcel_id}:VERIFIED`,
                  kind: "parcel",
                  icon: "circle-check",
                  tone: "green",
                  title: `Parcel verified: ${txn}`,
                  text: `${p.receiver_name || "Customer"} · Packing video approved and ready for rider dispatch.`,
                  ts: new Date(p.updated_at || p.created_at).getTime() || Date.now(),
                  to: `/seller/parcels`,
                });
              }

              // Return to Hub (RTH) notifications para sa Seller
              if (isRthConfirmed) {
                next.push({
                  id: `rth-seller:${p.parcel_id}:confirmed`,
                  kind: "parcel",
                  icon: "undo-2",
                  tone: "red",
                  title: `Return to Hub Confirmed: ${txn}`,
                  text:
                    p.rth_confirmed_notes ||
                    p.rth_reason ||
                    `${txn} (${p.receiver_name || "Customer"}) has been confirmed at the hub for return to seller.`,
                  ts: new Date(p.rth_confirmed_at || p.return_to_hub_at || p.updated_at || Date.now()).getTime() || Date.now(),
                  to: `/seller/parcels`,
                });
              } else if (isRthPending) {
                next.push({
                  id: `rth-seller:${p.parcel_id}:pending`,
                  kind: "parcel",
                  icon: "undo-2",
                  tone: "red",
                  title: `Parcel Marked Return to Hub: ${txn}`,
                  text:
                    p.rth_reason ||
                    p.last_failure ||
                    `${txn} (${p.receiver_name || "Customer"}) is being returned to the hub.`,
                  ts: new Date(p.rth_requested_at || p.return_to_hub_at || p.updated_at || Date.now()).getTime() || Date.now(),
                  to: `/seller/parcels`,
                });
              } else if (delivStatus === "DELIVERED" || p.status === "DELIVERED") {
                next.push({
                  id: `delivered-seller:${p.parcel_id}`,
                  kind: "parcel",
                  icon: "package-check",
                  tone: "green",
                  title: `Parcel Delivered: ${txn}`,
                  text: `${p.receiver_name || "Customer"} received the parcel.`,
                  ts: new Date(p.delivered_at || p.updated_at || Date.now()).getTime() || Date.now(),
                  to: `/seller/parcels`,
                });
              }
            });
        }
      }

      // 4. RIDER: Sync sariling rider parcels mula sa server
      if (activeRole === "rider") {
        const mineRes = await fetchMyRiderParcels().catch(() => null);
        if (Array.isArray(mineRes?.parcels)) {
          setServerRiderParcels(
            mineRes.parcels.filter((p) => !p.rider_id || Number(p.rider_id) === me)
          );
        }
      }
    } catch {
      /* keep header bell resilient */
    }
    setRemote(next);
    writeViewCache(`portal-notifs-${activeRole}`, next);
    setLastSyncedAt(Date.now());
    setSyncedOnce(true);
    setLoading(false);
  }, [me, activeRole, name]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useReconnectRefresh(load);

  const items = useMemo(() => {
    if (activeRole !== "seller" && activeRole !== "rider") return [];
    const mine = readMap[uid()] || {};
    const byId = new Map();
    const pushUnique = (item) => {
      if (!item?.id) return;
      byId.set(item.id, item);
    };

    remote.forEach(pushUnique);

    // Strictly role-filtered announcements
    const roleAnnouncements = filterAnnouncementsForRole(rawAnnouncements, activeRole);
    roleAnnouncements
      .filter((a) => (activeRole === "rider" ? a.toRiders === true : a.toSellers === true))
      .forEach((a) =>
        pushUnique({
          id: `an:${a.id}`,
          kind: "announcement",
          icon: "megaphone",
          tone: "orange",
          title: a.title,
          text: a.message,
          ts: a.ts,
          to: `/${activeRole}/notifications`,
        })
      );

    // Fallback local complaints (strictly filtered by userId === me and activeRole)
    localComplaints
      .filter((c) => {
        const ownerId = Number(c.user_id ?? c.userId);
        const cRole = String(c.complainant_role || c.role || "").trim().toLowerCase();
        if (ownerId) return ownerId === me;
        return cRole === activeRole && String(c.from || "").trim() === String(name || "").trim();
      })
      .filter((c) => c.status !== "Open" || (Array.isArray(c.notes) && c.notes.length > 0))
      .forEach((c) => {
        const notes = parseNotesList(c.notes);
        const ticketId = c.complaint_id ? `C-${c.complaint_id}` : String(c.id || "C-0");
        const key = `cp:${ticketId}:${c.status}:${notes.length}`;
        if (byId.has(key)) return;
        const lastNoteText = notes.length > 0 ? extractNoteText(notes[notes.length - 1]) : "";
        pushUnique({
          id: key,
          kind: "complaint",
          icon: c.status === "Resolved" ? "circle-check" : "headset",
          tone: c.status === "Resolved" ? "green" : "purple",
          title: `${ticketId} is ${String(c.status || "updated").toLowerCase()}`,
          text: lastNoteText || String(c.subject || "Complaint update"),
          ts: c.updatedAt || c.createdAt || Date.now(),
          to: `/${activeRole}/complaints`,
        });
      });

    // RIDER-ONLY parcel delivery, reschedule, Return to Hub, and hold notifications
    if (activeRole === "rider") {
      // Merge serverRiderParcels + local myDeliveries owned by this rider
      const riderItems = [...myDeliveries.filter((d) => !d.user_id || Number(d.user_id) === me)];
      const seenParcelKeys = new Set(
        riderItems.flatMap((d) => [
          String(d.parcel_id || "").toLowerCase(),
          String(d.transaction_number || "").toLowerCase(),
        ]).filter(Boolean)
      );

      serverRiderParcels.forEach((p) => {
        const pid = String(p.parcel_id || "").toLowerCase();
        const txn = String(p.transaction_number || "").toLowerCase();
        if ((pid && seenParcelKeys.has(pid)) || (txn && seenParcelKeys.has(txn))) return;
        riderItems.push({
          user_id: me,
          parcel_id: p.parcel_id,
          transaction_number: p.transaction_number || p.parcel_id,
          receiver: p.receiver_name || p.receiver,
          seller: p.seller_name || p.seller,
          returnToHub: Boolean(p.return_to_hub || p.delivery_status === "RETURN_TO_HUB" || p.rth_status),
          returnCoordinated: Boolean(p.return_coordinated || p.rth_confirmed_at),
          rescheduled: Boolean(p.rescheduled),
          rescheduleCount: Number(p.reschedule_count || 1),
          scheduledFor: p.scheduled_for,
          lastFailure: p.last_failure || p.delivery_note,
          delivery_hold: Boolean(p.delivery_hold),
          delivery_hold_reason: p.delivery_hold_reason,
          stage:
            p.delivery_status === "DELIVERED"
              ? STAGE.DELIVERED
              : p.return_to_hub || p.delivery_status === "RETURN_TO_HUB"
                ? STAGE.RETURN_TO_HUB
                : STAGE.TO_DELIVER,
          scannedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
        });
      });

      riderItems.forEach((d) => {
        const txn = d.transaction_number || d.parcel_id;
        if (d.delivery_hold || d.deliveryHold) {
          pushUnique({
            id: `hold-rider:${d.parcel_id}`,
            kind: "parcel",
            icon: "pause-circle",
            tone: "orange",
            title: `Delivery on Hold: ${txn}`,
            text: d.delivery_hold_reason || "Coordinator placed this parcel on temporary delivery hold.",
            ts: d.scannedAt || Date.now(),
            to: "/rider/deliveries",
          });
        }
        if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB) {
          pushUnique({
            id: `rth-rider:${d.parcel_id}:${d.returnCoordinated ? "coord" : "hub"}`,
            kind: "parcel",
            icon: "undo-2",
            tone: "red",
            title: `Return to Hub: ${txn}`,
            text: d.returnCoordinated
              ? `Return to Hub confirmed by coordinator (${d.seller || "Seller"}).`
              : `${txn} (${d.receiver || "Customer"}) is marked for Return to Hub. Please return it to the hub for coordinator confirmation.`,
            ts: d.returnCoordinatedAt || d.returnToHubAt || d.doneAt || d.scannedAt || Date.now(),
            to: "/rider/deliveries?tab=failed",
          });
        } else if (d.rescheduled && d.stage === STAGE.TO_DELIVER) {
          const dayNum = Math.min(MAX_RESCHEDULES, Math.max(1, Number(d.rescheduleCount || 1)));
          pushUnique({
            id: `resched-rider:${d.parcel_id}:${dayNum}:${d.scheduledFor}`,
            kind: "parcel",
            icon: "calendar-check",
            tone: "orange",
            title: `Delivery Rescheduled (Day ${dayNum}/${MAX_RESCHEDULES}): ${txn}`,
            text: `${d.receiver || "Customer"} · Next delivery date: ${formatDay(d.scheduledFor)} (${d.lastFailure || "Buyer unavailable"}).`,
            ts: d.lastRescheduledAt || d.scannedAt || Date.now(),
            to: "/rider/deliveries",
          });
        }
      });

      if (assigned.length) {
        pushUnique({
          id: `assigned:${assigned.map((a) => a.parcel_id).join(",")}`,
          kind: "parcel",
          icon: "package",
          tone: "orange",
          title: `${assigned.length} parcel${assigned.length > 1 ? "s" : ""} waiting to be scanned`,
          text: "Assigned to you by the coordinator.",
          ts: Math.max(...assigned.map((a) => new Date(a.updated_at || Date.now()).getTime())),
          to: "/rider",
        });
      }
    }

    return Array.from(byId.values())
      .map((n) => ({ ...n, read: !!mine[n.id] }))
      .sort((a, b) => b.ts - a.ts);
  }, [remote, rawAnnouncements, localComplaints, assigned, myDeliveries, serverRiderParcels, readMap, activeRole, me, name]);

  const pinned = useMemo(() => items.filter((n) => n.kind === "announcement"), [items]);
  const regular = useMemo(() => items.filter((n) => n.kind !== "announcement"), [items]);

  return {
    items: [...pinned, ...regular],
    announcements: pinned,
    notifications: regular,
    unread: items.filter((n) => !n.read).length,
    loading: loading && items.length === 0 && isOnline(),
    syncedOnce,
    lastSyncedAt,
    reload: load,
  };
}
