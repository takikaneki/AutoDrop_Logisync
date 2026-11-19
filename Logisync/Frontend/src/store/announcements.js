import { api, getToken } from "../api.js";
import { createStore } from "./createStore.js";

const MOCK_TITLES = new Set([
  "delivery cancellation notice",
  "holiday schedule",
  "updated verification rules",
]);

function purgeMocks(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((a) => {
    if (!a || !a.title) return false;
    const t = String(a.title).trim().toLowerCase();
    const id = String(a.id || "").toLowerCase();
    if (["an1", "an2", "an3"].includes(id)) return false;
    if (MOCK_TITLES.has(t)) return false;
    if (t.includes("delivery cancellation") || t.includes("holiday schedule") || t.includes("verification rules")) return false;
    return true;
  });
}

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("pt-announcements");
    if (raw) {
      const parsed = JSON.parse(raw);
      localStorage.setItem("pt-announcements", JSON.stringify(purgeMocks(parsed)));
    }
  } catch {
    /* ignore */
  }
}

const store = createStore([], "pt-announcements");

if (Array.isArray(store.get())) {
  const cleaned = purgeMocks(store.get());
  if (cleaned.length !== store.get().length) {
    store.set(cleaned);
  }
}

export const useAnnouncements = () => purgeMocks(store.use());

export const addAnnouncement = (a) =>
  store.set((l) => {
    const id = a.id || `an${Date.now()}`;
    const rest = purgeMocks(l).filter((item) => item.id !== id);
    return [{ id, ts: a.ts || Date.now(), ...a }, ...rest];
  });

export async function syncAnnouncementsFromServer() {
  if (!getToken()) return [];
  try {
    const data = await api("/announcements");
    const remote = Array.isArray(data?.announcements) ? purgeMocks(data.announcements) : [];
    store.set(() => remote);
    return remote;
  } catch {
    return purgeMocks(store.get());
  }
}

export async function publishAnnouncement({ title, message, toRiders, toSellers }) {
  const clientId = `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const data = await api("/announcements", {
      method: "POST",
      body: { title, message, toRiders, toSellers, clientId },
    });
    if (data?.announcement) {
      addAnnouncement(data.announcement);
      return data;
    }
  } catch (err) {
    // Fallback local record if offline, while propagating push failure info cleanly
    addAnnouncement({ id: clientId, title, message, toRiders, toSellers });
    return { announcement: { id: clientId, title, message, toRiders, toSellers }, error: err.message };
  }
  return null;
}
