import { useEffect, useRef, useSyncExternalStore } from "react";
import { getRole, getUser } from "../api.js";

// Global network status & lightweight per-user view cache for offline resilience.
// Prevents endless skeletons when offline and deduplicates automatic data refreshes upon reconnect.

const RESTORE_BANNER_MS = 3200;
const RECONNECT_DEBOUNCE_MS = 350;
const CACHE_PREFIX = "logisync:viewcache:v1:";
const MAX_CACHE_BYTES = 260_000;

const initialOnline = typeof navigator !== "undefined" ? navigator.onLine !== false : true;

let state = {
  online: initialOnline,
  status: initialOnline ? "online" : "offline", // "online" | "offline" | "reconnecting"
  lastOfflineAt: initialOnline ? null : Date.now(),
  lastOnlineAt: initialOnline ? Date.now() : null,
  reconnectCount: 0,
};

const listeners = new Set();
const reconnectHandlers = new Set();
let restoreTimer = null;
let reconnectDebounceTimer = null;
let listenersBound = false;

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

function handleOffline() {
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
  if (reconnectDebounceTimer) {
    clearTimeout(reconnectDebounceTimer);
    reconnectDebounceTimer = null;
  }
  if (!state.online && state.status === "offline") return;
  setState({
    online: false,
    status: "offline",
    lastOfflineAt: Date.now(),
  });
}

function triggerReconnectRefresh() {
  if (reconnectDebounceTimer) clearTimeout(reconnectDebounceTimer);
  reconnectDebounceTimer = setTimeout(() => {
    reconnectDebounceTimer = null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    reconnectHandlers.forEach((handler) => {
      try {
        handler();
      } catch {
        /* isolate handler failures */
      }
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("logisync-network-restored"));
    }
  }, RECONNECT_DEBOUNCE_MS);
}

function handleOnline() {
  const wasOffline = !state.online || state.status === "offline";
  const now = Date.now();
  if (wasOffline) {
    setState({
      online: true,
      status: "reconnecting",
      lastOnlineAt: now,
      reconnectCount: state.reconnectCount + 1,
    });
    triggerReconnectRefresh();
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      restoreTimer = null;
      if (state.online && state.status === "reconnecting") {
        setState({ status: "online" });
      }
    }, RESTORE_BANNER_MS);
  } else if (state.status === "offline") {
    setState({ online: true, status: "online", lastOnlineAt: now });
  }
}

export function initNetworkListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  window.addEventListener("logisync-auth-changed", (e) => {
    if (!e?.detail?.user) {
      clearViewCacheForCurrentUser();
    }
  });
}

if (typeof window !== "undefined") {
  initNetworkListeners();
}

export function getNetworkStatus() {
  return state;
}

export function isOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return state.online;
}

export function subscribeNetworkStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNetworkStatus() {
  return useSyncExternalStore(subscribeNetworkStatus, getNetworkStatus, getNetworkStatus);
}

/**
 * Registers a callback that runs automatically when internet connectivity returns.
 * Built-in in-flight guard prevents duplicate overlapping refreshes during reconnection.
 */
export function useReconnectRefresh(refreshFn, enabled = true) {
  const fnRef = useRef(refreshFn);
  const inFlightRef = useRef(false);
  fnRef.current = refreshFn;

  useEffect(() => {
    if (!enabled) return undefined;
    const wrapped = () => {
      if (inFlightRef.current || typeof fnRef.current !== "function") return;
      inFlightRef.current = true;
      Promise.resolve()
        .then(() => fnRef.current())
        .catch(() => {
          /* handled by caller */
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };
    reconnectHandlers.add(wrapped);
    return () => {
      reconnectHandlers.delete(wrapped);
    };
  }, [enabled]);
}

// ---- Lightweight Per-User Local View Cache (for offline resilience) ----

function scopedCacheKey(key) {
  const user = getUser();
  const uid = user?.user_id ? String(user.user_id) : "anon";
  const role = getRole() || "guest";
  return `${CACHE_PREFIX}${role}:${uid}:${key}`;
}

export function readViewCache(key) {
  if (typeof localStorage === "undefined" || !key) return null;
  try {
    const raw = localStorage.getItem(scopedCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed; // { data, updatedAt }
  } catch {
    return null;
  }
}

export function writeViewCache(key, data) {
  if (typeof localStorage === "undefined" || !key) return false;
  try {
    const payload = JSON.stringify({ data, updatedAt: Date.now() });
    if (payload.length > MAX_CACHE_BYTES) return false;
    localStorage.setItem(scopedCacheKey(key), payload);
    return true;
  } catch {
    return false;
  }
}

export function clearViewCacheForCurrentUser() {
  if (typeof localStorage === "undefined") return;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function isOfflineError(err) {
  if (!isOnline()) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("offline") || msg.includes("failed to fetch") || msg.includes("networkerror");
}

export function formatCachedTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Test helper for automated verification (no-op in normal browser usage)
export function __setNetworkStateForTest(online) {
  if (online) handleOnline();
  else handleOffline();
}
