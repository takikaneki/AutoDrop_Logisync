import { createStore } from "./createStore.js";
import { parcels as mockParcels } from "../data/records.js";

// Persistent customer directory + parcel address map in localStorage.
// Preserves backend compatibility while ensuring customer addresses and contact numbers
// are remembered accurately and never unintentionally overwritten.

const normalizeName = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// Seed initial customers from existing system mock records so demo customers also auto-fill
const initialCustomers = (() => {
  const map = new Map();
  mockParcels.forEach((p, idx) => {
    const key = normalizeName(p.recipient);
    if (!key || map.has(key)) return;
    const phoneSuffix = String(1000000 + ((idx * 7919) % 8999999)).slice(0, 7);
    map.set(key, {
      name: p.recipient,
      address: p.address || "",
      contact: `0917${phoneSuffix}`,
      updatedAt: p.ts || Date.now(),
    });
  });
  return [...map.values()];
})();

const customerStore = createStore(initialCustomers, "pt-customers");
const parcelAddressStore = createStore({}, "pt-parcel-addresses");

export const useCustomers = customerStore.use;
export const getCustomers = customerStore.get;
export const useParcelAddresses = parcelAddressStore.use;

/**
 * Look up a customer by exact name (case-insensitive, normalized whitespace).
 */
export function findCustomerByName(name) {
  const key = normalizeName(name);
  if (!key) return null;
  return customerStore.get().find((c) => normalizeName(c.name) === key) || null;
}

/**
 * Return matching customers for autocomplete suggestions.
 */
export function searchCustomers(query, limit = 6) {
  const q = normalizeName(query);
  const all = customerStore.get();
  if (!q) return all.slice(0, limit);
  return all
    .filter(
      (c) =>
        normalizeName(c.name).includes(q) ||
        String(c.contact || "").toLowerCase().includes(q) ||
        String(c.address || "").toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aStarts = normalizeName(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalizeName(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/**
 * Merge customers discovered from backend parcel list without overwriting existing saved details.
 */
export function syncCustomersFromParcels(parcels = []) {
  if (!Array.isArray(parcels) || parcels.length === 0) return;
  const addresses = parcelAddressStore.get();

  customerStore.set((list) => {
    const next = [...list];
    const indexByKey = new Map(next.map((c, i) => [normalizeName(c.name), i]));
    let changed = false;

    // Process from oldest to newest so first-saved details establish the baseline
    const sorted = [...parcels].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    sorted.forEach((p) => {
      const name = String(p.receiver_name || p.recipient || "").trim();
      const key = normalizeName(name);
      if (!key) return;

      const contact = String(p.receiver_contact || "").trim();
      const address = String(
        p.receiver_address ||
          p.address ||
          addresses[p.parcel_id] ||
          addresses[p.transaction_number] ||
          ""
      ).trim();

      if (indexByKey.has(key)) {
        const idx = indexByKey.get(key);
        const cur = next[idx];
        // Only fill in missing fields; never overwrite existing non-empty customer details
        const mergedContact = cur.contact || contact;
        const mergedAddress = cur.address || address;
        if (mergedContact !== cur.contact || mergedAddress !== cur.address) {
          next[idx] = { ...cur, contact: mergedContact, address: mergedAddress };
          changed = true;
        }
      } else if (contact || address) {
        indexByKey.set(key, next.length);
        next.push({
          name,
          contact,
          address,
          updatedAt: new Date(p.created_at || Date.now()).getTime(),
        });
        changed = true;
      }
    });

    return changed ? next : list;
  });
}

/**
 * Save customer info when a parcel is registered.
 * - Always records the parcel's specific address under its parcel_id and transaction_number.
 * - If the customer is new, saves their name, address, and contact number.
 * - If the customer already exists, only fills blank fields unless `updateExisting` is explicitly true,
 *   ensuring existing customer details are never unintentionally overwritten.
 */
export function saveCustomerFromParcel({
  name,
  contact,
  address,
  parcelId,
  transactionNumber,
  updateExisting = false,
}) {
  const cleanName = String(name || "").trim();
  const cleanContact = String(contact || "").trim();
  const cleanAddress = String(address || "").trim();

  if (cleanAddress && (parcelId || transactionNumber)) {
    parcelAddressStore.set((map) => ({
      ...map,
      ...(parcelId ? { [parcelId]: cleanAddress } : {}),
      ...(transactionNumber ? { [transactionNumber]: cleanAddress } : {}),
    }));
  }

  const key = normalizeName(cleanName);
  if (!key) return;

  customerStore.set((list) => {
    const idx = list.findIndex((c) => normalizeName(c.name) === key);
    if (idx === -1) {
      return [
        {
          name: cleanName,
          contact: cleanContact,
          address: cleanAddress,
          updatedAt: Date.now(),
        },
        ...list,
      ];
    }

    const existing = list[idx];
    const nextContact = updateExisting
      ? cleanContact || existing.contact
      : existing.contact || cleanContact;
    const nextAddress = updateExisting
      ? cleanAddress || existing.address
      : existing.address || cleanAddress;

    if (nextContact === existing.contact && nextAddress === existing.address) {
      return list;
    }

    const next = [...list];
    next[idx] = {
      ...existing,
      contact: nextContact,
      address: nextAddress,
      updatedAt: Date.now(),
    };
    return next;
  });
}

/**
 * Get the saved address for a parcel (from parcel object or local parcel address store or customer record).
 */
export function getParcelAddress(parcel) {
  if (!parcel) return "";
  if (parcel.receiver_address) return parcel.receiver_address;
  if (parcel.address) return parcel.address;
  const map = parcelAddressStore.get();
  if (parcel.parcel_id && map[parcel.parcel_id]) return map[parcel.parcel_id];
  if (parcel.id && map[parcel.id]) return map[parcel.id];
  if (parcel.transaction_number && map[parcel.transaction_number]) return map[parcel.transaction_number];
  const cust = findCustomerByName(parcel.receiver_name || parcel.recipient);
  return cust?.address || "";
}

