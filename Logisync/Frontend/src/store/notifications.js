import { createStore } from "./createStore.js";

// Notifications ng Coordinator. Naka-save sa browser (localStorage) para makapagdagdag din ang
// Seller/Rider (hal. nag-submit ng complaint) at makita ito ng Coordinator.
// TODO: palitan ng GET /api/notifications at PATCH /api/notifications/:id/read kapag ready na ang Express API.

const minsAgo = (m) => Date.now() - m * 60 * 1000;

const store = createStore([
  {
    id: "n1",
    kind: "rider",
    icon: "fa-car-burst",
    tone: "red",
    title: "Mark Cruz reported a vehicle problem",
    text: "Unable to continue my delivery route.",
    ts: minsAgo(2),
    read: false,
    to: "/messages?contact=Mark%20Cruz",
  },
  {
    id: "n2",
    kind: "rider",
    icon: "fa-kit-medical",
    tone: "red",
    title: "John Reyes needs immediate assistance",
    text: "Emergency concern from a rider.",
    ts: minsAgo(8),
    read: false,
    to: "/messages?contact=John%20Reyes",
  },
  {
    id: "n3",
    kind: "seller",
    icon: "fa-store",
    tone: "orange",
    title: "Maria Santos sent a parcel inquiry",
    text: "Asking about one of her parcel records.",
    ts: minsAgo(15),
    read: false,
    to: "/messages?contact=Maria%20Santos",
  },
  {
    id: "n4",
    kind: "parcel",
    icon: "fa-flag",
    tone: "red",
    title: "Parcel PT-003 was flagged",
    text: "Casa Goods · Kitchen Organizer",
    ts: minsAgo(42),
    read: false,
    to: "/verification",
  },
  {
    id: "n5",
    kind: "seller",
    icon: "fa-store",
    tone: "purple",
    title: "Angela Reyes sent a parcel concern",
    text: "Needs help with a parcel record.",
    ts: minsAgo(65),
    read: true,
    to: "/messages?contact=Angela%20Reyes",
  },
  {
    id: "n6",
    kind: "rider",
    icon: "fa-route",
    tone: "blue",
    title: "Carlo Mendoza reported a route concern",
    text: "There is a road closure along the route.",
    ts: minsAgo(130),
    read: true,
    to: "/messages?contact=Carlo%20Mendoza",
  },
  {
    id: "n7",
    kind: "parcel",
    icon: "fa-clock",
    tone: "orange",
    title: "PT-001 is waiting for verification",
    text: "Lyn's Shop · Wireless Earbuds",
    ts: minsAgo(190),
    read: true,
    to: "/verification",
  },
], "pt-notifications");

export const useNotifications = store.use;

export const markRead = (id) => store.set((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));

export const markAllRead = () => store.set((l) => l.map((n) => ({ ...n, read: true })));

export function addNotification(n) {
  store.set((l) => [{ id: `n${Date.now()}`, read: true, ts: Date.now(), ...n }, ...l]);
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}
