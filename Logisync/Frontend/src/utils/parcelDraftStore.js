import { API_BASE_URL, getRole, getToken, getUser } from "../api.js";
import {
  deleteServerParcelDraft,
  fetchServerParcelDraft,
  saveServerParcelDraft,
} from "../services/parcelService.js";
import { EMPTY_PARCEL } from "./parcelForm.js";

const IDB_NAME = "logisync_parcel_drafts_v1";
const IDB_STORE = "seller_drafts";
const IDB_VERSION = 1;
const LOCAL_META_PREFIX = "logisync:parcel-draft:seller:";

// In-memory fallback map for environments where IndexedDB is unavailable (e.g. Node unit tests or private mode)
const memoryDraftStore = new Map();

export function resolveSellerId(explicitUserId) {
  if (explicitUserId !== undefined && explicitUserId !== null && Number(explicitUserId) > 0) {
    return Number(explicitUserId);
  }
  const u = getUser();
  const role = String(u?.role || getRole() || "").toLowerCase();
  if (role && role !== "seller") return null;
  const uid = Number(u?.user_id);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

export function getSellerDraftKey(userId) {
  const sid = resolveSellerId(userId);
  return sid ? `seller:${sid}` : null;
}

function getLocalMetaKey(userId) {
  const sid = resolveSellerId(userId);
  return sid ? `${LOCAL_META_PREFIX}${sid}` : null;
}

export function sanitizeDraftFormValues(raw = {}) {
  const v = raw && typeof raw === "object" ? raw : {};
  return {
    transaction_number: String(v.transaction_number ?? EMPTY_PARCEL.transaction_number),
    receiver_name: String(v.receiver_name ?? EMPTY_PARCEL.receiver_name),
    receiver_contact: String(v.receiver_contact ?? EMPTY_PARCEL.receiver_contact),
    receiver_house_number: String(v.receiver_house_number ?? EMPTY_PARCEL.receiver_house_number),
    receiver_street: String(v.receiver_street ?? EMPTY_PARCEL.receiver_street),
    receiver_barangay: String(v.receiver_barangay ?? EMPTY_PARCEL.receiver_barangay),
    receiver_city: String(v.receiver_city || EMPTY_PARCEL.receiver_city),
    receiver_province: String(v.receiver_province || EMPTY_PARCEL.receiver_province),
    receiver_address: String(v.receiver_address ?? EMPTY_PARCEL.receiver_address),
    contents: String(v.contents ?? EMPTY_PARCEL.contents),
    quantity: Math.max(1, Math.min(999, parseInt(v.quantity, 10) || 1)),
    content_category: String(v.content_category ?? EMPTY_PARCEL.content_category),
    other_category_description: String(v.other_category_description ?? EMPTY_PARCEL.other_category_description),
    discrete_item: Boolean(v.discrete_item),
    discreet_reason: String(v.discreet_reason ?? EMPTY_PARCEL.discreet_reason),
    is_cod: Boolean(v.is_cod),
    payment_method: v.payment_method === "COD" ? "COD" : "NON_COD",
    scanned: Boolean(v.scanned),
    updateSavedCustomer: Boolean(v.updateSavedCustomer),
  };
}

export function hasMeaningfulDraftContent(values = {}, photoMeta = null) {
  if (photoMeta && photoMeta.hadPhoto) return true;
  if (!values || typeof values !== "object") return false;
  const textKeys = [
    "transaction_number",
    "receiver_name",
    "receiver_contact",
    "receiver_house_number",
    "receiver_street",
    "receiver_barangay",
    "contents",
    "content_category",
    "other_category_description",
    "discreet_reason",
  ];
  for (const k of textKeys) {
    if (String(values[k] || "").trim() !== "") return true;
  }
  if (Boolean(values.discrete_item)) return true;
  if (values.quantity !== undefined && Number(values.quantity) !== 1) return true;
  return false;
}

function openDraftDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key) {
  if (!key) return null;
  const db = await openDraftDb();
  if (!db) {
    return memoryDraftStore.get(key) || null;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || memoryDraftStore.get(key) || null);
      req.onerror = () => resolve(memoryDraftStore.get(key) || null);
    } catch {
      resolve(memoryDraftStore.get(key) || null);
    }
  });
}

async function idbPut(record) {
  if (!record?.key) return false;
  memoryDraftStore.set(record.key, record);
  const db = await openDraftDb();
  if (!db) return true;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        // Retry without raw Blob if browser IndexedDB rejects File/Blob cloning
        if (record.photoBlob) {
          try {
            const fallbackTx = db.transaction(IDB_STORE, "readwrite");
            fallbackTx.objectStore(IDB_STORE).put({ ...record, photoBlob: null });
            fallbackTx.oncomplete = () => resolve(true);
            fallbackTx.onerror = () => resolve(false);
            return;
          } catch {
            /* ignore */
          }
        }
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

async function idbDelete(key) {
  if (!key) return;
  memoryDraftStore.delete(key);
  const db = await openDraftDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function writeLocalMetaBackup(userId, record) {
  const metaKey = getLocalMetaKey(userId);
  if (!metaKey || typeof localStorage === "undefined") return;
  try {
    const serializable = {
      key: record.key,
      sellerId: record.sellerId,
      draftId: record.draftId,
      clientUpdatedAt: record.clientUpdatedAt,
      serverSyncedAt: record.serverSyncedAt || 0,
      dirty: Boolean(record.dirty),
      values: record.values,
      photoMeta: record.photoMeta || null,
      photoDataUrl: record.photoDataUrl || null,
    };
    localStorage.setItem(metaKey, JSON.stringify(serializable));
  } catch {
    // If photoDataUrl exceeds localStorage quota, store without photoDataUrl while keeping photoMeta
    try {
      const compact = {
        key: record.key,
        sellerId: record.sellerId,
        draftId: record.draftId,
        clientUpdatedAt: record.clientUpdatedAt,
        serverSyncedAt: record.serverSyncedAt || 0,
        dirty: Boolean(record.dirty),
        values: record.values,
        photoMeta: record.photoMeta || null,
        photoDataUrl: null,
      };
      localStorage.setItem(metaKey, JSON.stringify(compact));
    } catch {
      /* ignore quota error */
    }
  }
}

function readLocalMetaBackup(userId) {
  const metaKey = getLocalMetaKey(userId);
  if (!metaKey || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(metaKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number(parsed?.sellerId) !== Number(resolveSellerId(userId))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function removeLocalMetaBackup(userId) {
  const metaKey = getLocalMetaKey(userId);
  if (!metaKey || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(metaKey);
  } catch {
    /* ignore */
  }
}

export function dataUrlToFile(dataUrl, photoMeta = null) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  try {
    const [header, base64] = dataUrl.split(",");
    if (!base64) return null;
    const mimeMatch = header.match(/data:([^;]+);/);
    const mime = photoMeta?.type || (mimeMatch ? mimeMatch[1] : "image/jpeg");
    const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const name = photoMeta?.name || "parcel_photo.jpg";
    if (typeof File !== "undefined") {
      return new File([bytes], name, {
        type: mime,
        lastModified: photoMeta?.lastModified || Date.now(),
      });
    }
    if (typeof Blob !== "undefined") {
      const b = new Blob([bytes], { type: mime });
      b.name = name;
      return b;
    }
    return null;
  } catch {
    return null;
  }
}

export function hydrateRestoredPhoto(draftRecord) {
  if (!draftRecord) {
    return { photoFile: null, photoDataUrl: "", photoMeta: null, photoRestoreFailed: false };
  }
  const meta = draftRecord.photoMeta || null;
  const dataUrl = draftRecord.photoDataUrl || "";
  const blob = draftRecord.photoBlob || null;

  if (blob && (typeof Blob !== "undefined" ? blob instanceof Blob : typeof blob === "object")) {
    let fileObj = blob;
    if (typeof File !== "undefined" && !(blob instanceof File)) {
      try {
        fileObj = new File([blob], meta?.name || "parcel_photo.jpg", {
          type: meta?.type || blob.type || "image/jpeg",
          lastModified: meta?.lastModified || Date.now(),
        });
      } catch {
        fileObj = blob;
      }
    }
    return {
      photoFile: fileObj,
      photoDataUrl: dataUrl,
      photoMeta: meta || {
        name: fileObj.name || "parcel_photo.jpg",
        size: fileObj.size || 0,
        type: fileObj.type || "image/jpeg",
        hadPhoto: true,
      },
      photoRestoreFailed: false,
    };
  }

  if (dataUrl && dataUrl.startsWith("data:image/")) {
    const reconstructed = dataUrlToFile(dataUrl, meta);
    return {
      photoFile: reconstructed,
      photoDataUrl: dataUrl,
      photoMeta: meta || {
        name: reconstructed?.name || "parcel_photo.jpg",
        size: reconstructed?.size || 0,
        type: reconstructed?.type || "image/jpeg",
        hadPhoto: true,
      },
      photoRestoreFailed: false,
    };
  }

  if (meta?.hadPhoto) {
    // The seller had selected a photo, but browser storage could not restore the binary file or preview
    return {
      photoFile: null,
      photoDataUrl: "",
      photoMeta: meta,
      photoRestoreFailed: true,
    };
  }

  return { photoFile: null, photoDataUrl: "", photoMeta: null, photoRestoreFailed: false };
}

function isOnlineNow() {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

/**
 * Synchronously saves a lightweight snapshot of the Seller's draft on pagehide / beforeunload / unmount
 * so no keystrokes are ever lost if the browser tab is closed or refreshed mid-edit.
 */
export function saveDraftSnapshotSync({
  userId,
  draftId,
  values,
  photoMeta = null,
  photoDataUrl = "",
  photoFile = null,
  clientUpdatedAt = Date.now(),
}) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return null;

  const cleanValues = sanitizeDraftFormValues(values);
  if (!hasMeaningfulDraftContent(cleanValues, photoMeta)) {
    return null;
  }

  const record = {
    key,
    sellerId,
    draftId: draftId || `draft_${sellerId}_${clientUpdatedAt}`,
    clientUpdatedAt,
    serverSyncedAt: 0,
    dirty: true,
    values: cleanValues,
    photoMeta: photoMeta ? { ...photoMeta, hadPhoto: true } : null,
    photoDataUrl: photoDataUrl || "",
    photoBlob: photoFile || null,
  };

  memoryDraftStore.set(key, record);
  writeLocalMetaBackup(sellerId, record);
  // Also fire async IndexedDB write
  idbPut(record).catch(() => {});

  // Best-effort keepalive PUT to backend when online so browser close/refresh syncs immediately
  if (isOnlineNow() && getToken() && typeof fetch === "function") {
    try {
      const payload = JSON.stringify({
        draftId: record.draftId,
        clientUpdatedAt: record.clientUpdatedAt,
        values: record.values,
        photoMeta: record.photoMeta,
        photoDataUrl:
          record.photoDataUrl && record.photoDataUrl.length <= 45000 ? record.photoDataUrl : null,
      });
      if (payload.length <= 60000) {
        fetch(`${API_BASE_URL}/parcels/draft`, {
          method: "PUT",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: payload,
        }).catch(() => {});
      }
    } catch {
      /* ignore keepalive fallback errors */
    }
  }
  return record;
}

/**
 * Saves the Seller's draft to IndexedDB immediately and (when online) to the backend database.
 * Returns status: "saved" | "offline" | "error" | "empty"
 */
export async function saveParcelDraft({
  userId,
  draftId,
  values,
  photoFile = null,
  photoDataUrl = "",
  photoMeta = null,
  clientUpdatedAt = Date.now(),
  syncServer = true,
  forceOffline = false,
}) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) {
    return { ok: false, status: "error", error: "Seller authentication required." };
  }

  const cleanValues = sanitizeDraftFormValues(values);
  const resolvedPhotoMeta = photoFile
    ? {
        name: photoFile.name || photoMeta?.name || "parcel_photo.jpg",
        size: Number(photoFile.size ?? photoMeta?.size ?? 0),
        type: photoFile.type || photoMeta?.type || "image/jpeg",
        lastModified: Number(photoFile.lastModified || photoMeta?.lastModified || Date.now()),
        hadPhoto: true,
      }
    : photoMeta?.hadPhoto
      ? { ...photoMeta, hadPhoto: true }
      : null;

  if (!hasMeaningfulDraftContent(cleanValues, resolvedPhotoMeta)) {
    return { ok: true, status: "empty", draft: null };
  }

  const existingLocal = await getLocalParcelDraft(sellerId);
  const safeUpdatedAt = Math.max(
    Number(clientUpdatedAt) || Date.now(),
    Number(existingLocal?.clientUpdatedAt || 0) + 1
  );
  const resolvedDraftId =
    draftId || existingLocal?.draftId || `draft_${sellerId}_${safeUpdatedAt}`;

  const localRecord = {
    key,
    sellerId,
    draftId: resolvedDraftId,
    clientUpdatedAt: safeUpdatedAt,
    serverSyncedAt: existingLocal?.serverSyncedAt || 0,
    dirty: true,
    values: cleanValues,
    photoBlob: photoFile || existingLocal?.photoBlob || null,
    photoDataUrl: photoDataUrl || (resolvedPhotoMeta ? existingLocal?.photoDataUrl || "" : ""),
    photoMeta: resolvedPhotoMeta,
  };

  if (!resolvedPhotoMeta) {
    localRecord.photoBlob = null;
    localRecord.photoDataUrl = "";
  }

  const idbOk = await idbPut(localRecord);
  writeLocalMetaBackup(sellerId, localRecord);

  const online = !forceOffline && isOnlineNow();
  if (!online || !syncServer || !getToken()) {
    return {
      ok: idbOk,
      status: idbOk ? "offline" : "error",
      draft: localRecord,
    };
  }

  try {
    const res = await saveServerParcelDraft({
      draftId: localRecord.draftId,
      clientUpdatedAt: localRecord.clientUpdatedAt,
      values: localRecord.values,
      photoMeta: localRecord.photoMeta,
      photoDataUrl: localRecord.photoDataUrl || null,
    });

    if (res?.success) {
      const syncedRecord = {
        ...localRecord,
        dirty: false,
        serverSyncedAt: Date.now(),
      };
      await idbPut(syncedRecord);
      writeLocalMetaBackup(sellerId, syncedRecord);
      return {
        ok: true,
        status: "saved",
        draft: syncedRecord,
        serverResponse: res,
      };
    }
    return {
      ok: true,
      status: "offline",
      draft: localRecord,
    };
  } catch {
    // Network/server error: draft remains safely preserved on this device in IndexedDB
    return {
      ok: idbOk,
      status: idbOk ? "offline" : "error",
      draft: localRecord,
    };
  }
}

export async function getLocalParcelDraft(userId) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return null;

  const [idbRecord, metaRecord] = await Promise.all([
    idbGet(key),
    Promise.resolve(readLocalMetaBackup(sellerId)),
  ]);

  if (idbRecord && Number(idbRecord.sellerId) !== sellerId) return null;
  if (!idbRecord && !metaRecord) return null;

  if (idbRecord && metaRecord) {
    if (Number(metaRecord.clientUpdatedAt || 0) > Number(idbRecord.clientUpdatedAt || 0)) {
      return {
        ...idbRecord,
        ...metaRecord,
        photoBlob: idbRecord.photoBlob || null,
        photoDataUrl: metaRecord.photoDataUrl || idbRecord.photoDataUrl || "",
      };
    }
    return idbRecord;
  }

  return idbRecord || metaRecord;
}

/**
 * Loads the Seller's unfinished draft from IndexedDB and reconciles with the backend server.
 * Never overwrites newer local offline edits with older server data.
 */
export async function loadAndReconcileParcelDraft(userId) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return null;

  const localDraft = await getLocalParcelDraft(sellerId);
  let serverDraft = null;

  if (isOnlineNow() && getToken()) {
    try {
      const res = await fetchServerParcelDraft();
      if (res?.success && res?.draft && Number(res.draft.sellerId) === sellerId) {
        serverDraft = res.draft;
      }
    } catch {
      serverDraft = null;
    }
  }

  const localMeaningful =
    localDraft && hasMeaningfulDraftContent(localDraft.values, localDraft.photoMeta);
  const serverMeaningful =
    serverDraft && hasMeaningfulDraftContent(serverDraft.values, serverDraft.photoMeta);

  if (!localMeaningful && !serverMeaningful) {
    return null;
  }

  let chosen = null;
  let needsServerSync = false;

  if (localMeaningful && serverMeaningful) {
    const localTs = Number(localDraft.clientUpdatedAt || 0);
    const serverTs = Number(serverDraft.clientUpdatedAt || 0);
    if (localTs >= serverTs) {
      chosen = localDraft;
      needsServerSync = Boolean(localDraft.dirty || localTs > serverTs);
    } else {
      // Server draft is newer; preserve local photoBlob only if it matches server photoMeta
      const samePhoto =
        localDraft.photoMeta &&
        serverDraft.photoMeta &&
        localDraft.photoMeta.name === serverDraft.photoMeta.name &&
        localDraft.photoMeta.size === serverDraft.photoMeta.size;
      chosen = {
        key,
        sellerId,
        draftId: serverDraft.draftId || localDraft.draftId,
        clientUpdatedAt: serverTs,
        serverSyncedAt: Date.now(),
        dirty: false,
        values: sanitizeDraftFormValues(serverDraft.values),
        photoMeta: serverDraft.photoMeta || null,
        photoDataUrl: serverDraft.photoDataUrl || (samePhoto ? localDraft.photoDataUrl : "") || "",
        photoBlob: samePhoto ? localDraft.photoBlob : null,
      };
      await idbPut(chosen);
      writeLocalMetaBackup(sellerId, chosen);
    }
  } else if (localMeaningful) {
    chosen = localDraft;
    needsServerSync = Boolean(localDraft.dirty || !serverMeaningful);
  } else if (serverMeaningful) {
    chosen = {
      key,
      sellerId,
      draftId: serverDraft.draftId || `draft_${sellerId}_${Date.now()}`,
      clientUpdatedAt: Number(serverDraft.clientUpdatedAt || Date.now()),
      serverSyncedAt: Date.now(),
      dirty: false,
      values: sanitizeDraftFormValues(serverDraft.values),
      photoMeta: serverDraft.photoMeta || null,
      photoDataUrl: serverDraft.photoDataUrl || "",
      photoBlob: null,
    };
    await idbPut(chosen);
    writeLocalMetaBackup(sellerId, chosen);
  }

  if (needsServerSync && isOnlineNow() && getToken()) {
    syncPendingDraftToServer(sellerId).catch(() => {});
  }

  const photoState = hydrateRestoredPhoto(chosen);
  return {
    ...chosen,
    ...photoState,
  };
}

/**
 * Synchronizes an offline/dirty local draft to the backend server when connection returns.
 */
export async function syncPendingDraftToServer(userId) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key || !isOnlineNow() || !getToken()) {
    return { synced: false };
  }

  const localDraft = await getLocalParcelDraft(sellerId);
  if (!localDraft || !hasMeaningfulDraftContent(localDraft.values, localDraft.photoMeta)) {
    return { synced: false };
  }

  try {
    const res = await saveServerParcelDraft({
      draftId: localDraft.draftId,
      clientUpdatedAt: localDraft.clientUpdatedAt,
      values: localDraft.values,
      photoMeta: localDraft.photoMeta,
      photoDataUrl: localDraft.photoDataUrl || null,
    });

    if (res?.success) {
      if (res.staleIgnored && res.draft && Number(res.draft.clientUpdatedAt) > Number(localDraft.clientUpdatedAt)) {
        // Server had a newer draft; do not overwrite server
        const updatedFromServer = {
          ...localDraft,
          draftId: res.draft.draftId,
          clientUpdatedAt: Number(res.draft.clientUpdatedAt),
          values: sanitizeDraftFormValues(res.draft.values),
          photoMeta: res.draft.photoMeta || null,
          photoDataUrl: res.draft.photoDataUrl || localDraft.photoDataUrl || "",
          dirty: false,
          serverSyncedAt: Date.now(),
        };
        await idbPut(updatedFromServer);
        writeLocalMetaBackup(sellerId, updatedFromServer);
        return { synced: true, draft: updatedFromServer, fromServer: true };
      }

      const synced = {
        ...localDraft,
        dirty: false,
        serverSyncedAt: Date.now(),
      };
      await idbPut(synced);
      writeLocalMetaBackup(sellerId, synced);
      return { synced: true, draft: synced };
    }
  } catch {
    /* keep dirty: true for next online retry */
  }
  return { synced: false };
}

/**
 * Completely clears the Seller's draft from both IndexedDB, local backup, and the backend database.
 * Called ONLY when the Seller explicitly discards the draft or after backend confirms parcel creation.
 */
export async function clearParcelDraft(userId, { clearServer = true } = {}) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return;

  await idbDelete(key);
  removeLocalMetaBackup(sellerId);

  if (clearServer && isOnlineNow() && getToken()) {
    try {
      await deleteServerParcelDraft();
    } catch {
      /* non-fatal if offline */
    }
  }
}

export async function clearLocalDraftOnly(userId) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return;
  await idbDelete(key);
  removeLocalMetaBackup(sellerId);
}

/**
 * Checks synchronously whether the current Seller has an unfinished offline/unsynced draft
 * so LogoutModal can warn the user before logging out.
 */
export function hasUnsyncedOfflineDraft(userId) {
  const sellerId = resolveSellerId(userId);
  const key = getSellerDraftKey(sellerId);
  if (!sellerId || !key) return false;

  const mem = memoryDraftStore.get(key);
  if (mem && mem.dirty && hasMeaningfulDraftContent(mem.values, mem.photoMeta)) {
    return true;
  }
  const meta = readLocalMetaBackup(sellerId);
  if (meta && meta.dirty && hasMeaningfulDraftContent(meta.values, meta.photoMeta)) {
    return true;
  }
  return false;
}

// Automatically sync any dirty offline Seller draft whenever browser connectivity returns,
// even if the Seller navigated away from Create Parcel while offline.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("online", () => {
    const sid = resolveSellerId();
    if (sid && hasUnsyncedOfflineDraft(sid)) {
      syncPendingDraftToServer(sid).catch(() => {});
    }
  });
}
