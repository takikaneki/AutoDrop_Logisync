import { createStore } from "./createStore.js";
import { getUser } from "../api.js";

const m = (mins) => Date.now() - mins * 60 * 1000;

// Seed lang ito. Ang mga bagong action (assign rider, suspend seller, announcement, atbp.) ay nadadagdag dito.
// TODO: GET /api/audit-logs
const store = createStore([
  { id: "a1", ts: m(12), actor: "Coordinator", category: "Verification", action: "Verified parcel", target: "PT-002", detail: "QR scanned, video matched." },
  { id: "a2", ts: m(55), actor: "Coordinator", category: "Verification", action: "Flagged parcel", target: "PT-003", detail: "Reason: Item mismatch." },
  { id: "a3", ts: m(130), actor: "Coordinator", category: "Parcels", action: "Reassigned rider", target: "PT-014", detail: "Mark Cruz → Paolo Lim" },
  { id: "a4", ts: m(260), actor: "Coordinator", category: "Announcements", action: "Sent announcement", target: "Riders & Sellers", detail: "Delivery Cancellation Notice" },
  { id: "a5", ts: m(480), actor: "Coordinator", category: "Sellers", action: "Approved seller", target: "Joy Aquino", detail: "Documents complete." },
  { id: "a6", ts: m(1500), actor: "Coordinator", category: "Complaints", action: "Resolved complaint", target: "C-1003", detail: "Refund request handled by seller." },
  { id: "a7", ts: m(1700), actor: "Coordinator", category: "Verification", action: "Returned to seller", target: "PT-006", detail: "Incomplete video." },
  { id: "a8", ts: m(2900), actor: "Coordinator", category: "Reports", action: "Generated report", target: "Report-2026-10-09-001", detail: "Delivered parcels, Sep 1–Sep 27" },
]);

export const useAudit = store.use;

export function logAction({ category, action, target = "", detail = "" }) {
  const actor = getUser()?.name || "Coordinator";
  store.set((l) => [{ id: `a${Date.now()}`, ts: Date.now(), actor, category, action, target, detail }, ...l]);
}
