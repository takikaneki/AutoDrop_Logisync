import { createStore } from "./createStore.js";
import { getRole, getUser } from "../api.js";
import { parseAddressString } from "../data/phLocations.js";

// Clean up any legacy mock customer cache from localStorage so mock/sample customers never appear
try {
  localStorage.removeItem("pt-customers");
} catch {
  /* ignore storage errors */
}

const normalizeName = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// Database-driven customer store (starts empty; populated strictly from the logged-in seller's DB records)
const customerStore = createStore([]);
const parcelAddressStore = createStore({}, "pt-parcel-addresses");

let loadedSellerKey = null;

function currentSellerKey() {
  const user = getUser();
  if (!user) return null;
  return String(user.user_id ?? user.id ?? user.email ?? "");
}

function ensureSellerScope() {
  const key = currentSellerKey();
  if (key !== loadedSellerKey) {
    loadedSellerKey = key;
    customerStore.set([]);
  }
}

export const useCustomers = () => {
  ensureSellerScope();
  return customerStore.use();
};

export const getCustomers = () => {
  ensureSellerScope();
  return customerStore.get();
};

export const useParcelAddresses = parcelAddressStore.use;

export function clearCustomersStore() {
  loadedSellerKey = null;
  customerStore.set([]);
}

/**
 * Replace the store with the seller's saved customers retrieved from the backend database.
 * Deduplicates by normalized customer name.
 */
export function setCustomersFromDatabase(customers = []) {
  ensureSellerScope();
  if (!Array.isArray(customers)) {
    customerStore.set([]);
    return;
  }

  const addresses = parcelAddressStore.get();
  const deduped = new Map();

  customers.forEach((c) => {
    const cleanName = String(c.name || c.receiver_name || "").trim().replace(/\s+/g, " ");
    const key = normalizeName(cleanName);
    if (!key) return;

    const contact = String(c.contact || c.receiver_contact || "").trim();
    const address = String(c.address || c.receiver_address || addresses[`cust:${key}`] || "").trim();
    const parsed = parseAddressString(address);
    const house_number = String(c.house_number || c.receiver_house_number || parsed.house_number || "").trim();
    const street = String(c.street || c.receiver_street || parsed.street || "").trim();
    const barangay = String(c.barangay || c.receiver_barangay || parsed.barangay || "").trim();
    const city = String(c.city || c.receiver_city || parsed.city || "").trim();
    const province = String(c.province || c.receiver_province || parsed.province || "").trim();
    const updatedAt = c.updated_at ? new Date(c.updated_at).getTime() : c.updatedAt || Date.now();

    if (!deduped.has(key)) {
      deduped.set(key, {
        name: cleanName,
        contact,
        address,
        house_number,
        street,
        barangay,
        city,
        province,
        updatedAt,
      });
    } else {
      const existing = deduped.get(key);
      deduped.set(key, {
        ...existing,
        contact: existing.contact || contact,
        address: existing.address || address,
        house_number: existing.house_number || house_number,
        street: existing.street || street,
        barangay: existing.barangay || barangay,
        city: existing.city || city,
        province: existing.province || province,
      });
    }
  });

  customerStore.set([...deduped.values()]);
}

/**
 * Look up a saved customer by exact name (case-insensitive, normalized whitespace).
 */
export function findCustomerByName(name) {
  ensureSellerScope();
  const key = normalizeName(name);
  if (!key) return null;
  return customerStore.get().find((c) => normalizeName(c.name) === key) || null;
}

/**
 * Return matching saved customers for autocomplete suggestions.
 */
export function searchCustomers(query, limit = 6) {
  ensureSellerScope();
  const q = normalizeName(query);
  const all = customerStore.get();
  if (!all.length) return [];
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
 * Sync customers discovered from the logged-in seller's actual backend parcel list
 * without overwriting existing saved details.
 */
export function syncCustomersFromParcels(parcels = []) {
  ensureSellerScope();
  if (getRole() !== "seller") return;
  if (!Array.isArray(parcels) || parcels.length === 0) return;

  const user = getUser();
  const sellerId = user?.user_id ?? user?.id;
  const addresses = parcelAddressStore.get();

  customerStore.set((list) => {
    const next = [...list];
    const indexByKey = new Map(next.map((c, i) => [normalizeName(c.name), i]));
    let changed = false;

    // Filter only real parcels belonging to the current seller (exclude demo seed PX123456)
    const sellerParcels = parcels.filter((p) => {
      if (!p || p.parcel_id === "PX123456") return false;
      if (sellerId != null && p.seller_id != null && Number(p.seller_id) !== Number(sellerId)) {
        return false;
      }
      return true;
    });

    // Process from oldest to newest so first-saved details establish the baseline
    const sorted = [...sellerParcels].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    sorted.forEach((p) => {
      const name = String(p.receiver_name || p.recipient || "").trim().replace(/\s+/g, " ");
      const key = normalizeName(name);
      if (!key) return;

      const contact = String(p.receiver_contact || "").trim();
      const address = String(
        p.receiver_address ||
          p.address ||
          addresses[p.parcel_id] ||
          addresses[p.transaction_number] ||
          addresses[`cust:${key}`] ||
          ""
      ).trim();

      if (indexByKey.has(key)) {
        const idx = indexByKey.get(key);
        const cur = next[idx];
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
 * Save customer info when a parcel is registered by the seller.
 */
export function saveCustomerFromParcel({
  name,
  contact,
  address,
  house_number = "",
  street = "",
  barangay = "",
  city = "",
  province = "",
  parcelId,
  transactionNumber,
  updateExisting = false,
}) {
  ensureSellerScope();
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const cleanContact = String(contact || "").trim();
  const cleanAddress = String(address || "").trim();
  const parsed = parseAddressString(cleanAddress);
  const cleanHouse = String(house_number || parsed.house_number || "").trim();
  const cleanStreet = String(street || parsed.street || "").trim();
  const cleanBarangay = String(barangay || parsed.barangay || "").trim();
  const cleanCity = String(city || parsed.city || "").trim();
  const cleanProvince = String(province || parsed.province || "").trim();
  const key = normalizeName(cleanName);

  if (cleanAddress && (parcelId || transactionNumber || key)) {
    parcelAddressStore.set((map) => ({
      ...map,
      ...(parcelId ? { [parcelId]: cleanAddress } : {}),
      ...(transactionNumber ? { [transactionNumber]: cleanAddress } : {}),
      ...(key && (updateExisting || !map[`cust:${key}`]) ? { [`cust:${key}`]: cleanAddress } : {}),
    }));
  }

  if (!key) return;

  customerStore.set((list) => {
    const idx = list.findIndex((c) => normalizeName(c.name) === key);
    if (idx === -1) {
      return [
        {
          name: cleanName,
          contact: cleanContact,
          address: cleanAddress,
          house_number: cleanHouse,
          street: cleanStreet,
          barangay: cleanBarangay,
          city: cleanCity,
          province: cleanProvince,
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
    const nextHouse = updateExisting
      ? cleanHouse || existing.house_number
      : existing.house_number || cleanHouse;
    const nextStreet = updateExisting
      ? cleanStreet || existing.street
      : existing.street || cleanStreet;
    const nextBarangay = updateExisting
      ? cleanBarangay || existing.barangay
      : existing.barangay || cleanBarangay;
    const nextCity = updateExisting
      ? cleanCity || existing.city
      : existing.city || cleanCity;
    const nextProvince = updateExisting
      ? cleanProvince || existing.province
      : existing.province || cleanProvince;

    const next = [...list];
    next[idx] = {
      ...existing,
      contact: nextContact,
      address: nextAddress,
      house_number: nextHouse,
      street: nextStreet,
      barangay: nextBarangay,
      city: nextCity,
      province: nextProvince,
      updatedAt: Date.now(),
    };
    return next;
  });
}

/**
 * Get the saved address for a parcel (from database parcel object or fallback address store).
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
