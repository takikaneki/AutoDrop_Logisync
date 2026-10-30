import { createStore } from "./createStore.js";
import { parcels, sellers, riders, complaints, reportHistory } from "../data/records.js";

const parcelStore = createStore(parcels, "pt-parcels");
export const useParcels = parcelStore.use;
export const getParcels = parcelStore.get;
export const assignRider = (id, rider) =>
  parcelStore.set((l) => l.map((p) => (p.id === id ? { ...p, rider } : p)));

const sellerStore = createStore(sellers);
export const useSellers = sellerStore.use;
export const setSellerStatus = (id, status) =>
  sellerStore.set((l) => l.map((s) => (s.id === id ? { ...s, status } : s)));

const riderStore = createStore(riders);
export const useRiders = riderStore.use;
export const setRiderStatus = (id, status) =>
  riderStore.set((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));

// Naka-save sa browser para makapag-submit ang Seller/Rider at makita ito ng Coordinator (at makita nila ang sagot).
// TODO: GET/POST /api/complaints
const complaintStore = createStore(complaints, "pt-complaints");
export const useComplaints = complaintStore.use;
export const updateComplaint = (id, patch) =>
  complaintStore.set((l) => l.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
export const addComplaintNote = (id, note) =>
  complaintStore.set((l) => l.map((c) => (c.id === id ? { ...c, notes: [...c.notes, note], updatedAt: Date.now() } : c)));
export function addComplaint(c) {
  const next = complaintStore.get().reduce((n, x) => Math.max(n, Number(String(x.id).replace(/\D/g, "")) || 0), 1000) + 1;
  const entry = {
    id: `C-${next}`,
    status: "Open",
    notes: [],
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...c,
  };
  complaintStore.set((l) => [entry, ...l]);
  return entry;
}

const reportStore = createStore(reportHistory);
export const useReportHistory = reportStore.use;
export const addReport = (r) => reportStore.set((l) => [r, ...l]);
