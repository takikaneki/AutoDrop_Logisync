import { api } from "../api.js";
import { setPrefs } from "../store/prefs.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isDesktopPushSupported() {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getBrowserPermissionState() {
  if (!isDesktopPushSupported()) return "unsupported";
  return Notification.permission || "default";
}

export function resolvePushStatusDisplay({ supported, permission, subscribed }) {
  if (!supported || permission === "unsupported") {
    return { key: "unsupported", label: "Unsupported Browser" };
  }
  if (permission === "denied") {
    return { key: "denied", label: "Permission Denied" };
  }
  if (permission === "granted" && subscribed) {
    return { key: "granted", label: "Permission Granted" };
  }
  return { key: "not_enabled", label: "Not Enabled" };
}

export async function registerPushServiceWorker() {
  if (!isDesktopPushSupported()) return null;
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Inspects current Service Worker + PushManager subscription state without
 * ever prompting the user for notification permission.
 */
export async function inspectPushState() {
  const supported = isDesktopPushSupported();
  if (!supported) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
      endpoint: null,
      status: resolvePushStatusDisplay({ supported: false, permission: "unsupported", subscribed: false }),
    };
  }

  const permission = Notification.permission || "default";
  let subscribed = false;
  let endpoint = null;

  try {
    const existingReg = await navigator.serviceWorker.getRegistration("/");
    if (existingReg && existingReg.pushManager) {
      const sub = await existingReg.pushManager.getSubscription();
      if (sub) {
        subscribed = true;
        endpoint = sub.endpoint;
      }
    }
  } catch {
    /* ignore SW inspection errors */
  }

  return {
    supported: true,
    permission,
    subscribed,
    endpoint,
    status: resolvePushStatusDisplay({ supported: true, permission, subscribed }),
  };
}

/**
 * Explicitly enables desktop Browser Push Notifications for Hub Announcements.
 * Never repeatedly prompts if browser permission was previously denied.
 */
export async function enableDesktopWebPush() {
  if (!isDesktopPushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      status: resolvePushStatusDisplay({ supported: false, permission: "unsupported", subscribed: false }),
    };
  }

  let permission = Notification.permission || "default";
  if (permission === "denied") {
    setPrefs({ browserPushEnabled: false });
    return {
      ok: false,
      reason: "denied",
      status: resolvePushStatusDisplay({ supported: true, permission: "denied", subscribed: false }),
    };
  }

  if (permission === "default") {
    permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPrefs({ browserPushEnabled: false });
      return {
        ok: false,
        reason: permission === "denied" ? "denied" : "dismissed",
        status: resolvePushStatusDisplay({ supported: true, permission, subscribed: false }),
      };
    }
  }

  const vapid = await api("/notifications/push/vapid-public-key");
  if (!vapid?.configured || !vapid?.publicKey) {
    throw new Error("Push notifications are not configured on the server (missing VAPID keys).");
  }

  const reg = await registerPushServiceWorker();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
  }

  const payload = subscription.toJSON();
  await api("/notifications/push/subscribe", {
    method: "POST",
    body: { subscription: payload },
  });

  setPrefs({ browserPushEnabled: true });

  return {
    ok: true,
    endpoint: payload.endpoint,
    status: resolvePushStatusDisplay({ supported: true, permission: "granted", subscribed: true }),
  };
}

/**
 * Disables desktop Browser Push Notifications and deactivates the subscription
 * in PostgreSQL as well as unsubscribing locally in the browser.
 */
export async function disableDesktopWebPush() {
  let endpoint = null;

  if (isDesktopPushSupported()) {
    try {
      const existingReg = await navigator.serviceWorker.getRegistration("/");
      const sub = existingReg ? await existingReg.pushManager.getSubscription() : null;
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe();
      }
    } catch {
      /* proceed to backend cleanup even if browser unsubscribe fails */
    }
  }

  await api("/notifications/push/unsubscribe", {
    method: "POST",
    body: endpoint ? { endpoint } : {},
  });

  setPrefs({ browserPushEnabled: false });

  const next = await inspectPushState();
  return { ok: true, ...next };
}
