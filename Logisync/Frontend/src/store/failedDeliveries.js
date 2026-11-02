import { useEffect } from "react";
import { createStore } from "./createStore.js";
import { getUser } from "../api.js";
import { addNotification, markRead } from "./notifications.js";
import {
  MAX_RESCHEDULES,
  STAGE,
  coordinateReturnToSeller,
  getAllDeliveries,
  rescheduleDelivery,
  syncAutomaticReschedules,
} from "./riderDeliveries.js";

// Failed delivery, automatic 3-day rescheduling, at Return to Hub tracking para sa Coordinator, Rider, at Seller.
// status:
//   - "rescheduled" (naka-schedule sa susunod na araw, Day 1..3 of 3)
//   - "return_to_hub" (naabot na ang 3-day limit; kailangang ibalik sa hub at i-coordinate sa seller)
//   - "return_coordinated" (na-coordinate na ng coordinator ang pagbabalik sa seller)
//   - "pending" / "confirmed" / "declined" / "withdrawn"

const store = createStore([], "pt-failed-deliveries");
const notifId = (id) => `fd-${id}`;

export function nextDay(failedAt) {
  const d = new Date(failedAt || Date.now());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pick = d < today ? today : d;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pick.getFullYear()}-${pad(pick.getMonth() + 1)}-${pad(pick.getDate())}`;
}

// I-sync ang `pt-failed-deliveries` mula sa live delivery records (`pt-rider-deliveries`)
// para makita agad ng Coordinator at Seller ang mga automatic reschedules at Return to Hub parcels.
export function syncFailedDeliveriesFromRiderStore() {
  syncAutomaticReschedules();
  const deliveries = getAllDeliveries();
  if (!Array.isArray(deliveries) || deliveries.length === 0) return;

  const existing = store.get();
  let changed = false;
  const nextList = [...existing];

  for (const d of deliveries) {
    const isReturnToHub = d.returnToHub || d.stage === STAGE.RETURN_TO_HUB;
    const isRescheduled = d.rescheduled && d.stage === STAGE.TO_DELIVER;
    if (!isReturnToHub && !isRescheduled) continue;

    const status = d.returnCoordinated
      ? "return_coordinated"
      : isReturnToHub
      ? "return_to_hub"
      : "rescheduled";

    const idx = nextList.findIndex((x) => x.parcel_id === d.parcel_id);
    const reason = d.lastFailure || d.reason || "Undelivered on scheduled date";
    const rescheduleCount = Number(d.rescheduleCount || (isReturnToHub ? MAX_RESCHEDULES : 1));

    if (idx === -1) {
      nextList.unshift({
        id: `fd-${d.parcel_id}`,
        parcel_id: d.parcel_id,
        transaction_number: d.transaction_number || d.parcel_id,
        receiver: d.receiver || "",
        address: d.address || "",
        seller: d.seller || "",
        contents: d.contents || "",
        rider_id: d.user_id,
        rider_name: d.rider_name || "Rider",
        reason,
        note: d.lastNote || d.note || "",
        failedAt: d.returnToHubAt || d.lastRescheduledAt || d.scannedAt || Date.now(),
        status,
        scheduledFor: isReturnToHub ? null : d.scheduledFor,
        rescheduleCount,
        maxReschedules: MAX_RESCHEDULES,
        attempts: d.attempts || [],
        returnToHub: isReturnToHub,
        returnCoordinated: Boolean(d.returnCoordinated),
        returnCoordinatedAt: d.returnCoordinatedAt || null,
        returnCoordinatedBy: d.returnCoordinatedBy || "",
        decisionNote: d.returnNote || "",
        decidedAt: d.returnCoordinatedAt || d.lastRescheduledAt || null,
        decidedBy: d.returnCoordinatedBy || "System (Auto Policy)",
      });
      changed = true;
    } else {
      const curr = nextList[idx];
      if (
        curr.status !== status ||
        curr.scheduledFor !== (isReturnToHub ? null : d.scheduledFor) ||
        curr.rescheduleCount !== rescheduleCount ||
        (curr.attempts?.length || 0) !== (d.attempts?.length || 0) ||
        Boolean(curr.returnCoordinated) !== Boolean(d.returnCoordinated)
      ) {
        nextList[idx] = {
          ...curr,
          reason,
          status,
          scheduledFor: isReturnToHub ? null : d.scheduledFor,
          rescheduleCount,
          maxReschedules: MAX_RESCHEDULES,
          attempts: d.attempts || curr.attempts || [],
          returnToHub: isReturnToHub,
          returnCoordinated: Boolean(d.returnCoordinated),
          returnCoordinatedAt: d.returnCoordinatedAt || curr.returnCoordinatedAt || null,
          returnCoordinatedBy: d.returnCoordinatedBy || curr.returnCoordinatedBy || "",
          decisionNote: d.returnNote || curr.decisionNote || "",
        };
        changed = true;
      }
    }
  }

  if (changed) {
    store.set(nextList);
  }
}

try {
  syncFailedDeliveriesFromRiderStore();
} catch {
  // Ignore init errors
}

export function useFailedDeliveries() {
  const list = store.use();
  const deliveries = getAllDeliveries();
  useEffect(() => {
    syncFailedDeliveriesFromRiderStore();
  }, [list.length, deliveries.length]);
  return list;
}

// Tinatawag ng rider pagkatapos mag-mark ng failed.
export function reportFailure(d, { reason, note, result } = {}) {
  const user = getUser();
  const updatedDelivery = getAllDeliveries().find((x) => x.parcel_id === d.parcel_id) || d;
  const isReturnToHub =
    result?.outcome === "return_to_hub" ||
    updatedDelivery.returnToHub ||
    updatedDelivery.stage === STAGE.RETURN_TO_HUB;
  const rescheduleCount = Number(
    result?.rescheduleCount ?? updatedDelivery.rescheduleCount ?? (isReturnToHub ? MAX_RESCHEDULES : 1)
  );
  const scheduledFor = isReturnToHub ? null : result?.scheduledFor || updatedDelivery.scheduledFor || nextDay(Date.now());

  const entry = {
    id: `fd-${d.parcel_id}`,
    parcel_id: d.parcel_id,
    transaction_number: d.transaction_number || d.parcel_id,
    receiver: d.receiver || "",
    address: d.address || "",
    seller: d.seller || "",
    contents: d.contents || "",
    rider_id: Number(user?.user_id || d.user_id),
    rider_name: user?.name || d.rider_name || "Rider",
    reason,
    note: note || "",
    failedAt: Date.now(),
    status: isReturnToHub ? "return_to_hub" : "rescheduled",
    scheduledFor,
    rescheduleCount,
    maxReschedules: MAX_RESCHEDULES,
    attempts: updatedDelivery.attempts || [],
    returnToHub: isReturnToHub,
    returnCoordinated: false,
    decisionNote: isReturnToHub
      ? `Reached maximum ${MAX_RESCHEDULES}-day rescheduling limit. Marked as Return to Hub.`
      : `Automatically rescheduled to ${scheduledFor} (Day ${rescheduleCount} of ${MAX_RESCHEDULES}).`,
    decidedAt: Date.now(),
    decidedBy: "3-Day Reschedule Policy",
  };

  store.set((l) => [entry, ...l.filter((x) => x.parcel_id !== entry.parcel_id)]);
  return entry;
}

// Coordinator: kumpirmahin ang reschedule (kung wala pa sa 3-day limit) o i-coordinate ang Return to Hub.
export function decideReschedule(id, approve, { note = "", by, customDate } = {}) {
  const e = store.get().find((x) => x.id === id || x.parcel_id === id);
  if (!e) return null;

  const coordinatorName = by || getUser()?.name || "Coordinator";
  const currentCount = Number(e.rescheduleCount || 0);

  // Hindi kailanman pinapayagan ang unlimited rescheduling: kapag >= 3 days na, Return to Hub dapat
  if (!approve || e.returnToHub || e.status === "return_to_hub" || currentCount >= MAX_RESCHEDULES) {
    const updated = coordinateReturnToSeller(e.parcel_id, {
      note: note || "Return to hub and seller coordinated by coordinator.",
      by: coordinatorName,
    });
    store.set((l) =>
      l.map((x) =>
        x.id === e.id
          ? {
              ...x,
              status: "return_coordinated",
              returnToHub: true,
              returnCoordinated: true,
              returnCoordinatedAt: Date.now(),
              returnCoordinatedBy: coordinatorName,
              scheduledFor: null,
              decisionNote: note || "Return to seller coordinated.",
              decidedAt: Date.now(),
              decidedBy: coordinatorName,
              attempts: updated?.attempts || x.attempts || [],
            }
          : x
      )
    );
    markRead(notifId(e.id));
    markRead(`rth-${e.parcel_id}`);
    return { ...e, status: "return_coordinated", returnToHub: true, returnCoordinated: true };
  }

  const date = customDate || nextDay(e.failedAt);
  const res = rescheduleDelivery(e.rider_id, e.parcel_id, date, { reason: e.reason, note });
  const delivery = res?.delivery;
  const nextCount = Number(delivery?.rescheduleCount || Math.min(currentCount + 1, MAX_RESCHEDULES));

  store.set((l) =>
    l.map((x) =>
      x.id === e.id
        ? {
            ...x,
            status: res?.outcome === "return_to_hub" ? "return_to_hub" : "rescheduled",
            scheduledFor: res?.outcome === "return_to_hub" ? null : date,
            rescheduleCount: nextCount,
            returnToHub: res?.outcome === "return_to_hub",
            attempts: delivery?.attempts || x.attempts || [],
            decisionNote: note,
            decidedAt: Date.now(),
            decidedBy: coordinatorName,
          }
        : x
    )
  );
  markRead(notifId(e.id));
  return { ...e, scheduledFor: date, rescheduleCount: nextCount };
}

// Coordinator: direktang pag-coordinate ng pagbabalik ng Return to Hub parcel sa seller
export function coordinateReturn(parcelId, { note = "", by } = {}) {
  const coordinatorName = by || getUser()?.name || "Coordinator";
  const updated = coordinateReturnToSeller(parcelId, { note, by: coordinatorName });
  store.set((l) =>
    l.map((x) =>
      x.parcel_id === parcelId || x.id === parcelId
        ? {
            ...x,
            status: "return_coordinated",
            returnToHub: true,
            returnCoordinated: true,
            returnCoordinatedAt: Date.now(),
            returnCoordinatedBy: coordinatorName,
            scheduledFor: null,
            decisionNote: note || "Return to seller coordinated by hub.",
            decidedAt: Date.now(),
            decidedBy: coordinatorName,
            attempts: updated?.attempts || x.attempts || [],
          }
        : x
    )
  );
  addNotification({
    id: `rth-coord-${parcelId}`,
    kind: "parcel",
    icon: "fa-rotate-left",
    tone: "blue",
    title: `Return to seller coordinated: ${updated?.transaction_number || parcelId}`,
    text: `Coordinated by ${coordinatorName} for ${updated?.seller || "Seller"}. ${note || ""}`.trim(),
    read: true,
    to: "/parcels",
  });
  return updated;
}

// Sinubukan na ulit ng rider ang parcel bago pa mag-desisyon ang coordinator
export function withdrawFailure(parcelId) {
  const open = store.get().filter((x) => x.parcel_id === parcelId && x.status === "pending");
  if (!open.length) return;
  store.set((l) => l.map((x) => (x.parcel_id === parcelId && x.status === "pending" ? { ...x, status: "withdrawn" } : x)));
  open.forEach((x) => markRead(notifId(x.id)));
}

// Pinakabagong entry ng isang parcel
export const latestFor = (list, parcelId) =>
  list.filter((x) => x.parcel_id === parcelId).sort((a, b) => b.failedAt - a.failedAt)[0] || null;
