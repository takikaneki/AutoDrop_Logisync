import { api, getRole, getToken } from "../api.js";
import { createStore } from "./createStore.js";

const MOCK_TITLES = new Set([
  "delivery cancellation notice",
  "holiday schedule",
  "updated verification rules",
]);

export function parseAnnouncementBool(val, fallback = false) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return fallback;
}

function normalizeAnnouncement(a) {
  if (!a || typeof a !== "object") return null;
  const title = String(a.title || "").trim();
  if (!title) return null;

  const isRiderOnlyFix = title.toLowerCase() === "itigil na ang softeng na tu";
  const rawRiders = a.toRiders !== undefined ? a.toRiders : a.to_riders;
  const rawSellers = a.toSellers !== undefined ? a.toSellers : a.to_sellers;

  const toRiders = parseAnnouncementBool(rawRiders, false);
  const toSellers = isRiderOnlyFix ? false : parseAnnouncementBool(rawSellers, false);

  return {
    ...a,
    id: a.id || `an${Date.now()}`,
    title,
    message: String(a.message || ""),
    toRiders,
    toSellers,
    ts: Number(a.ts) || new Date(a.createdAt || a.created_at || Date.now()).getTime() || Date.now(),
  };
}

function purgeMocks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeAnnouncement)
    .filter((a) => {
      if (!a || !a.title) return false;
      const t = String(a.title).trim().toLowerCase();
      const id = String(a.id || "").toLowerCase();
      if (["an1", "an2", "an3"].includes(id)) return false;
      if (MOCK_TITLES.has(t)) return false;
      if (t.includes("delivery cancellation") || t.includes("holiday schedule") || t.includes("verification rules")) return false;
      return true;
    });
}

export function filterAnnouncementsForRole(list, roleOverride) {
  const cleaned = purgeMocks(list);
  const role = String(roleOverride || getRole() || "").trim().toLowerCase();
  if (role === "rider") {
    return cleaned.filter((a) => a.toRiders === true);
  }
  if (role === "seller") {
    return cleaned.filter((a) => a.toSellers === true);
  }
  return cleaned;
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
  store.set(cleaned);
}

export const useAnnouncements = (roleOverride) => filterAnnouncementsForRole(store.use(), roleOverride);

export const addAnnouncement = (a) =>
  store.set((l) => {
    const norm = normalizeAnnouncement(a);
    if (!norm) return purgeMocks(l);
    const rest = purgeMocks(l).filter((item) => item.id !== norm.id);
    return [norm, ...rest];
  });

export async function syncAnnouncementsFromServer() {
  if (!getToken()) return [];
  try {
    const data = await api("/announcements");
    const remote = Array.isArray(data?.announcements) ? purgeMocks(data.announcements) : [];
    store.set(() => remote);
    return filterAnnouncementsForRole(remote);
  } catch {
    return filterAnnouncementsForRole(store.get());
  }
}

export async function publishAnnouncement({ title, message, toRiders, toSellers, audience }) {
  const clientId = `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const strictRiders = parseAnnouncementBool(toRiders, false);
  const strictSellers = parseAnnouncementBool(toSellers, false);
  const resolvedAudience =
    audience ||
    (strictRiders && !strictSellers ? "riders" : !strictRiders && strictSellers ? "sellers" : "both");

  try {
    const data = await api("/announcements", {
      method: "POST",
      body: {
        title,
        message,
        toRiders: strictRiders,
        toSellers: strictSellers,
        audience: resolvedAudience,
        clientId,
      },
    });
    if (data?.announcement) {
      addAnnouncement(data.announcement);
      return data;
    }
  } catch (err) {
    const fallback = {
      id: clientId,
      title,
      message,
      toRiders: strictRiders,
      toSellers: strictSellers,
      ts: Date.now(),
    };
    addAnnouncement(fallback);
    return { announcement: fallback, error: err.message };
  }
  return null;
}
