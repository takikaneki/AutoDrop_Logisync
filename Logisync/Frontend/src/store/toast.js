import { createStore } from "./createStore.js";
import { getPrefs } from "./prefs.js";
import { previewTone } from "../utils/sound.js";

const store = createStore([]);
const popupStore = createStore([]);

export const useToasts = store.use;
export const usePopups = popupStore.use;

function playNotificationCategorySound(category) {
  const prefs = getPrefs();
  if (prefs.notificationsEnabled === false || prefs.sound === false) return;
  if (category === "messages") {
    if (prefs.notifyMessages !== false && prefs.soundMessages !== false) previewTone("messages");
    return;
  }
  if (category === "announcements") {
    if (prefs.notifyAnnouncements !== false && prefs.soundAnnouncements !== false) previewTone("announcements");
  }
  // Parcel & Delivery Updates and Verification & Video Status must remain silent.
}

export function toast(message, type = "success") {
  const id = Date.now() + Math.random();
  store.set((l) => [...l, { id, message, type }]);
  setTimeout(() => store.set((l) => l.filter((t) => t.id !== id)), 3200);
}

export function notifyPopup({ title, message, icon = "fa-bell", to = "", category = "parcel" }) {
  const prefs = getPrefs();
  if (prefs.notificationsEnabled === false) return;
  playNotificationCategorySound(category);
  if (prefs.inAppPopups === false) return;
  const id = Date.now() + Math.random();
  popupStore.set((l) => [{ id, title, message, icon, to }, ...l].slice(0, 3));
  setTimeout(() => popupStore.set((l) => l.filter((p) => p.id !== id)), 4500);
}

export const dismissToast = (id) => store.set((l) => l.filter((t) => t.id !== id));
export const dismissPopup = (id) => popupStore.set((l) => l.filter((p) => p.id !== id));
