import { useEffect } from "react";
import { createStore } from "./createStore.js";
import { api, getUser } from "../api.js";
import { getParcels, updateParcelRecord, useParcels } from "./records.js";
import { syncScansFromServerParcels, useRiderScans } from "./riderScans.js";
import { fetchMyRiderParcels, reportDelivered, reportFailed, scanForDelivery } from "../services/deliveryService.js";
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

  return {
    user_id: riderId,
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
    scheduledFor: cleanField(row.scheduled_for) || toIsoDate(scannedMs),
    rescheduled: isRescheduled,
    rescheduleCount: reschedCount,
    maxReschedules: MAX_RESCHEDULES,
    attempts,
    returnToHub: isReturnToHub,
    returnToHubAt: row.return_to_hub_at ? new Date(row.return_to_hub_at).getTime() : isReturnToHub ? doneMs : null,
    returnCoordinated: Boolean(row.return_coordinated),
    returnNote: cleanField(row.return_note),
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
    const mineRes = await fetchMyRiderParcels().catch(() => null);
    const serverParcels = Array.isArray(mineRes?.parcels) ? mineRes.parcels : null;

    if (serverParcels) {
      syncScansFromServerParcels(riderId, serverParcels);

      const serverByKey = new Map();
      serverParcels.forEach((p) => {
        if (p.parcel_id) serverByKey.set(String(p.parcel_id).toLowerCase(), p);
        if (p.transaction_number) serverByKey.set(String(p.transaction_number).toLowerCase(), p);
      });

      // Push any local-only scanned deliveries on this device to the shared database so web & mobile stay in sync
      const currentLocal = store.get().filter((d) => d.user_id === riderId);
      for (const localItem of currentLocal) {
        const pid = String(localItem.parcel_id || localItem.transaction_number || "").trim();
        if (!pid) continue;
        const inServer =
          serverByKey.has(String(localItem.parcel_id || "").toLowerCase()) ||
          serverByKey.has(String(localItem.transaction_number || "").toLowerCase());
        const pushKey = `${riderId}:${pid}:${localItem.stage}:${localItem.rescheduleCount || 0}`;
        if (!inServer && !pushedLocalKeys.has(pushKey)) {
          pushedLocalKeys.add(pushKey);
          try {
            await scanForDelivery(pid, {
              scheduledFor: localItem.scheduledFor,
              rescheduled: localItem.rescheduled,
              rescheduleCount: localItem.rescheduleCount,
            });
            if (localItem.stage === STAGE.DELIVERED) {
              await reportDelivered(pid, localItem.note || "", {
                proof: localItem.proof || "",
                attempts: localItem.attempts || [],
                scheduledFor: localItem.scheduledFor,
                rescheduleCount: localItem.rescheduleCount || 0,
              });
            } else if (
              localItem.returnToHub ||
              localItem.stage === STAGE.RETURN_TO_HUB ||
              localItem.stage === STAGE.FAILED ||
              localItem.rescheduled
            ) {
              await reportFailed(pid, localItem.lastFailure || localItem.reason || "Rescheduled", localItem.note || "", {
                outcome: localItem.returnToHub || localItem.stage === STAGE.RETURN_TO_HUB ? "return_to_hub" : "rescheduled",
                scheduledFor: localItem.scheduledFor,
                rescheduled: Boolean(localItem.rescheduled),
                rescheduleCount: Number(localItem.rescheduleCount || 0),
                returnToHub: Boolean(localItem.returnToHub || localItem.stage === STAGE.RETURN_TO_HUB),
                attempts: localItem.attempts || [],
              });
            }
          } catch {
            // Ignore push errors for demo/non-DB parcels
          }
        }
      }

      // Merge server parcels into store (adding new parcels scanned on mobile/other devices and updating existing ones)
      store.set((list) => {
        const otherUsers = list.filter((d) => d.user_id !== riderId);
        const myExisting = list.filter((d) => d.user_id === riderId);
        const matchedLocalIds = new Set();

        const updatedFromServer = serverParcels.map((row) => {
          const mapped = mapServerParcelToDelivery(row, riderId);
          const existing = myExisting.find(
            (d) =>
              String(d.parcel_id || "").toLowerCase() === String(row.parcel_id || "").toLowerCase() ||
              (row.transaction_number &&
                String(d.transaction_number || "").toLowerCase() === String(row.transaction_number).toLowerCase())
          );
          if (!existing) return mapped;
          matchedLocalIds.add(existing.parcel_id);

          return {
            ...existing,
            ...mapped,
            address: mapped.address || cleanField(existing.address),
            contact: mapped.contact || cleanField(existing.contact),
            contents: mapped.contents || cleanField(existing.contents),
            seller: mapped.seller || cleanField(existing.seller),
            proof: mapped.proof || existing.proof || "",
            note: mapped.note || existing.note || "",
            attempts: mapped.attempts.length >= (existing.attempts?.length || 0) ? mapped.attempts : existing.attempts || [],
            rescheduleCount: Math.max(mapped.rescheduleCount, Number(existing.rescheduleCount || 0)),
            rescheduled: mapped.rescheduled || Boolean(existing.rescheduled),
            returnToHub: mapped.returnToHub || Boolean(existing.returnToHub),
            stage:
              mapped.stage === STAGE.DELIVERED || existing.stage === STAGE.DELIVERED
                ? STAGE.DELIVERED
                : mapped.returnToHub || existing.returnToHub || mapped.stage === STAGE.RETURN_TO_HUB
                ? STAGE.RETURN_TO_HUB
                : mapped.stage,
          };
        });

        const remainingLocal = myExisting.filter((d) => !matchedLocalIds.has(d.parcel_id));
        const mergedMine = [...updatedFromServer, ...remainingLocal];
        return [...mergedMine, ...otherUsers];
      });
    }

    // Look up individual parcels that still lack address or contact
    const stillMissing = store
      .get()
      .filter((d) => d.user_id === riderId && (!cleanField(d.address) || !cleanField(d.contact)));

    for (const d of stillMissing) {
      const key = String(d.transaction_number || d.parcel_id || "").trim();
      if (!key || hydratedLookupKeys.has(`${riderId}:${key}`)) continue;
      hydratedLookupKeys.add(`${riderId}:${key}`);

      try {
        const enc = encodeURIComponent(key);
        const res = await api(`/parcels/by-transaction/${enc}`).catch(() =>
          api(`/parcels/${encodeURIComponent(d.parcel_id || key)}`).catch(() => null)
        );
        const p = res?.parcel;
        if (!p) continue;
        const addr = resolveParcelAddress(p);
        const contact = cleanField(p.receiver_contact || p.contact);
        const contents = cleanField(p.contents);
        const seller = cleanField(p.seller?.name || p.seller || p.seller_name);
        const txn = cleanField(p.transaction_number);

        store.set((list) =>
          list.map((item) => {
            if (item.user_id !== riderId) return item;
            if (item.parcel_id !== d.parcel_id && item.transaction_number !== d.transaction_number) return item;
            return {
              ...item,
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
    const timer = setInterval(() => syncRiderDeliveriesWithServer(id), 6000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [id]);
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
  const resolvedAddress = resolveParcelAddress(parcel);
  const resolvedContact = cleanField(parcel.receiver_contact || parcel.contact);
  const resolvedContents = cleanField(parcel.contents);
  const resolvedSeller = cleanField(parcel.seller?.name || parcel.seller || parcel.seller_name);
  const resolvedTxn = cleanField(parcel.transaction_number) || cleanField(scanned);

  const exists = store.get().some((d) => d.user_id === id && d.parcel_id === parcel.parcel_id);
  if (exists) {
    store.set((l) =>
      l.map((d) =>
        d.user_id === id && d.parcel_id === parcel.parcel_id
          ? {
              ...d,
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
    sync(() => scanForDelivery(parcel.parcel_id || resolvedTxn));
    return "exists";
  }
  const now = Date.now();
  const scheduledFor = toIsoDate(now);
  store.set((l) => [
    {
      user_id: id,
      rider_name: user?.name || "Rider",
      parcel_id: parcel.parcel_id,
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
    await scanForDelivery(parcel.parcel_id || resolvedTxn, { scheduledFor, rescheduled: false, rescheduleCount: 0 });
    await syncRiderDeliveriesWithServer(id);
  });
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
  let nextAttempts = [];
  let scheduledFor = todayIso();
  let rescheduleCount = 0;
  patch(parcelId, (d) => {
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
  sync(() =>
    reportDelivered(parcelId, note, {
      proof,
      attempts: nextAttempts,
      scheduledFor,
      rescheduleCount,
    })
  );
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

    sync(() =>
      reportFailed(parcelId, reason, note, {
        outcome: "rescheduled",
        scheduledFor: nextDate,
        rescheduled: true,
        rescheduleCount: nextCount,
        returnToHub: false,
        attempts: nextAttempts,
      })
    );

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

  sync(() =>
    reportFailed(parcelId, reason, note, {
      outcome: "return_to_hub",
      scheduledFor: baseDate,
      rescheduled: true,
      rescheduleCount: MAX_RESCHEDULES,
      returnToHub: true,
      attempts: nextAttempts,
    })
  );
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
