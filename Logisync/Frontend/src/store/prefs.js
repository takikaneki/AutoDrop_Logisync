import { createStore } from "./createStore.js";
import { API_BASE_URL } from "../api.js";

// Appearance + notification preferences.
// Cached per authenticated user in localStorage AND synced with PostgreSQL so settings
// persist across logout/login, page refresh, and multiple devices.
const legacyDark = (() => {
  try {
    return localStorage.getItem("darkMode") === "enabled";
  } catch {
    return false;
  }
})();

const BASE_DEFAULTS = {
  dark: legacyDark,
  themeMode: legacyDark ? "dark" : "light", // "light" | "dark" | "system"
  lang: "en",
  timeFormat: "auto",
  fontSize: "md", // "sm" | "md" | "lg"
  reducedMotion: false,
  underlineLinks: false,
  highContrast: false,
  enhancedFocus: false,
  notificationsEnabled: true,
  inAppNotifications: true,
  inAppPopups: true,
  browserPushEnabled: false,
  sound: true,
  soundVolume: 80,
  soundMessages: true,
  soundAnnouncements: true,
  notifyParcel: true,
  notifyRider: true,
  notifySeller: true,
  notifyVerification: true,
  notifyMessages: true,
  notifyAnnouncements: true,
};

function currentAuthInfo() {
  try {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    const uid = user?.user_id ? String(user.user_id) : null;
    return { token, uid };
  } catch {
    return { token: null, uid: null };
  }
}

function readUserScopedCache(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`pt-prefs-u:${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUserScopedCache(uid, prefs) {
  if (!uid) return;
  try {
    localStorage.setItem(`pt-prefs-u:${uid}`, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const initialUid = currentAuthInfo().uid;
const initialUserPrefs = readUserScopedCache(initialUid);

const store = createStore(
  {
    ...BASE_DEFAULTS,
    ...(initialUserPrefs || {}),
  },
  "pt-prefs"
);

if (initialUserPrefs) {
  store.set((s) => ({ ...BASE_DEFAULTS, ...s, ...initialUserPrefs }));
}

const fontSizeMap = { sm: "14px", md: "16px", lg: "18px" };

let themeSwitchRaf = null;
let localChangeSeq = 0;

function resolveDark(p) {
  if (p.themeMode === "system" && typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return Boolean(p.dark);
}

export function applyPrefs(p = store.get()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = resolveDark(p);
  const wasDark = root.classList.contains("dark");
  const themeChanged = wasDark !== isDark;

  if (themeChanged) {
    if (themeSwitchRaf !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(themeSwitchRaf);
      themeSwitchRaf = null;
    }
    // Temporarily disable CSS transitions across the entire DOM so navbar, sidebar,
    // backgrounds, cards, tables, buttons, dropdowns, modals, and scrollbars repaint in one frame.
    root.classList.add("theme-switching");
  }

  root.classList.toggle("dark", isDark);
  if (document.body) {
    document.body.classList.toggle("dark", isDark);
  }
  root.style.colorScheme = isDark ? "dark" : "light";
  root.classList.toggle("reduced-motion", Boolean(p.reducedMotion));
  root.classList.toggle("underline-links", Boolean(p.underlineLinks));
  root.classList.toggle("high-contrast", Boolean(p.highContrast));
  root.classList.toggle("enhanced-focus", Boolean(p.enhancedFocus));
  root.style.zoom = "";
  root.style.fontSize = fontSizeMap[p.fontSize] || "16px";

  if (themeChanged) {
    // Force a single synchronous style flush while transitions are frozen
    void root.offsetHeight;
    if (typeof requestAnimationFrame === "function") {
      themeSwitchRaf = requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
        themeSwitchRaf = null;
      });
    } else {
      root.classList.remove("theme-switching");
    }
  }

  try {
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  } catch {
    /* ignore */
  }
}

let pendingSyncTimer = null;
let queuedServerPatch = {};

async function flushPreferencesToServer(expectedUid) {
  const { token, uid } = currentAuthInfo();
  if (!token || !uid || (expectedUid && uid !== expectedUid)) return;
  const patch = queuedServerPatch;
  queuedServerPatch = {};
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ preferences: patch }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.preferences) {
        writeUserScopedCache(uid, { ...store.get(), ...data.preferences });
      }
    }
  } catch {
    /* keep local cache when offline */
  }
}

export async function syncPrefsFromServer() {
  const { token, uid } = currentAuthInfo();
  if (!token || !uid) return;
  const startSeq = localChangeSeq;
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.preferences) return;
    // Do not overwrite freshly toggled local preferences with an in-flight server snapshot
    if (localChangeSeq !== startSeq || pendingSyncTimer !== null || Object.keys(queuedServerPatch).length > 0) {
      return;
    }
    const merged = { ...BASE_DEFAULTS, ...data.preferences };
    writeUserScopedCache(uid, merged);
    applyPrefs(merged);
    store.set(() => merged);
  } catch {
    /* ignore transient network error */
  }
}

export const usePrefs = store.use;
export const getPrefs = store.get;
export const setPrefs = (patch, { skipServerSync = false } = {}) => {
  localChangeSeq += 1;
  const { uid } = currentAuthInfo();
  const prev = store.get();
  const next = { ...prev, ...patch };
  if (patch.themeMode === "light") next.dark = false;
  else if (patch.themeMode === "dark") next.dark = true;
  else if (patch.themeMode === "system") next.dark = resolveDark(next);

  if (uid) writeUserScopedCache(uid, next);
  // Apply DOM theme classes & color-scheme synchronously BEFORE notifying React subscribers
  // so CSS dark: rules and React-rendered icons/controls update in the exact same paint frame.
  applyPrefs(next);
  store.set(() => next);

  if (!skipServerSync && uid) {
    queuedServerPatch = { ...queuedServerPatch, ...next };
    if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
    pendingSyncTimer = setTimeout(() => {
      pendingSyncTimer = null;
      flushPreferencesToServer(uid);
    }, 150);
  }
};
export const toggleDark = () => {
  const nextDark = !resolveDark(store.get());
  setPrefs({ dark: nextDark, themeMode: nextDark ? "dark" : "light" });
};

if (typeof window !== "undefined") {
  window.addEventListener("logisync-auth-changed", (event) => {
    if (pendingSyncTimer) {
      clearTimeout(pendingSyncTimer);
      pendingSyncTimer = null;
    }
    queuedServerPatch = {};

    const nextUser = event?.detail?.user;
    if (!nextUser) {
      const fallback = { ...BASE_DEFAULTS, dark: false, themeMode: "light", fontSize: "md" };
      applyPrefs(fallback);
      store.set(() => fallback);
      return;
    }
    const uid = String(nextUser.user_id || "");
    const cached = readUserScopedCache(uid);
    if (cached) {
      const next = { ...BASE_DEFAULTS, ...cached };
      applyPrefs(next);
      store.set(() => next);
    }
    syncPrefsFromServer();
  });
}

if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (store.get().themeMode === "system") {
      const next = { ...store.get(), dark: mq.matches };
      applyPrefs(next);
      store.set(() => next);
    }
  };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

applyPrefs();

// Maliit na salin ng labels (menu / titles lang). Ang ibang teksto ay nananatiling English.
const fil = {
  Home: "Tahanan",
  "About Us": "Tungkol Sa Amin",
  Contact: "Makipag-ugnayan",
  Help: "Tulong",
  Dashboard: "Dashboard",
  Parcels: "Mga Parcel",
  "Parcel Records": "Mga Tala ng Parcel",
  Reports: "Mga Ulat",
  Verification: "Beripikasyon",
  Riders: "Mga Rider",
  Sellers: "Mga Seller",
  Messages: "Mga Mensahe",
  Complaints: "Mga Reklamo",
  Announcements: "Mga Anunsyo",
  Notifications: "Mga Abiso",
  Analytics: "Analytics",
  "Audit Log": "Audit Log",
  Settings: "Mga Setting",
  Logout: "Mag-logout",
  Overview: "Pangkalahatan",
  Operations: "Operasyon",
  Communication: "Komunikasyon",
  Insights: "Pagsusuri",
  "Parcel Management": "Pamamahala ng Parcel",
  "Quick Links": "Mabilisang Link",
  Profile: "Profile",
};

export function useT() {
  const { lang } = usePrefs();
  return (s) => (lang === "fil" && fil[s]) || s;
}
