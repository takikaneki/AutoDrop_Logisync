import { createStore } from "./createStore.js";

// TODO: GET/POST /api/announcements
const store = createStore([], "pt-announcements");

export const useAnnouncements = store.use;
export const addAnnouncement = (a) => store.set((l) => [{ id: `an${Date.now()}`, ts: Date.now(), ...a }, ...l]);
