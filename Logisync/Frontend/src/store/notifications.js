import { createStore } from "./createStore.js";

// Notifications ng Coordinator. Naka-save sa browser (localStorage) para makapagdagdag din ang
// Seller/Rider (hal. nag-submit ng complaint) at makita ito ng Coordinator.
// TODO: palitan ng GET /api/notifications at PATCH /api/notifications/:id/read kapag ready na ang Express API.

const store = createStore([], "pt-notifications");

export const useNotifications = store.use;

export const markRead = (id) => store.set((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));

export const markAllRead = () => store.set((l) => l.map((n) => ({ ...n, read: true })));

export function addNotification(n) {
  store.set((l) => {
    const id = n.id || `n${Date.now()}`;
    if (n.id && l.some((x) => x.id === n.id)) return l;
    return [{ id, read: false, ts: Date.now(), ...n }, ...l];
  });
}

export function classifyNotification(n, isAnnouncement = false) {
  if (isAnnouncement) return "announcements";
  const txt = `${n?.title || ""} ${n?.text || ""}`.toLowerCase();
  if (n?.kind === "announcement" || txt.includes("announcement")) return "announcements";
  if (n?.kind === "message" || n?.kind === "complaint" || txt.includes("message") || txt.includes("complaint") || txt.includes("reply")) {
    return "messages";
  }
  if (txt.includes("video") || txt.includes("verif") || txt.includes("reupload") || txt.includes("rejected")) {
    return "verification";
  }
  return "parcel";
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
