import { createStore } from "./createStore.js";
import { getUser } from "../api.js";
import { addNotification, markRead } from "./notifications.js";
import { rescheduleDelivery } from "./riderDeliveries.js";

// Failed delivery -> pagsusuri ng Coordinator -> reschedule sa susunod na araw (o hindi).
//
// Ang pag-uulat ng rider ng "failed" ay napupunta na sa backend (POST /api/parcels/rider/:id/failed).
// WALA pang endpoint para sa desisyon ng coordinator (confirm/decline + petsa), kaya ang mga entry dito
// ay naka-save sa browser, kapareho ng complaints at announcements. TODO kapag may backend na:
//   GET  /api/deliveries/failed              (coordinator: mga naghihintay ng desisyon)
//   POST /api/deliveries/:parcelId/reschedule { decision: "CONFIRM" | "DECLINE", note }  -> scheduled_for
//   GET  /api/parcels/rider/mine              (isama ang scheduled_for at reschedule_status)
// Lahat ng pagbabasa/pagsulat ay dumadaan sa mga function dito, kaya dito lang kailangang palitan.
//
// status: "pending" (naghihintay sa coordinator) | "confirmed" | "declined" | "withdrawn" (sinubukan ulit ng rider bago nag-desisyon)

const store = createStore([], "pt-failed-deliveries");
const notifId = (id) => `fd-${id}`;

export const useFailedDeliveries = store.use;

// Ang "following day" ng pagkabigo. Hindi kailanman mas maaga kaysa ngayon (kung late nag-confirm ang coordinator).
export function nextDay(failedAt) {
  const d = new Date(failedAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pick = d < today ? today : d;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pick.getFullYear()}-${pad(pick.getMonth() + 1)}-${pad(pick.getDate())}`;
}

// Tinatawag ng rider pagkatapos mag-mark ng failed. `d` = delivery record ng rider.
export function reportFailure(d, { reason, note }) {
  const user = getUser();
  const entry = {
    id: `fd${Date.now()}`,
    parcel_id: d.parcel_id,
    transaction_number: d.transaction_number || d.parcel_id,
    receiver: d.receiver || "",
    address: d.address || "",
    seller: d.seller || "",
    contents: d.contents || "",
    rider_id: Number(user?.user_id),
    rider_name: user?.name || "Rider",
    reason,
    note: note || "",
    failedAt: Date.now(),
    status: "pending",
    scheduledFor: null,
    decisionNote: "",
    decidedAt: null,
    decidedBy: "",
  };
  // Isang pending lang kada parcel
  store.set((l) => [entry, ...l.filter((x) => !(x.parcel_id === entry.parcel_id && x.status === "pending"))]);

  // Notification para sa Coordinator (lalabas sa bell, Notifications page at sidebar badge)
  addNotification({
    id: notifId(entry.id),
    kind: "delivery",
    icon: "fa-calendar-xmark",
    tone: "red",
    title: `Failed delivery: ${entry.transaction_number}`,
    text: `${entry.rider_name} · ${reason}. Reschedule for tomorrow?`,
    read: false,
    to: "/notifications",
  });
  return entry;
}

// Coordinator: kumpirmahin (reschedule bukas) o tanggihan. Awtomatikong napupunta sa rider ang resulta.
export function decideReschedule(id, approve, { note = "", by } = {}) {
  const e = store.get().find((x) => x.id === id);
  if (!e || e.status !== "pending") return null;
  const date = approve ? nextDay(e.failedAt) : null;
  store.set((l) =>
    l.map((x) =>
      x.id === id
        ? { ...x, status: approve ? "confirmed" : "declined", scheduledFor: date, decisionNote: note, decidedAt: Date.now(), decidedBy: by || getUser()?.name || "Coordinator" }
        : x
    )
  );
  markRead(notifId(id));
  // Ina-update ang delivery schedule ng rider (bumabalik sa To Be Delivered, may petsa)
  if (approve) rescheduleDelivery(e.rider_id, e.parcel_id, date);
  return { ...e, scheduledFor: date };
}

// Sinubukan na ulit ng rider ang parcel bago pa mag-desisyon ang coordinator: hindi na kailangan ng desisyon
export function withdrawFailure(parcelId) {
  const open = store.get().filter((x) => x.parcel_id === parcelId && x.status === "pending");
  if (!open.length) return;
  store.set((l) => l.map((x) => (x.parcel_id === parcelId && x.status === "pending" ? { ...x, status: "withdrawn" } : x)));
  open.forEach((x) => markRead(notifId(x.id)));
}

// Pinakabagong entry ng isang parcel (para sa Failed page ng rider)
export const latestFor = (list, parcelId) => list.filter((x) => x.parcel_id === parcelId).sort((a, b) => b.failedAt - a.failedAt)[0] || null;
