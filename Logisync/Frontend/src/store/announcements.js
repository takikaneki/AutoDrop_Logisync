import { createStore } from "./createStore.js";

const MOCK_TITLES = new Set([
  "delivery cancellation notice",
  "holiday schedule",
  "updated verification rules",
]);

function purgeMocks(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (a) => a && a.title && !MOCK_TITLES.has(String(a.title).trim().toLowerCase())
  );
}

// Clean localStorage immediately upon module evaluation
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("pt-announcements");
    if (raw) {
      const parsed = JSON.parse(raw);
      const clean = purgeMocks(parsed);
      localStorage.setItem("pt-announcements", JSON.stringify(clean));
    }
  } catch {
    /* ignore */
  }
}

const store = createStore([], "pt-announcements");

// Clean store memory state
if (Array.isArray(store.get())) {
  const cleaned = purgeMocks(store.get());
  if (cleaned.length !== store.get().length) {
    store.set(cleaned);
  }
}

export const useAnnouncements = () => purgeMocks(store.use());
export const addAnnouncement = (a) =>
  store.set((l) => [{ id: `an${Date.now()}`, ts: Date.now(), ...a }, ...purgeMocks(l)]);
