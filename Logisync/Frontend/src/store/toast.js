import { createStore } from "./createStore.js";
import { getPrefs } from "./prefs.js";

const store = createStore([]);
const popupStore = createStore([]);

export const useToasts = store.use;
export const usePopups = popupStore.use;

function playChime() {
  try {
    const prefs = getPrefs();
    const vol = Math.max(0, Math.min(100, prefs.soundVolume ?? 80)) / 100;
    if (vol <= 0) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    // Ignore autoplay restrictions
  }
}

export function toast(message, type = "success") {
  const id = Date.now() + Math.random();
  store.set((l) => [...l, { id, message, type }]);
  setTimeout(() => store.set((l) => l.filter((t) => t.id !== id)), 3200);
}

export function notifyPopup({ title, message, icon = "fa-bell", to = "" }) {
  const prefs = getPrefs();
  if (prefs.notificationsEnabled === false) return;
  if (prefs.sound !== false) playChime();
  if (prefs.inAppPopups === false) return;
  const id = Date.now() + Math.random();
  popupStore.set((l) => [{ id, title, message, icon, to }, ...l].slice(0, 3));
  setTimeout(() => popupStore.set((l) => l.filter((p) => p.id !== id)), 4500);
}

export const dismissToast = (id) => store.set((l) => l.filter((t) => t.id !== id));
export const dismissPopup = (id) => popupStore.set((l) => l.filter((p) => p.id !== id));
