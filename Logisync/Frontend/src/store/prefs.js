import { createStore } from "./createStore.js";

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

function resolveDark(p) {
  if (p.themeMode === "system" && typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return Boolean(p.dark);
}

export function applyPrefs(p = store.get()) {
  const root = document.documentElement;
  const isDark = resolveDark(p);
  root.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);
  root.classList.toggle("reduced-motion", Boolean(p.reducedMotion));
  root.classList.toggle("underline-links", Boolean(p.underlineLinks));
  root.classList.toggle("high-contrast", Boolean(p.highContrast));
  root.classList.toggle("enhanced-focus", Boolean(p.enhancedFocus));
  root.style.zoom = "";
  root.style.fontSize = fontSizeMap[p.fontSize] || "16px";
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
    const res = await fetch(`${import.meta?.env?.VITE_API_URL || "/api"}/notifications/preferences`, {
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
  try {
    const res = await fetch(`${import.meta?.env?.VITE_API_URL || "/api"}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.preferences) return;
    const merged = { ...BASE_DEFAULTS, ...data.preferences };
    writeUserScopedCache(uid, merged);
    store.set(() => merged);
    applyPrefs(merged);
  } catch {
    /* ignore transient network error */
  }
}

export const usePrefs = store.use;
export const getPrefs = store.get;
export const setPrefs = (patch, { skipServerSync = false } = {}) => {
  const { uid } = currentAuthInfo();
  store.set((s) => {
    const next = { ...s, ...patch };
    if (patch.themeMode === "light") next.dark = false;
    else if (patch.themeMode === "dark") next.dark = true;
    else if (patch.themeMode === "system") next.dark = resolveDark(next);
    if (uid) writeUserScopedCache(uid, next);
    return next;
  });
  applyPrefs();

  if (!skipServerSync && uid) {
    queuedServerPatch = { ...queuedServerPatch, ...store.get() };
    if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
    pendingSyncTimer = setTimeout(() => {
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
      store.set(() => fallback);
      applyPrefs(fallback);
      return;
    }
    const uid = String(nextUser.user_id || "");
    const cached = readUserScopedCache(uid);
    if (cached) {
      const next = { ...BASE_DEFAULTS, ...cached };
      store.set(() => next);
      applyPrefs(next);
    }
    syncPrefsFromServer();
  });
}

if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (store.get().themeMode === "system") {
      store.set((s) => ({ ...s, dark: mq.matches }));
      applyPrefs();
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
