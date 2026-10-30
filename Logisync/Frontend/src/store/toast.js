import { createStore } from "./createStore.js";

const store = createStore([]);
export const useToasts = store.use;

export function toast(message, type = "success") {
  const id = Date.now() + Math.random();
  store.set((l) => [...l, { id, message, type }]);
  setTimeout(() => store.set((l) => l.filter((t) => t.id !== id)), 3200);
}
export const dismissToast = (id) => store.set((l) => l.filter((t) => t.id !== id));
