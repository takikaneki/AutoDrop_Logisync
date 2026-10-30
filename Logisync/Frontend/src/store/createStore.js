import { useSyncExternalStore } from "react";

// Maliit na shared store (walang dagdag na library). Kung may `key`, naka-save sa localStorage.
export function createStore(initial, key) {
  let state = initial;
  if (key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        state = Array.isArray(initial) ? saved : { ...initial, ...saved };
      }
    } catch {
      /* ignore */
    }
  }
  const listeners = new Set();
  const get = () => state;
  const set = (next) => {
    state = typeof next === "function" ? next(state) : next;
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full / blocked */
      }
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const use = () => useSyncExternalStore(subscribe, get);

  // Kapag ibang tab ang nagbago (hal. rider ang nag-submit ng complaint habang bukas ang coordinator),
  // ina-update din ang store na ito para sabay-sabay ang nakikita.
  if (key && typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        const saved = JSON.parse(e.newValue);
        state = Array.isArray(initial) ? saved : { ...initial, ...saved };
        listeners.forEach((l) => l());
      } catch {
        /* ignore */
      }
    });
  }
  return { get, set, use };
}
