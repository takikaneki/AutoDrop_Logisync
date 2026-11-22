import { createStore } from "./createStore.js";
import { getRole, getUser } from "../api.js";
import { fetchComplaints } from "../services/complaintService.js";
import { listMessages } from "../services/messageService.js";

// Notifications ng Coordinator (local + live backend sync for complaints & messages).
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

let syncing = false;

export async function syncCoordinatorNotificationsFromServer() {
  if (syncing || getRole() !== "coordinator") return;
  syncing = true;
  try {
    const me = Number(getUser()?.user_id);
    const [complaints, messages] = await Promise.all([
      fetchComplaints().catch(() => []),
      listMessages().catch(() => []),
    ]);

    const incoming = [];

    if (Array.isArray(complaints)) {
      complaints.forEach((c) => {
        if (!c?.id) return;
        const isUrgent =
          String(c.priority || "").toLowerCase() === "high" ||
          /urgent/i.test(String(c.category || c.kind || ""));
        const senderRole = String(c.role || "").toLowerCase() === "seller" ? "seller" : "rider";
        const tsVal = new Date(c.createdAt || c.updatedAt || Date.now()).getTime() || Date.now();
        incoming.push({
          id: `complaint:${c.id}`,
          kind: senderRole,
          category: "messages",
          icon: isUrgent ? "triangle-alert" : "clipboard-list",
          tone: isUrgent ? "red" : "orange",
          read: Boolean(c.isRead || c.status === "Resolved"),
          title: `${c.from || c.role || "User"} sent ${isUrgent ? "an urgent complaint" : "a complaint"} (${c.id})`,
          text: c.subject || c.category || "New complaint submitted",
          ts: tsVal,
          to: "/complaints",
        });
      });
    }

    if (Array.isArray(messages) && me) {
      messages
        .filter((m) => Number(m.receiver_id) === me && !m.is_read)
        .forEach((m) => {
          const senderRole = String(m.sender_role || "").toLowerCase() === "seller" ? "seller" : "rider";
          const tsVal = new Date(m.created_at || Date.now()).getTime() || Date.now();
          incoming.push({
            id: `msg:${m.message_id}`,
            kind: senderRole,
            category: "messages",
            icon: "message-circle",
            tone: "blue",
            read: false,
            title: `New message from ${m.sender_name || "User"}`,
            text: String(m.message || "").slice(0, 90),
            ts: tsVal,
            to: "/messages",
          });
        });
    }

    if (incoming.length === 0) return;

    store.set((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      let changed = false;

      for (const item of incoming) {
        const existing = byId.get(item.id);
        if (!existing) {
          byId.set(item.id, item);
          changed = true;
        } else {
          // Preserve local read state if coordinator already read it; also update if marked read on server
          const nextRead = Boolean(existing.read || item.read);
          if (
            existing.read !== nextRead ||
            existing.title !== item.title ||
            existing.text !== item.text ||
            existing.category !== item.category
          ) {
            byId.set(item.id, { ...existing, ...item, read: nextRead });
            changed = true;
          }
        }
      }

      if (!changed) return prev;
      return Array.from(byId.values())
        .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
        .slice(0, 100);
    });
  } catch {
    /* keep bell usable on transient network errors */
  } finally {
    syncing = false;
  }
}

export function classifyNotification(n, isAnnouncement = false) {
  if (isAnnouncement) return "announcements";
  if (n?.category === "announcements") return "announcements";
  if (n?.category === "messages") return "messages";
  if (n?.category === "verification") return "verification";
  if (n?.category === "parcel") return "parcel";

  const txt = `${n?.title || ""} ${n?.text || ""}`.toLowerCase();
  if (n?.kind === "announcement" || txt.includes("announcement")) return "announcements";
  if (
    n?.kind === "message" ||
    n?.kind === "complaint" ||
    n?.to === "/complaints" ||
    n?.to === "/messages" ||
    txt.includes("message") ||
    txt.includes("complaint") ||
    txt.includes("urgent request") ||
    txt.includes("a request") ||
    txt.includes("reply")
  ) {
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
