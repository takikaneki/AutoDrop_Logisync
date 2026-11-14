import { createStore } from "./createStore.js";

// Appearance + notification preferences. Naka-save sa localStorage.
const legacyDark = (() => {
  try {
    return localStorage.getItem("darkMode") === "enabled";
  } catch {
    return false;
  }
})();

const store = createStore(
  {
    dark: legacyDark,
    themeMode: legacyDark ? "dark" : "light", // "light" | "dark" | "system"
    lang: "en", // "en" | "fil"
    timeFormat: "auto", // "auto" | "12h" | "24h"
    fontSize: "md", // "sm" | "md" | "lg"
    reducedMotion: false,
    underlineLinks: false,
    notificationsEnabled: true,
    inAppPopups: true,
    sound: true,
    emailAlerts: false,
    notifyParcel: true,
    notifyRider: true,
    notifySeller: true,
    notifyVerification: true,
    notifyMessages: true,
    notifyAnnouncements: true,
  },
  "pt-prefs"
);

const zoomMap = { sm: "0.92", md: "1", lg: "1.1" };

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
  root.style.zoom = zoomMap[p.fontSize] || "1";
  try {
    localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  } catch {
    /* ignore */
  }
}

export const usePrefs = store.use;
export const getPrefs = store.get;
export const setPrefs = (patch) => {
  store.set((s) => {
    const next = { ...s, ...patch };
    if (patch.themeMode === "light") next.dark = false;
    else if (patch.themeMode === "dark") next.dark = true;
    else if (patch.themeMode === "system") next.dark = resolveDark(next);
    return next;
  });
  applyPrefs();
};
export const toggleDark = () => {
  const nextDark = !resolveDark(store.get());
  setPrefs({ dark: nextDark, themeMode: nextDark ? "dark" : "light" });
};

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
