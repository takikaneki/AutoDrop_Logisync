import { useEffect } from "react";
import { createStore } from "./createStore.js";
import { getUser } from "../api.js";
import { getParcels, updateParcelRecord, useParcels } from "./records.js";
import { useRiderScans } from "./riderScans.js";
import { reportDelivered, reportFailed, scanForDelivery } from "../services/deliveryService.js";
import { addNotification, markRead } from "./notifications.js";

// Delivery ng rider. Dumadaan ang parcel sa:
// Assigned -> (na-scan) To Be Delivered -> Rescheduled (max 3 days) -> Delivered / Return to Hub.
// Naka-save sa browser (localStorage) para gumana kahit walang bagong backend endpoint.

const store = createStore([], "pt-rider-deliveries");
const me = () => Number(getUser()?.user_id);

export const MAX_RESCHEDULES = 3;

export const STAGE = {
  TO_DELIVER: "to_deliver",
  DELIVERED: "delivered",
  FAILED: "failed",
  RETURN_TO_HUB: "return_to_hub",
};

export const FAIL_REASONS = [
  "Recipient not home",
  "Wrong or incomplete address",
  "Recipient refused the parcel",
  "Cannot contact the recipient",
  "Parcel damaged",
  "Other",
];

export const isCleared = (parcel) => parcel?.status === "VERIFIED";

const pad = (n) => String(n).padStart(2, "0");

export function toIsoDate(value = Date.now()) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return todayIso();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysIso(isoDateStr, days = 1) {
  const base = isoDateStr ? new Date(`${isoDateStr}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

const sync = (fn) => fn().catch(() => {});

// Awtomatikong nagre-reschedule kapag lumampas na ang scheduled delivery date (hanggang 3 araw).
// Kapag hindi pa rin na-deliver pagkatapos ng 3-day rescheduling period, nagiging "Return to Hub"
// at tinatanggal sa pending deliveries ng rider.
export function syncAutomaticReschedules() {
  const current = store.get();
  if (!Array.isArray(current) || current.length === 0) return;

  const today = todayIso();
  let changed = false;
  const pendingCoordinatorNotifs = [];
  const parcelStatusUpdates = [];

  const nextList = current.map((raw) => {
    let d = { ...raw };
    let itemChanged = false;

    // Migration para sa mga lumang record sa localStorage (hal. na-reschedule bago nagkaroon ng counter/history)
    if (!Array.isArray(d.attempts)) {
      d.attempts = [];
      itemChanged = true;
    }

    if (!d.scheduledFor) {
      d.scheduledFor = toIsoDate(d.scannedAt || Date.now());
      itemChanged = true;
    }

    if (d.rescheduled && (!d.rescheduleCount || d.rescheduleCount < 1)) {
      d.rescheduleCount = 1;
      if (d.attempts.length === 0) {
        const prevDate = addDaysIso(d.scheduledFor, -1);
        d.attempts = [
          {
            id: `att-${d.parcel_id}-seed-1`,
            attempt: 1,
            failedAt: d.scannedAt || Date.now(),
            scheduledDate: prevDate,
            rescheduledTo: d.scheduledFor,
            rescheduleDay: 1,
            reason: d.lastFailure || d.reason || "Delivery attempt failed",
            note: d.note || `Rescheduled to ${d.scheduledFor} (Day 1 of ${MAX_RESCHEDULES})`,
            auto: false,
            outcome: "rescheduled",
          },
        ];
      }
      itemChanged = true;
    }

    // Kung nasa pending deliveries (TO_DELIVER) at lumampas na ang scheduled date
    if (d.stage === STAGE.TO_DELIVER && d.scheduledFor && d.scheduledFor < today) {
      let count = Number(d.rescheduleCount || 0);
      let sched = d.scheduledFor;
      const attempts = [...(d.attempts || [])];

      while (sched < today) {
        if (count < MAX_RESCHEDULES) {
          count += 1;
          const nextDate = addDaysIso(sched, 1);
          const reason = d.lastFailure || d.reason || "Undelivered on scheduled date";
          attempts.push({
            id: `att-${d.parcel_id}-auto-${count}-${nextDate}`,
            attempt: attempts.length + 1,
            failedAt: new Date(`${sched}T23:59:00`).getTime(),
            scheduledDate: sched,
            rescheduledTo: nextDate,
            rescheduleDay: count,
            reason,
            note: `Scheduled delivery date (${sched}) passed without delivery. Automatically rescheduled to ${nextDate} (Day ${count} of ${MAX_RESCHEDULES}).`,
            auto: true,
            outcome: "rescheduled",
          });
          sched = nextDate;
          d.scheduledFor = nextDate;
          d.rescheduled = true;
          d.rescheduleCount = count;
          d.lastFailure = reason;
          d.lastRescheduledAt = Date.now();
          itemChanged = true;
        } else {
          // Naabot na ang 3-day rescheduling limit at lumampas pa rin ang ika-3 araw -> Return to Hub
          const reason = d.lastFailure || d.reason || "Undelivered after 3-day rescheduling period";
          attempts.push({
            id: `att-${d.parcel_id}-auto-rth`,
            attempt: attempts.length + 1,
            failedAt: new Date(`${sched}T23:59:00`).getTime(),
            scheduledDate: sched,
            rescheduledTo: null,
            rescheduleDay: MAX_RESCHEDULES,
            reason,
            note: `Parcel remained undelivered after the ${MAX_RESCHEDULES}-day rescheduling period. Automatically marked as Return to Hub.`,
            auto: true,
            outcome: "return_to_hub",
          });
          d.stage = STAGE.RETURN_TO_HUB;
          d.returnToHub = true;
          d.returnToHubAt = Date.now();
          d.doneAt = Date.now();
          d.reason = reason;
          d.lastFailure = reason;
          d.attempts = attempts;
          itemChanged = true;

          pendingCoordinatorNotifs.push({
            id: `rth-${d.parcel_id}`,
            kind: "delivery",
            icon: "fa-warehouse",
            tone: "red",
            title: `Return to Hub: ${d.transaction_number || d.parcel_id}`,
            text: `${d.receiver || "Customer"} (${d.seller || "Seller"}) remained undelivered after the ${MAX_RESCHEDULES}-day rescheduling limit and must be returned to the hub.`,
            read: false,
            to: "/notifications",
          });
          parcelStatusUpdates.push({ id: d.parcel_id, txn: d.transaction_number, status: "Return to Hub" });
          break;
        }
      }

      if (d.stage === STAGE.TO_DELIVER) {
        d.attempts = attempts;
        parcelStatusUpdates.push({ id: d.parcel_id, txn: d.transaction_number, status: "Rescheduled" });
      }
    }

    if (itemChanged) changed = true;
    return itemChanged ? d : raw;
  });

  if (changed) {
    store.set(nextList);
    pendingCoordinatorNotifs.forEach((n) => addNotification(n));
    parcelStatusUpdates.forEach((u) => {
      updateParcelRecord(u.id, { status: u.status });
      if (u.txn && u.txn !== u.id) updateParcelRecord(u.txn, { status: u.status });
    });
  }
}

// Patakbuhin agad sa pag-load ng store
try {
  syncAutomaticReschedules();
} catch {
  // Ignore init errors
}

export const getAllDeliveries = () => store.get();

export const useAllDeliveries = () => {
  const all = store.use();
  useEffect(() => {
    syncAutomaticReschedules();
  }, [all.length]);
  return all;
};

export const useMyDeliveries = () => {
  const all = store.use();
  useEffect(() => {
    syncAutomaticReschedules();
  }, [all.length]);
  const id = me();
  return all.filter((d) => d.user_id === id);
};

// Hanapin ang delivery record ng isang parcel (para sa Coordinator, Seller, at Rider views)
export function getDeliveryRecordForParcel(parcelIdOrTxn) {
  if (!parcelIdOrTxn) return null;
  const key = String(parcelIdOrTxn).trim().toLowerCase();
  const list = store.get();
  return (
    list.find(
      (d) =>
        String(d.parcel_id || "").trim().toLowerCase() === key ||
        String(d.transaction_number || "").trim().toLowerCase() === key
    ) || null
  );
}

// Mga parcel na in-assign ng coordinator sa rider na ito (galing sa Parcels ng coordinator).
function assignedFor(parcels) {
  const name = (getUser()?.name || "").trim().toLowerCase();
  if (!name) return [];
  return parcels
    .filter((p) => String(p.rider || "").trim().toLowerCase() === name && p.status === "In Transit")
    .map((p) => ({
      parcel_id: p.id,
      transaction_number: p.id,
      receiver: p.recipient,
      receiver_contact: "",
      address: p.address,
      contents: p.item,
      seller: p.shop,
      amount: p.amount,
      status: p.verification === "Verified" ? "VERIFIED" : p.verification === "Flagged" ? "REJECTED" : "VIDEO_SUBMITTED",
      verification_status: p.verification,
      updated_at: new Date(p.ts).toISOString(),
    }));
}

// Assigned pa lang (hindi pa na-scan ng rider)
export function useAssignedParcels() {
  const parcels = useParcels();
  const deliveries = useMyDeliveries();
  const scans = useRiderScans();
  const taken = new Set([...deliveries, ...scans].flatMap((x) => [x.parcel_id, x.transaction_number]));
  return assignedFor(parcels).filter((p) => !taken.has(p.parcel_id) && !taken.has(p.transaction_number));
}

// Hanapin sa assigned parcels ng rider ang na-scan/na-type na value
export function findAssigned(value) {
  const v = String(value || "").trim().toLowerCase();
  return assignedFor(getParcels()).find((p) => [p.parcel_id, p.transaction_number].some((x) => String(x).toLowerCase() === v)) || null;
}

// Pagkatapos ma-scan: kapag verified, mapupunta sa To Be Delivered. Ibinabalik ang resulta.
export function addToDeliver(parcel, scanned) {
  if (!isCleared(parcel)) return "not_cleared";
  const user = getUser();
  const id = Number(user?.user_id);
  const exists = store.get().some((d) => d.user_id === id && d.parcel_id === parcel.parcel_id);
  if (exists) return "exists";
  const now = Date.now();
  store.set((l) => [
    {
      user_id: id,
      rider_name: user?.name || "Rider",
      parcel_id: parcel.parcel_id,
      transaction_number: parcel.transaction_number || scanned,
      receiver: parcel.receiver,
      contact: parcel.receiver_contact || "",
      address: parcel.address || "",
      contents: parcel.contents || "",
      seller: parcel.seller || "",
      scannedAt: now,
      scheduledFor: toIsoDate(now),
      rescheduled: false,
      rescheduleCount: 0,
      maxReschedules: MAX_RESCHEDULES,
      attempts: [],
      returnToHub: false,
      stage: STAGE.TO_DELIVER,
    },
    ...l,
  ]);
  sync(() => scanForDelivery(parcel.parcel_id));
  return "added";
}

const patch = (parcelId, change) =>
  store.set((l) =>
    l.map((d) =>
      d.user_id === me() && d.parcel_id === parcelId
        ? { ...d, ...(typeof change === "function" ? change(d) : change) }
        : d
    )
  );

export const markDelivered = (parcelId, { proof, note }) => {
  patch(parcelId, (d) => ({
    stage: STAGE.DELIVERED,
    doneAt: Date.now(),
    proof,
    note: note || "",
    reason: "",
    returnToHub: false,
    attempts: [
      ...(d.attempts || []),
      {
        id: `att-${parcelId}-delivered-${Date.now()}`,
        attempt: (d.attempts?.length || 0) + 1,
        failedAt: Date.now(),
        scheduledDate: d.scheduledFor || todayIso(),
        rescheduledTo: null,
        rescheduleDay: d.rescheduleCount || 0,
        reason: "Delivered successfully",
        note: note || "Proof of delivery uploaded.",
        auto: false,
        outcome: "delivered",
      },
    ],
  }));
  updateParcelRecord(parcelId, { status: "Delivered" });
  sync(() => reportDelivered(parcelId, note));
};

// Kapag nabigo ang rider sa pag-deliver:
// - Kung wala pa sa 3-day rescheduling limit (< 3), awtomatikong ire-reschedule sa susunod na araw
//   at aabisuhan ang rider at coordinator.
// - Kung naabot na ang 3-day rescheduling limit (>= 3), hindi na pwedeng i-reschedule:
//   awtomatikong magiging "Return to Hub", tatanggalin sa pending deliveries ng rider,
//   at aabisuhan ang coordinator para ma-coordinate ang pagbabalik sa seller.
export const markFailed = (parcelId, { reason, note, customDate }) => {
  const current = store.get().find((d) => d.user_id === me() && d.parcel_id === parcelId);
  if (!current) return null;

  const count = Number(current.rescheduleCount || 0);
  const today = todayIso();
  const baseDate = current.scheduledFor && current.scheduledFor >= today ? current.scheduledFor : today;
  const txn = current.transaction_number || parcelId;
  const riderName = getUser()?.name || current.rider_name || "Rider";

  if (count < MAX_RESCHEDULES) {
    const nextCount = count + 1;
    const nextDate = customDate && customDate > baseDate ? customDate : addDaysIso(baseDate, 1);
    const attemptEntry = {
      id: `att-${parcelId}-${Date.now()}`,
      attempt: (current.attempts?.length || 0) + 1,
      failedAt: Date.now(),
      scheduledDate: baseDate,
      rescheduledTo: nextDate,
      rescheduleDay: nextCount,
      reason,
      note: note || `Automatically rescheduled to ${nextDate} (Day ${nextCount} of ${MAX_RESCHEDULES}).`,
      auto: false,
      outcome: "rescheduled",
    };

    patch(parcelId, {
      stage: STAGE.TO_DELIVER,
      doneAt: null,
      rescheduled: true,
      rescheduleCount: nextCount,
      scheduledFor: nextDate,
      lastFailure: reason,
      lastNote: note || "",
      lastRescheduledAt: Date.now(),
      reason: "",
      note: note || "",
      proof: "",
      attempts: [...(current.attempts || []), attemptEntry],
    });

    updateParcelRecord(parcelId, { status: "Rescheduled" });
    if (txn !== parcelId) updateParcelRecord(txn, { status: "Rescheduled" });

    addNotification({
      id: `resched-${parcelId}-${nextCount}`,
      kind: "delivery",
      icon: "fa-calendar-day",
      tone: "orange",
      title: `Rescheduled (Day ${nextCount}/${MAX_RESCHEDULES}): ${txn}`,
      text: `${riderName} reported "${reason}". New delivery date assigned: ${nextDate}.`,
      read: false,
      to: "/notifications",
    });

    return { outcome: "rescheduled", scheduledFor: nextDate, rescheduleCount: nextCount, maxReschedules: MAX_RESCHEDULES };
  }

  // Naabot na ang 3-day rescheduling limit -> Return to Hub
  const attemptEntry = {
    id: `att-${parcelId}-${Date.now()}`,
    attempt: (current.attempts?.length || 0) + 1,
    failedAt: Date.now(),
    scheduledDate: baseDate,
    rescheduledTo: null,
    rescheduleDay: MAX_RESCHEDULES,
    reason,
    note: note || `Maximum ${MAX_RESCHEDULES}-day rescheduling limit reached. Marked as Return to Hub.`,
    auto: false,
    outcome: "return_to_hub",
  };

  patch(parcelId, {
    stage: STAGE.RETURN_TO_HUB,
    returnToHub: true,
    returnToHubAt: Date.now(),
    doneAt: Date.now(),
    reason,
    lastFailure: reason,
    lastNote: note || "",
    note: note || "",
    proof: "",
    attempts: [...(current.attempts || []), attemptEntry],
  });

  updateParcelRecord(parcelId, { status: "Return to Hub" });
  if (txn !== parcelId) updateParcelRecord(txn, { status: "Return to Hub" });

  addNotification({
    id: `rth-${parcelId}`,
    kind: "delivery",
    icon: "fa-warehouse",
    tone: "red",
    title: `Return to Hub: ${txn}`,
    text: `${riderName} · Reached maximum ${MAX_RESCHEDULES}-day rescheduling limit (${reason}). Coordinate return to hub and seller (${current.seller || "Seller"}).`,
    read: false,
    to: "/notifications",
  });

  sync(() => reportFailed(parcelId, reason, note));
  return { outcome: "return_to_hub", scheduledFor: null, rescheduleCount: count, maxReschedules: MAX_RESCHEDULES };
};

// Subukan ulit ang failed delivery — HINDING-HINDI pwede kapag Return to Hub / lampas na sa 3-day limit
export const reattempt = (parcelId) => {
  const current = store.get().find((d) => d.user_id === me() && d.parcel_id === parcelId);
  if (!current) return false;
  if (current.returnToHub || current.stage === STAGE.RETURN_TO_HUB || Number(current.rescheduleCount || 0) >= MAX_RESCHEDULES) {
    return false;
  }
  const nextCount = Number(current.rescheduleCount || 0) + 1;
  const nextDate = addDaysIso(todayIso(), 1);
  patch(parcelId, {
    stage: STAGE.TO_DELIVER,
    doneAt: null,
    reason: "",
    note: "",
    scheduledFor: nextDate,
    rescheduled: true,
    rescheduleCount: nextCount,
    lastRescheduledAt: Date.now(),
  });
  sync(() => scanForDelivery(parcelId));
  return true;
};

// Kinumpirma ng Coordinator ang reschedule: hanggang 3 araw lang ang pinapayagan.
// Kapag naabot na ang 3-day limit, magiging Return to Hub sa halip na i-reschedule ulit.
export const rescheduleDelivery = (userId, parcelId, date, { reason = "", note = "" } = {}) => {
  let result = null;
  store.set((l) =>
    l.map((d) => {
      const match = (userId ? d.user_id === userId : true) && d.parcel_id === parcelId;
      if (!match) return d;

      const count = Number(d.rescheduleCount || 0);
      if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB || count >= MAX_RESCHEDULES) {
        const updated = {
          ...d,
          stage: STAGE.RETURN_TO_HUB,
          returnToHub: true,
          returnToHubAt: d.returnToHubAt || Date.now(),
          doneAt: d.doneAt || Date.now(),
        };
        result = { outcome: "return_to_hub", delivery: updated };
        return updated;
      }

      const nextCount = count + 1;
      const nextDate = date || addDaysIso(d.scheduledFor || todayIso(), 1);
      const failureReason = reason || d.reason || d.lastFailure || "Rescheduled delivery";
      const updated = {
        ...d,
        stage: STAGE.TO_DELIVER,
        doneAt: null,
        lastFailure: failureReason,
        reason: "",
        note: note || d.note || "",
        scheduledFor: nextDate,
        rescheduled: true,
        rescheduleCount: nextCount,
        lastRescheduledAt: Date.now(),
        attempts: [
          ...(d.attempts || []),
          {
            id: `att-${parcelId}-coord-${Date.now()}`,
            attempt: (d.attempts?.length || 0) + 1,
            failedAt: Date.now(),
            scheduledDate: d.scheduledFor || todayIso(),
            rescheduledTo: nextDate,
            rescheduleDay: nextCount,
            reason: failureReason,
            note: note || `Rescheduled to ${nextDate} (Day ${nextCount} of ${MAX_RESCHEDULES}).`,
            auto: false,
            outcome: "rescheduled",
          },
        ],
      };
      result = { outcome: "rescheduled", delivery: updated };
      return updated;
    })
  );
  return result;
};

// Coordinator: i-coordinate ang pagbabalik ng Return-to-Hub parcel pabalik sa Seller
export const coordinateReturnToSeller = (parcelId, { note = "", by } = {}) => {
  const coordinatorName = by || getUser()?.name || "Coordinator";
  let target = null;

  store.set((l) =>
    l.map((d) => {
      if (d.parcel_id !== parcelId && d.transaction_number !== parcelId) return d;
      const updated = {
        ...d,
        stage: STAGE.RETURN_TO_HUB,
        returnToHub: true,
        returnToHubAt: d.returnToHubAt || Date.now(),
        returnCoordinated: true,
        returnCoordinatedAt: Date.now(),
        returnCoordinatedBy: coordinatorName,
        returnNote: note || "Return to seller coordinated by hub.",
      };
      target = updated;
      return updated;
    })
  );

  if (target) {
    markRead(`rth-${target.parcel_id}`);
    updateParcelRecord(target.parcel_id, { status: "Return to Hub", returnCoordinated: true });
    if (target.transaction_number && target.transaction_number !== target.parcel_id) {
      updateParcelRecord(target.transaction_number, { status: "Return to Hub", returnCoordinated: true });
    }
  }
  return target;
};
