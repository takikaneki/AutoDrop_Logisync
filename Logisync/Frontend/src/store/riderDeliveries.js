import { useEffect } from "react";
import { createStore } from "./createStore.js";
import { api, getUser } from "../api.js";
import { getParcels, updateParcelRecord, useParcels } from "./records.js";
import { getRiderScans, syncScansFromServerParcels, useRiderScans } from "./riderScans.js";
import { fetchMyRiderParcels, reportDelivered, reportFailed, scanForDelivery } from "../services/deliveryService.js";
import { listContacts, sendMessage } from "../services/messageService.js";
import { addNotification, markRead } from "./notifications.js";
import { getParcelAddress } from "./customers.js";

const cleanField = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (!s || s === "-" || s === "—" || s === "–" || s.toLowerCase() === "n/a") return "";
  return s;
};

function resolveParcelAddress(parcel) {
  if (!parcel) return "";
  const direct = cleanField(parcel.address) || cleanField(parcel.receiver_address);
  if (direct) return direct;
  const fromParts = [
    parcel.receiver_house_number,
    parcel.receiver_street,
    parcel.receiver_barangay,
    parcel.receiver_city,
    parcel.receiver_province,
  ]
    .map(cleanField)
    .filter(Boolean)
    .join(", ");
  if (fromParts) return fromParts;
  return cleanField(getParcelAddress(parcel));
}

// Delivery ng rider. Dumadaan ang parcel sa:
// Assigned -> (na-scan) To Be Delivered -> Rescheduled (max 3 days) -> Delivered / Return to Hub.
// Naka-save sa browser (localStorage) para gumana kahit walang bagong backend endpoint.

const store = createStore([], "pt-rider-deliveries");
const me = () => Number(getUser()?.user_id);

function isSameRider(d, riderId = me()) {
  if (!d) return false;
  if (riderId && Number(d.user_id) === Number(riderId)) return true;
  const currentName = String(getUser()?.name || "").trim().toLowerCase();
  const itemRiderName = String(d.rider_name || "").trim().toLowerCase();
  if (currentName && itemRiderName && currentName === itemRiderName) return true;
  return false;
}

function isSameParcelItem(a, b) {
  if (!a || !b) return false;
  const aPid = String(a.parcel_id || "").trim().toLowerCase();
  const aTxn = String(a.transaction_number || "").trim().toLowerCase();
  const bPid = String(b.parcel_id || "").trim().toLowerCase();
  const bTxn = String(b.transaction_number || "").trim().toLowerCase();
  return (
    (aPid && (aPid === bPid || aPid === bTxn)) ||
    (aTxn && (aTxn === bPid || aTxn === bTxn))
  );
}

export const MAX_RESCHEDULES = 3;

export const STAGE = {
  TO_DELIVER: "to_deliver",
  DELIVERED: "delivered",
  FAILED: "failed",
  RETURN_TO_HUB: "return_to_hub",
};

export const FAIL_REASONS = [
  "Recipient Refused Parcel",
  "Wrong Recipient / Unknown Consignee",
  "Refused COD Payment",
  "Recipient not home",
  "Wrong or incomplete address",
  "Cannot contact the recipient",
  "Parcel damaged",
  "Other",
];

export function isRecipientRefusal(reason) {
  if (!reason) return false;
  const s = String(reason).trim().toLowerCase();
  return (
    s.includes("refused") ||
    s.includes("refusal") ||
    s.includes("wrong recipient") ||
    s.includes("unknown consignee")
  );
}

export const isCleared = (parcel) =>
  parcel?.status === "VERIFIED" ||
  parcel?.verification_status === "VERIFIED" ||
  parcel?.raw_status === "VERIFIED";

const MANILA_TZ = "Asia/Manila";

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toIsoDate(value = Date.now()) {
  const ts = typeof value === "number" ? value : new Date(value).getTime();
  if (Number.isNaN(ts) || ts <= 0) return todayIso();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

export function addDaysIso(isoDateStr, days = 1) {
  const [y, m, d] = String(isoDateStr || todayIso()).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function diffCalendarDays(dateStrA, dateStrB) {
  const [y1, m1, d1] = String(dateStrA || todayIso()).slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = String(dateStrB || todayIso()).slice(0, 10).split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

const sync = (fn) => fn().catch(() => {});

// Awtomatikong nagre-reschedule ayon sa 3-Day Rescheduling Rule:
// - Day 0: Initial scheduled date
// - Day 1: Rescheduled – Day 1 of 3 (TO_DELIVER, active delivery day)
// - Day 2: Rescheduled – Day 2 of 3 (TO_DELIVER, active delivery day)
// - Day 3: Rescheduled – Day 3 of 3 (TO_DELIVER, active delivery day)
// - Day > 3: Pagkatapos lumampas ang ika-3 araw -> Eligible for Return to Hub (FAILED, returnToHub = true)
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

    // Huwag pakialaman ang mga na-deliver na
    if (d.stage === STAGE.DELIVERED) {
      return raw;
    }

    // Huwag i-reschedule kung may delivery hold (dahil sa incident)
    if (d.delivery_hold || d.deliveryHold) {
      return raw;
    }

    // Huwag i-reschedule ang mga recipient refusal (Coordinator ang nagdedesisyon ng Return to Hub)
    if (
      d.refusal_awaiting_coordinator ||
      isRecipientRefusal(d.lastFailure) ||
      isRecipientRefusal(d.reason) ||
      (Array.isArray(d.attempts) &&
        d.attempts.some(
          (a) => a && (a.outcome === "recipient_refused" || isRecipientRefusal(a.reason))
        ))
    ) {
      return raw;
    }

    if (!Array.isArray(d.attempts)) {
      d.attempts = [];
      itemChanged = true;
    }

    const firstAtt = d.attempts.find((a) => a && a.scheduledDate);
    const initialDate =
      (firstAtt && firstAtt.scheduledDate) ||
      (d.scannedAt ? toIsoDate(d.scannedAt) : null) ||
      (d.scheduledFor ? String(d.scheduledFor).slice(0, 10) : null) ||
      today;

    const elapsedDays = diffCalendarDays(initialDate, today);

    if (elapsedDays <= 0) {
      if (d.rescheduled || d.returnToHub || d.rescheduleCount > 0) {
        d.scheduledFor = initialDate;
        d.rescheduled = false;
        d.rescheduleCount = 0;
        d.returnToHub = false;
        d.stage = STAGE.TO_DELIVER;
        d.attempts = d.attempts.filter((a) => a && a.outcome !== "return_to_hub" && a.outcome !== "rescheduled");
        itemChanged = true;
      }
    } else if (elapsedDays === 1) {
      const day1Sched = addDaysIso(initialDate, 1);
      const expectedAttempts = [
        {
          id: `att-${d.parcel_id}-auto-1-${day1Sched}`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: day1Sched,
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${day1Sched} (Day 1 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
      ];

      if (
        d.scheduledFor !== day1Sched ||
        !d.rescheduled ||
        d.rescheduleCount !== 1 ||
        d.returnToHub ||
        d.stage !== STAGE.TO_DELIVER ||
        d.attempts.length !== 1 ||
        d.attempts[0]?.rescheduleDay !== 1
      ) {
        d.scheduledFor = day1Sched;
        d.rescheduled = true;
        d.rescheduleCount = 1;
        d.returnToHub = false;
        d.stage = STAGE.TO_DELIVER;
        d.attempts = expectedAttempts;
        d.lastFailure = "Undelivered on scheduled date";
        itemChanged = true;
        parcelStatusUpdates.push({ id: d.parcel_id, txn: d.transaction_number, status: "Rescheduled" });
      }
    } else if (elapsedDays === 2) {
      const day1Sched = addDaysIso(initialDate, 1);
      const day2Sched = addDaysIso(initialDate, 2);
      const expectedAttempts = [
        {
          id: `att-${d.parcel_id}-auto-1-${day1Sched}`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: day1Sched,
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${day1Sched} (Day 1 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-2-${day2Sched}`,
          attempt: 2,
          scheduledDate: day1Sched,
          rescheduledTo: day2Sched,
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${day1Sched}) passed without delivery. Automatically rescheduled to ${day2Sched} (Day 2 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
      ];

      if (
        d.scheduledFor !== day2Sched ||
        !d.rescheduled ||
        d.rescheduleCount !== 2 ||
        d.returnToHub ||
        d.stage !== STAGE.TO_DELIVER ||
        d.attempts.length !== 2 ||
        d.attempts[1]?.rescheduleDay !== 2
      ) {
        d.scheduledFor = day2Sched;
        d.rescheduled = true;
        d.rescheduleCount = 2;
        d.returnToHub = false;
        d.stage = STAGE.TO_DELIVER;
        d.attempts = expectedAttempts;
        d.lastFailure = "Undelivered on scheduled date";
        itemChanged = true;
        parcelStatusUpdates.push({ id: d.parcel_id, txn: d.transaction_number, status: "Rescheduled" });
      }
    } else if (elapsedDays === 3) {
      const day1Sched = addDaysIso(initialDate, 1);
      const day2Sched = addDaysIso(initialDate, 2);
      const day3Sched = addDaysIso(initialDate, 3);
      const expectedAttempts = [
        {
          id: `att-${d.parcel_id}-auto-1-${day1Sched}`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: day1Sched,
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${day1Sched} (Day 1 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-2-${day2Sched}`,
          attempt: 2,
          scheduledDate: day1Sched,
          rescheduledTo: day2Sched,
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${day1Sched}) passed without delivery. Automatically rescheduled to ${day2Sched} (Day 2 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-3-${day3Sched}`,
          attempt: 3,
          scheduledDate: day2Sched,
          rescheduledTo: day3Sched,
          rescheduleDay: 3,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${day2Sched}) passed without delivery. Automatically rescheduled to ${day3Sched} (Day 3 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
      ];

      if (
        d.scheduledFor !== day3Sched ||
        !d.rescheduled ||
        d.rescheduleCount !== 3 ||
        d.returnToHub ||
        d.stage !== STAGE.TO_DELIVER ||
        d.attempts.length !== 3 ||
        d.attempts[2]?.rescheduleDay !== 3
      ) {
        d.scheduledFor = day3Sched;
        d.rescheduled = true;
        d.rescheduleCount = 3;
        d.returnToHub = false;
        d.stage = STAGE.TO_DELIVER;
        d.attempts = expectedAttempts;
        d.lastFailure = "Undelivered on scheduled date";
        itemChanged = true;
        parcelStatusUpdates.push({ id: d.parcel_id, txn: d.transaction_number, status: "Rescheduled" });
      }
    } else {
      // elapsedDays > 3: Natapos na ang buong 3-day rescheduling period -> Return to Hub
      const day1Sched = addDaysIso(initialDate, 1);
      const day2Sched = addDaysIso(initialDate, 2);
      const day3Sched = addDaysIso(initialDate, 3);
      const expectedAttempts = [
        {
          id: `att-${d.parcel_id}-auto-1-${day1Sched}`,
          attempt: 1,
          scheduledDate: initialDate,
          rescheduledTo: day1Sched,
          rescheduleDay: 1,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${initialDate}) passed without delivery. Automatically rescheduled to ${day1Sched} (Day 1 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-2-${day2Sched}`,
          attempt: 2,
          scheduledDate: day1Sched,
          rescheduledTo: day2Sched,
          rescheduleDay: 2,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${day1Sched}) passed without delivery. Automatically rescheduled to ${day2Sched} (Day 2 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-3-${day3Sched}`,
          attempt: 3,
          scheduledDate: day2Sched,
          rescheduledTo: day3Sched,
          rescheduleDay: 3,
          reason: "Undelivered on scheduled date",
          note: `Scheduled delivery date (${day2Sched}) passed without delivery. Automatically rescheduled to ${day3Sched} (Day 3 of ${MAX_RESCHEDULES}).`,
          auto: true,
          outcome: "rescheduled",
        },
        {
          id: `att-${d.parcel_id}-auto-rth`,
          attempt: 4,
          scheduledDate: day3Sched,
          rescheduledTo: null,
          rescheduleDay: 3,
          reason: "Undelivered after 3-day rescheduling period",
          note: `Parcel remained undelivered after the ${MAX_RESCHEDULES}-day rescheduling period. Automatically marked as Return to Hub.`,
          auto: true,
          outcome: "return_to_hub",
        },
      ];

      if (!d.returnToHub || d.stage !== STAGE.RETURN_TO_HUB || d.attempts.length !== 4) {
        d.stage = STAGE.RETURN_TO_HUB;
        d.returnToHub = true;
        d.returnToHubAt = d.returnToHubAt || Date.now();
        d.doneAt = d.doneAt || Date.now();
        d.rescheduled = true;
        d.rescheduleCount = 3;
        d.reason = "Undelivered after 3-day rescheduling period";
        d.lastFailure = "Undelivered after 3-day rescheduling period";
        d.attempts = expectedAttempts;
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

const hydratedLookupKeys = new Set();
const pushedLocalKeys = new Set();
let syncInFlight = false;

function mapServerParcelToDelivery(row, riderId) {
  const user = getUser();
  const scannedMs = row.scanned_at
    ? new Date(row.scanned_at).getTime()
    : row.updated_at
    ? new Date(row.updated_at).getTime()
    : Date.now();
  const doneMs = row.delivered_at
    ? new Date(row.delivered_at).getTime()
    : row.return_to_hub_at
    ? new Date(row.return_to_hub_at).getTime()
    : row.delivery_status === "DELIVERED" || row.delivery_status === "RETURN_TO_HUB" || row.delivery_status === "FAILED"
    ? new Date(row.updated_at || Date.now()).getTime()
    : null;

  const isReturnToHub = Boolean(row.return_to_hub || row.delivery_status === "RETURN_TO_HUB");
  const isRescheduled = Boolean(row.rescheduled);
  const reschedCount = Number(row.reschedule_count || 0);

  let stage = STAGE.TO_DELIVER;
  if (row.delivery_status === "DELIVERED") {
    stage = STAGE.DELIVERED;
  } else if (isReturnToHub) {
    stage = STAGE.RETURN_TO_HUB;
  } else if (row.delivery_status === "FAILED" && !isRescheduled) {
    stage = STAGE.FAILED;
  }

  let attempts = [];
  if (Array.isArray(row.attempts)) {
    attempts = row.attempts;
  } else if (typeof row.delivery_attempts === "string" && row.delivery_attempts.trim()) {
    try {
      const parsed = JSON.parse(row.delivery_attempts);
      if (Array.isArray(parsed)) attempts = parsed;
    } catch {
      attempts = [];
    }
  }

  const rawScheduled = cleanField(row.scheduled_for);
  const scannedIso = toIsoDate(scannedMs);
  const today = todayIso();
  const scheduledFor =
    rawScheduled ||
    (stage === STAGE.TO_DELIVER && !isRescheduled && scannedIso < today ? today : scannedIso);

  return {
    user_id: Number(riderId),
    rider_name: user?.name || "Rider",
    parcel_id: row.parcel_id,
    transaction_number: cleanField(row.transaction_number) || row.parcel_id,
    receiver: cleanField(row.receiver || row.receiver_name),
    contact: cleanField(row.contact || row.receiver_contact),
    address: resolveParcelAddress(row),
    contents: cleanField(row.contents),
    seller: cleanField(row.seller || row.seller_name),
    scannedAt: scannedMs,
    doneAt: doneMs,
    scheduledFor,
    rescheduled: isRescheduled,
    rescheduleCount: reschedCount,
    maxReschedules: MAX_RESCHEDULES,
    attempts,
    returnToHub: isReturnToHub,
    returnToHubAt: row.return_to_hub_at ? new Date(row.return_to_hub_at).getTime() : isReturnToHub ? doneMs : null,
    returnCoordinated: Boolean(row.return_coordinated),
    returnNote: cleanField(row.return_note),
    is_cod: Boolean(row.is_cod || String(row.payment_method || "").toUpperCase() === "COD"),
    payment_method: Boolean(row.is_cod || String(row.payment_method || "").toUpperCase() === "COD") ? "COD" : "NON_COD",
    delivery_hold: Boolean(row.delivery_hold),
    delivery_hold_reason: cleanField(row.delivery_hold_reason),
    reason: cleanField(row.last_failure || row.delivery_note),
    lastFailure: cleanField(row.last_failure || row.delivery_note),
    note: cleanField(row.delivery_note),
    proof: cleanField(row.delivery_proof),
    stage,
  };
}

export async function syncRiderDeliveriesWithServer(riderId = me()) {
  if (!riderId || syncInFlight) return;
  syncInFlight = true;
  try {
    const user = getUser();

    // 1. Reconcile any verified scans in pt-rider-scans on this device into pt-rider-deliveries
    const localScans = getRiderScans();
    if (Array.isArray(localScans) && localScans.length > 0) {
      const existingDeliveries = store.get().filter((d) => isSameRider(d, riderId));
      const missingFromDeliveries = localScans.filter((s) => {
        const isVer = !s.status || s.status === "VERIFIED" || s.status === "OUT_FOR_DELIVERY";
        if (!isVer) return false;
        return !existingDeliveries.some((d) => isSameParcelItem(d, s));
      });
      if (missingFromDeliveries.length > 0) {
        const additions = missingFromDeliveries.map((s) => {
          const ts = s.at ? new Date(s.at).getTime() : Date.now();
          return {
            user_id: Number(riderId),
            rider_name: user?.name || s.rider_name || "Rider",
            parcel_id: s.parcel_id || s.transaction_number || s.scanned,
            transaction_number: cleanField(s.transaction_number || s.scanned) || s.parcel_id,
            receiver: cleanField(s.receiver),
            contact: cleanField(s.contact),
            address: cleanField(s.address),
            contents: cleanField(s.contents),
            seller: cleanField(s.seller),
            scannedAt: ts,
            scheduledFor: toIsoDate(ts) < todayIso() ? todayIso() : toIsoDate(ts),
            rescheduled: false,
            rescheduleCount: 0,
            maxReschedules: MAX_RESCHEDULES,
            attempts: [],
            returnToHub: false,
            stage: STAGE.TO_DELIVER,
          };
        });
        store.set((list) => [...additions, ...list]);
      }
    }

    // 2. Fetch current rider parcels from shared PostgreSQL database
    let mineRes = await fetchMyRiderParcels().catch(() => null);
    let serverParcels = Array.isArray(mineRes?.parcels) ? mineRes.parcels : null;

    const serverByKey = new Map();
    if (serverParcels) {
      serverParcels.forEach((p) => {
        if (p.parcel_id) serverByKey.set(String(p.parcel_id).trim().toLowerCase(), p);
        if (p.transaction_number) serverByKey.set(String(p.transaction_number).trim().toLowerCase(), p);
      });
    }

    // 3. Push any local-only or locally-updated deliveries on this device to the shared database
    const currentLocal = store.get().filter((d) => isSameRider(d, riderId));
    let didPushLocal = false;

    for (const localItem of currentLocal) {
      const pid = String(localItem.parcel_id || localItem.transaction_number || "").trim();
      const txn = String(localItem.transaction_number || localItem.parcel_id || "").trim();
      if (!pid && !txn) continue;

      const serverRow =
        serverByKey.get(pid.toLowerCase()) ||
        serverByKey.get(txn.toLowerCase()) ||
        null;

      const needsPush =
        !serverRow ||
        (localItem.stage === STAGE.DELIVERED && serverRow.delivery_status !== "DELIVERED") ||
        ((localItem.returnToHub || localItem.stage === STAGE.RETURN_TO_HUB) &&
          !serverRow.return_to_hub &&
          serverRow.delivery_status !== "RETURN_TO_HUB" &&
          serverRow.delivery_status !== "FAILED") ||
        (localItem.stage === STAGE.FAILED &&
          serverRow.delivery_status !== "FAILED" &&
          serverRow.delivery_status !== "RETURN_TO_HUB") ||
        (localItem.rescheduled && Number(localItem.rescheduleCount || 0) > Number(serverRow.reschedule_count || 0));

      const pushKey = `${riderId}:${pid}:${txn}:${localItem.stage}:${localItem.rescheduleCount || 0}`;
      if (needsPush && !pushedLocalKeys.has(pushKey)) {
        try {
          const targetId = txn || pid;
          await scanForDelivery(targetId, {
            scheduledFor: localItem.scheduledFor || todayIso(),
            rescheduled: Boolean(localItem.rescheduled),
            rescheduleCount: Number(localItem.rescheduleCount || 0),
          });
          if (localItem.stage === STAGE.DELIVERED) {
            await reportDelivered(targetId, localItem.note || "", {
              proof: localItem.proof || "",
              attempts: localItem.attempts || [],
              scheduledFor: localItem.scheduledFor || todayIso(),
              rescheduleCount: Number(localItem.rescheduleCount || 0),
            });
          } else if (
            localItem.returnToHub ||
            localItem.stage === STAGE.RETURN_TO_HUB ||
            localItem.stage === STAGE.FAILED ||
            localItem.rescheduled
          ) {
            await reportFailed(
              targetId,
              localItem.lastFailure || localItem.reason || "Rescheduled",
              localItem.note || "",
              {
                outcome: localItem.returnToHub || localItem.stage === STAGE.RETURN_TO_HUB ? "return_to_hub" : "rescheduled",
                scheduledFor: localItem.scheduledFor || todayIso(),
                rescheduled: Boolean(localItem.rescheduled),
                rescheduleCount: Number(localItem.rescheduleCount || 0),
                returnToHub: Boolean(localItem.returnToHub || localItem.stage === STAGE.RETURN_TO_HUB),
                attempts: localItem.attempts || [],
              }
            );
          }
          pushedLocalKeys.add(pushKey);
          didPushLocal = true;
        } catch {
          // Ignore push errors for demo/non-DB parcels
        }
      }
    }

    if (didPushLocal) {
      const refreshed = await fetchMyRiderParcels().catch(() => null);
      if (Array.isArray(refreshed?.parcels)) {
        serverParcels = refreshed.parcels;
      }
    }

    // 4. Also check Delivery audit logs on the backend to recover any parcels scanned by this rider
    try {
      const auditRes = await api("/audit-logs?category=Delivery&limit=50").catch(() => null);
      const logs = Array.isArray(auditRes?.logs) ? auditRes.logs : [];
      if (logs.length > 0) {
        const knownKeys = new Set();
        (serverParcels || []).forEach((p) => {
          if (p.parcel_id) knownKeys.add(String(p.parcel_id).trim().toLowerCase());
          if (p.transaction_number) knownKeys.add(String(p.transaction_number).trim().toLowerCase());
        });
        store.get().filter((d) => isSameRider(d, riderId)).forEach((d) => {
          if (d.parcel_id) knownKeys.add(String(d.parcel_id).trim().toLowerCase());
          if (d.transaction_number) knownKeys.add(String(d.transaction_number).trim().toLowerCase());
        });

        for (const log of logs) {
          const target = String(log.target || "").trim();
          if (!target || knownKeys.has(target.toLowerCase())) continue;
          knownKeys.add(target.toLowerCase());
          try {
            const enc = encodeURIComponent(target);
            const pRes = await api(`/parcels/${enc}`).catch(() =>
              api(`/parcels/by-transaction/${enc}`).catch(() => null)
            );
            if (pRes?.parcel) {
              const p = pRes.parcel;
              await scanForDelivery(p.parcel_id || target).catch(() => {});
              if (!serverParcels) serverParcels = [];
              serverParcels.push({
                ...p,
                delivery_status:
                  /delivered/i.test(log.action) && !/failed|retry/i.test(log.action)
                    ? "DELIVERED"
                    : /failed/i.test(log.action)
                    ? "FAILED"
                    : p.delivery_status || "TO_DELIVER",
                scanned_at: p.scanned_at || log.created_at,
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore audit log fallback errors */
    }

    if (serverParcels) {
      syncScansFromServerParcels(riderId, serverParcels);

      // 5. Merge server parcels into store (adding new parcels scanned on mobile/other devices and updating existing ones)
      store.set((list) => {
        const otherUsers = list.filter((d) => !isSameRider(d, riderId));
        const myExisting = list.filter((d) => isSameRider(d, riderId));
        const matchedLocalIndices = new Set();

        const updatedFromServer = serverParcels.map((row) => {
          const mapped = mapServerParcelToDelivery(row, riderId);
          const idx = myExisting.findIndex((d) => isSameParcelItem(d, row));
          if (idx === -1) return mapped;
          matchedLocalIndices.add(idx);
          const existing = myExisting[idx];

          const isDelivered =
            mapped.stage === STAGE.DELIVERED || existing.stage === STAGE.DELIVERED;
          const isReturnToHub =
            !isDelivered &&
            (mapped.returnToHub || (existing.returnToHub && Number(mapped.rescheduleCount || 0) >= MAX_RESCHEDULES));

          const safeDoneAt =
            mapped.doneAt ||
            existing.doneAt ||
            (isDelivered ? Date.now() : null);

          return {
            ...existing,
            ...mapped,
            user_id: Number(riderId),
            parcel_id: mapped.parcel_id || existing.parcel_id,
            transaction_number: mapped.transaction_number || cleanField(existing.transaction_number),
            address: mapped.address || cleanField(existing.address),
            contact: mapped.contact || cleanField(existing.contact),
            contents: mapped.contents || cleanField(existing.contents),
            seller: mapped.seller || cleanField(existing.seller),
            proof: mapped.proof || existing.proof || "",
            note: mapped.note || existing.note || "",
            doneAt: safeDoneAt,
            attempts: mapped.attempts?.length > 0 ? mapped.attempts : existing.attempts || [],
            rescheduleCount: mapped.rescheduleCount !== undefined ? mapped.rescheduleCount : Number(existing.rescheduleCount || 0),
            rescheduled: mapped.rescheduled !== undefined ? mapped.rescheduled : Boolean(existing.rescheduled),
            returnToHub: isReturnToHub,
            stage: isDelivered ? STAGE.DELIVERED : isReturnToHub ? STAGE.RETURN_TO_HUB : STAGE.TO_DELIVER,
          };
        });

        const remainingLocal = myExisting.filter((_, idx) => !matchedLocalIndices.has(idx));
        const mergedMine = [...updatedFromServer, ...remainingLocal];
        return [...mergedMine, ...otherUsers];
      });
    }

    // 6. Look up individual parcels that still lack address, contact, or real parcel_id
    const stillMissing = store
      .get()
      .filter(
        (d) =>
          isSameRider(d, riderId) &&
          (!cleanField(d.address) || !cleanField(d.contact) || d.parcel_id === d.transaction_number)
      );

    for (const d of stillMissing) {
      const key = String(d.transaction_number || d.parcel_id || "").trim();
      if (!key || hydratedLookupKeys.has(`${riderId}:${key}`)) continue;
      hydratedLookupKeys.add(`${riderId}:${key}`);

      try {
        const enc = encodeURIComponent(key);
        const res = await api(`/parcels/by-transaction/${enc}?hydrate=1`).catch(() =>
          api(`/parcels/${encodeURIComponent(d.parcel_id || key)}?hydrate=1`).catch(() => null)
        );
        const p = res?.parcel;
        if (!p) continue;
        const addr = resolveParcelAddress(p);
        const contact = cleanField(p.receiver_contact || p.contact);
        const contents = cleanField(p.contents);
        const seller = cleanField(p.seller?.name || p.seller || p.seller_name);
        const txn = cleanField(p.transaction_number);
        const realParcelId = cleanField(p.parcel_id);

        store.set((list) =>
          list.map((item) => {
            if (!isSameRider(item, riderId)) return item;
            if (!isSameParcelItem(item, d)) return item;
            return {
              ...item,
              user_id: Number(riderId),
              parcel_id: realParcelId || item.parcel_id,
              address: cleanField(item.address) || addr,
              contact: cleanField(item.contact) || contact,
              contents: cleanField(item.contents) || contents,
              seller: cleanField(item.seller) || seller,
              transaction_number: cleanField(item.transaction_number) || txn || item.transaction_number,
            };
          })
        );
      } catch {
        // Ignore individual lookup failure
      }
    }
  } finally {
    syncInFlight = false;
  }
}

export const useMyDeliveries = () => {
  const all = store.use();
  const parcels = useParcels();
  const id = me();
  useEffect(() => {
    if (!id) return;
    syncAutomaticReschedules();
    syncRiderDeliveriesWithServer(id);

    const onFocus = () => syncRiderDeliveriesWithServer(id);
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncRiderDeliveriesWithServer(id);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => syncRiderDeliveriesWithServer(id), 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [id]);
  return all
    .filter((d) => isSameRider(d, id))
    .map((d) => {
      const addr = resolveParcelAddress(d);
      const contact = cleanField(d.contact || d.receiver_contact);
      if (addr && contact) return { ...d, address: addr, contact };
      const match = Array.isArray(parcels)
        ? parcels.find(
            (p) =>
              String(p.id || p.parcel_id || "").toLowerCase() === String(d.parcel_id || "").toLowerCase() ||
              String(p.id || p.transaction_number || "").toLowerCase() === String(d.transaction_number || "").toLowerCase()
          )
        : null;
      return {
        ...d,
        address: addr || (match ? resolveParcelAddress(match) : ""),
        contact: contact || (match ? cleanField(match.contact || match.receiver_contact) : ""),
      };
    });
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
  const resolvedAddress = resolveParcelAddress(parcel);
  const resolvedContact = cleanField(parcel.receiver_contact || parcel.contact);
  const resolvedContents = cleanField(parcel.contents);
  const resolvedSeller = cleanField(parcel.seller?.name || parcel.seller || parcel.seller_name);
  const resolvedTxn = cleanField(parcel.transaction_number) || cleanField(scanned);
  const resolvedParcelId = cleanField(parcel.parcel_id) || resolvedTxn;

  const exists = store.get().some(
    (d) =>
      isSameRider(d, id) &&
      isSameParcelItem(d, { parcel_id: resolvedParcelId, transaction_number: resolvedTxn })
  );
  if (exists) {
    store.set((l) =>
      l.map((d) =>
        isSameRider(d, id) &&
        isSameParcelItem(d, { parcel_id: resolvedParcelId, transaction_number: resolvedTxn })
          ? {
              ...d,
              user_id: id || d.user_id,
              parcel_id: resolvedParcelId || d.parcel_id,
              transaction_number: cleanField(d.transaction_number) || resolvedTxn,
              receiver: cleanField(d.receiver) || cleanField(parcel.receiver || parcel.receiver_name),
              contact: cleanField(d.contact) || resolvedContact,
              address: cleanField(d.address) || resolvedAddress,
              contents: cleanField(d.contents) || resolvedContents,
              seller: cleanField(d.seller) || resolvedSeller,
            }
          : d
      )
    );
    sync(async () => {
      await scanForDelivery(resolvedParcelId || resolvedTxn);
      await syncRiderDeliveriesWithServer(id);
    });
    return "exists";
  }
  const now = Date.now();
  const scheduledFor = toIsoDate(now);
  store.set((l) => [
    {
      user_id: id,
      rider_name: user?.name || "Rider",
      parcel_id: resolvedParcelId,
      transaction_number: resolvedTxn,
      receiver: cleanField(parcel.receiver || parcel.receiver_name),
      contact: resolvedContact,
      address: resolvedAddress,
      contents: resolvedContents,
      seller: resolvedSeller,
      scannedAt: now,
      scheduledFor,
      rescheduled: false,
      rescheduleCount: 0,
      maxReschedules: MAX_RESCHEDULES,
      attempts: [],
      returnToHub: false,
      stage: STAGE.TO_DELIVER,
    },
    ...l,
  ]);
  sync(async () => {
    await scanForDelivery(resolvedParcelId || resolvedTxn, { scheduledFor, rescheduled: false, rescheduleCount: 0 });
    await syncRiderDeliveriesWithServer(id);
  });
  return "added";
}

const patch = (parcelId, change) =>
  store.set((l) =>
    l.map((d) =>
      isSameRider(d, me()) && isSameParcelItem(d, { parcel_id: parcelId, transaction_number: parcelId })
        ? { ...d, ...(typeof change === "function" ? change(d) : change) }
        : d
    )
  );

export const markDelivered = (parcelId, { proof, note }) => {
  let nextAttempts = [];
  let scheduledFor = todayIso();
  let rescheduleCount = 0;
  let targetId = parcelId;
  patch(parcelId, (d) => {
    targetId = d.parcel_id || d.transaction_number || parcelId;
    scheduledFor = d.scheduledFor || todayIso();
    rescheduleCount = d.rescheduleCount || 0;
    nextAttempts = [
      ...(d.attempts || []),
      {
        id: `att-${parcelId}-delivered-${Date.now()}`,
        attempt: (d.attempts?.length || 0) + 1,
        failedAt: Date.now(),
        scheduledDate: scheduledFor,
        rescheduledTo: null,
        rescheduleDay: rescheduleCount,
        reason: "Delivered successfully",
        note: note || "Proof of delivery uploaded.",
        auto: false,
        outcome: "delivered",
      },
    ];
    return {
      stage: STAGE.DELIVERED,
      doneAt: Date.now(),
      proof,
      note: note || "",
      reason: "",
      returnToHub: false,
      attempts: nextAttempts,
    };
  });
  updateParcelRecord(parcelId, { status: "Delivered" });
  sync(async () => {
    await reportDelivered(targetId, note, {
      proof,
      attempts: nextAttempts,
      scheduledFor,
      rescheduleCount,
    });
    await syncRiderDeliveriesWithServer(me());
  });
};

// Kapag nabigo ang rider sa pag-deliver:
// - Kung wala pa sa 3-day rescheduling limit (< 3), awtomatikong ire-reschedule sa susunod na araw
//   at aabisuhan ang rider at coordinator.
// - Kung naabot na ang 3-day rescheduling limit (>= 3), hindi na pwedeng i-reschedule:
//   awtomatikong magiging "Return to Hub", tatanggalin sa pending deliveries ng rider,
//   at aabisuhan ang coordinator para ma-coordinate ang pagbabalik sa seller.
export const markFailed = (parcelId, { reason, note, customDate }) => {
  const current = store.get().find(
    (d) => isSameRider(d, me()) && isSameParcelItem(d, { parcel_id: parcelId, transaction_number: parcelId })
  );
  if (!current) return null;

  const count = Number(current.rescheduleCount || 0);
  const today = todayIso();
  const baseDate = current.scheduledFor && current.scheduledFor >= today ? current.scheduledFor : today;
  const txn = current.transaction_number || parcelId;
  const targetId = current.parcel_id || txn;
  const riderName = getUser()?.name || current.rider_name || "Rider";

  // 1. RECIPIENT REFUSAL:
  // HINDI awtomatikong nagre-reschedule.
  // Nagpapadala ng direct message sa Coordinator para sa Return-to-Hub desisyon.
  if (isRecipientRefusal(reason)) {
    const attemptEntry = {
      id: `att-${parcelId}-refusal-${Date.now()}`,
      attempt: (current.attempts?.length || 0) + 1,
      failedAt: Date.now(),
      scheduledDate: baseDate,
      rescheduledTo: null,
      rescheduleDay: count,
      reason,
      note: note || "Recipient refused delivery. Direct message sent to Coordinator for Return to Hub decision.",
      auto: false,
      outcome: "recipient_refused",
    };
    const nextAttempts = [...(current.attempts || []), attemptEntry];

    patch(parcelId, {
      stage: STAGE.FAILED,
      doneAt: Date.now(),
      rescheduled: false,
      refusal_awaiting_coordinator: true,
      lastFailure: reason,
      lastNote: note || "",
      reason,
      note: note || "",
      proof: "",
      attempts: nextAttempts,
    });

    updateParcelRecord(parcelId, { status: "Failed Delivery" });
    if (txn !== parcelId) updateParcelRecord(txn, { status: "Failed Delivery" });

    addNotification({
      id: `refusal-${parcelId}-${Date.now()}`,
      kind: "delivery",
      icon: "fa-shield-halved",
      tone: "red",
      title: `Recipient Refusal: ${txn}`,
      text: `${riderName} reported "${reason}". Direct message sent to Messages. Coordinator review needed for Return to Hub.`,
      read: false,
      to: "/messages",
    });

    sync(async () => {
      await reportFailed(targetId, reason, note, {
        outcome: "recipient_refused",
        scheduledFor: baseDate,
        rescheduled: false,
        rescheduleCount: count,
        returnToHub: false,
        attempts: nextAttempts,
      }).catch(() => {});

      try {
        const contacts = await listContacts();
        const coordinator = contacts.find((c) => c.role === "coordinator");
        if (coordinator) {
          const msg = `🚨 [FAILED DELIVERY REPORT - RECIPIENT REFUSAL]
Tracking / Txn: ${txn}
Parcel ID: ${current.parcel_id || txn}
Receiver: ${current.receiver || "Consignee"}
Contact: ${current.contact || "N/A"}
Address: ${current.address || "N/A"}
Refusal Reason: ${reason}
Rider: ${riderName} (ID: ${me()})
Notes: ${note || "Recipient refused parcel."}

Action Required: Please review and initiate Return to Hub.`;
          await sendMessage(coordinator.user_id, msg);
        }
      } catch (err) {
        console.warn("Could not send refusal message to coordinator:", err);
      }

      await syncRiderDeliveriesWithServer(me());
    });

    return {
      outcome: "recipient_refused",
      scheduledFor: null,
      rescheduleCount: count,
      maxReschedules: MAX_RESCHEDULES,
    };
  }

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
    const nextAttempts = [...(current.attempts || []), attemptEntry];

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
      attempts: nextAttempts,
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

    sync(async () => {
      await reportFailed(targetId, reason, note, {
        outcome: "rescheduled",
        scheduledFor: nextDate,
        rescheduled: true,
        rescheduleCount: nextCount,
        returnToHub: false,
        attempts: nextAttempts,
      });
      await syncRiderDeliveriesWithServer(me());
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
  const nextAttempts = [...(current.attempts || []), attemptEntry];

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
    attempts: nextAttempts,
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

  sync(async () => {
    await reportFailed(targetId, reason, note, {
      outcome: "return_to_hub",
      scheduledFor: baseDate,
      rescheduled: true,
      rescheduleCount: MAX_RESCHEDULES,
      returnToHub: true,
      attempts: nextAttempts,
    });
    await syncRiderDeliveriesWithServer(me());
  });
  return { outcome: "return_to_hub", scheduledFor: null, rescheduleCount: count, maxReschedules: MAX_RESCHEDULES };
};

// Subukan ulit ang failed delivery — HINDING-HINDI pwede kapag Return to Hub / lampas na sa 3-day limit
export const reattempt = (parcelId) => {
  const current = store.get().find(
    (d) => isSameRider(d, me()) && isSameParcelItem(d, { parcel_id: parcelId, transaction_number: parcelId })
  );
  if (!current) return false;
  if (current.returnToHub || current.stage === STAGE.RETURN_TO_HUB || Number(current.rescheduleCount || 0) >= MAX_RESCHEDULES) {
    return false;
  }
  const nextCount = Number(current.rescheduleCount || 0) + 1;
  const nextDate = addDaysIso(todayIso(), 1);
  const targetId = current.parcel_id || current.transaction_number || parcelId;
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
  sync(async () => {
    await scanForDelivery(targetId, { scheduledFor: nextDate, rescheduled: true, rescheduleCount: nextCount });
    await syncRiderDeliveriesWithServer(me());
  });
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

// Coordinator initiated/approved Return to Hub (e.g. from recipient refusal)
export function initiateReturnToHubLocal(parcelIdOrTxn, reason = "") {
  if (!parcelIdOrTxn) return null;
  const key = String(parcelIdOrTxn).trim().toLowerCase();
  let found = null;
  store.set((list) =>
    list.map((d) => {
      const match =
        String(d.parcel_id || "").toLowerCase() === key ||
        String(d.transaction_number || "").toLowerCase() === key;
      if (!match) return d;
      const nextAttempts = [
        ...(d.attempts || []),
        {
          id: `att-${d.parcel_id}-rth-coord-${Date.now()}`,
          attempt: (d.attempts?.length || 0) + 1,
          failedAt: Date.now(),
          scheduledDate: d.scheduledFor || todayIso(),
          rescheduledTo: null,
          rescheduleDay: d.rescheduleCount || 1,
          reason: reason || "Coordinator approved Return to Hub",
          note: "Return to Hub approved by Coordinator following recipient refusal review.",
          auto: false,
          outcome: "return_to_hub",
        },
      ];
      found = {
        ...d,
        stage: STAGE.RETURN_TO_HUB,
        returnToHub: true,
        returnToHubAt: Date.now(),
        refusal_awaiting_coordinator: false,
        lastFailure: reason || d.lastFailure || "Recipient Refused Parcel",
        attempts: nextAttempts,
      };
      return found;
    })
  );
  updateParcelRecord(parcelIdOrTxn, { status: "Return to Hub" });
  return found;
}
