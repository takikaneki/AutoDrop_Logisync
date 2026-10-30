import { createStore } from "./createStore.js";

const d = (days, h = 9) => new Date(2026, 9, 11 - days, h, 0).getTime();

// TODO: GET/POST /api/announcements
const store = createStore([
  { id: "an1", ts: d(0, 7), title: "Delivery Cancellation Notice", message: "All deliveries in the north zone are paused due to heavy flooding. Please wait for further updates.", toRiders: true, toSellers: true },
  { id: "an2", ts: d(2, 10), title: "Holiday Schedule", message: "Operations will be limited on October 31. Please plan your pickups ahead.", toRiders: true, toSellers: true },
  { id: "an3", ts: d(5, 15), title: "Updated Verification Rules", message: "Sellers must now upload a packing video before a parcel can be verified.", toRiders: false, toSellers: true },
], "pt-announcements");

export const useAnnouncements = store.use;
export const addAnnouncement = (a) => store.set((l) => [{ id: `an${Date.now()}`, ts: Date.now(), ...a }, ...l]);
