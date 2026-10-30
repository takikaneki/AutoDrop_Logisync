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
    lang: "en", // "en" | "fil"
    fontSize: "md", // "sm" | "md" | "lg"
    sound: true,
    emailAlerts: false,
    notifyParcel: true,
    notifyRider: true,
    notifySeller: true,
    notifyVerification: true,
  },
  "pt-prefs"
);

const zoomMap = { sm: "0.92", md: "1", lg: "1.1" };

export function applyPrefs(p = store.get()) {
  const root = document.documentElement;
  root.classList.toggle("dark", p.dark);
  document.body.classList.toggle("dark", p.dark);
  root.style.zoom = zoomMap[p.fontSize] || "1";
  try {
    localStorage.setItem("darkMode", p.dark ? "enabled" : "disabled");
  } catch {
    /* ignore */
  }
}

export const usePrefs = store.use;
export const getPrefs = store.get;
export const setPrefs = (patch) => {
  store.set((s) => ({ ...s, ...patch }));
  applyPrefs();
};
export const toggleDark = () => setPrefs({ dark: !store.get().dark });

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
