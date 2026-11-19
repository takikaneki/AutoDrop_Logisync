import assert from "node:assert";

// Minimal browser globals mock so ES modules run in Node cleanly
const storage = new Map();
const rootClasses = new Set();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
globalThis.sessionStorage = { clear: () => {} };
globalThis.document = {
  documentElement: {
    classList: {
      toggle: (cls, on) => (on ? rootClasses.add(cls) : rootClasses.delete(cls)),
    },
    style: {},
  },
  body: { classList: { toggle: () => {} } },
};
const dispatchedEvents = [];
globalThis.window = {
  isSecureContext: true,
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  dispatchEvent: (e) => dispatchedEvents.push(e),
  addEventListener: () => {},
};
Object.defineProperty(globalThis, "navigator", {
  value: { serviceWorker: {} },
  configurable: true,
});

// Mock AudioContext to track actual Web Audio sound triggers!
let audioTriggers = 0;
globalThis.window.AudioContext = class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {
        audioTriggers += 1;
      },
      stop() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
};

const { setPrefs, getPrefs } = await import("./src/store/prefs.js");
const { classifyNotification } = await import("./src/store/notifications.js");
const { notifyPopup, usePopups } = await import("./src/store/toast.js");
const { resolvePushStatusDisplay } = await import("./src/utils/webPush.js");
const { playAlertSound } = await import("./src/utils/sound.js");

// 1. Category classification checks
assert.strictEqual(classifyNotification({ title: "New message from Coordinator", text: "Hi" }), "messages");
assert.strictEqual(classifyNotification({ title: "Reupload requested", text: "SPX123456789" }), "verification");
assert.strictEqual(classifyNotification({ title: "Packing video flagged", text: "Check parcel" }), "verification");
assert.strictEqual(classifyNotification({ title: "Assigned delivery", text: "SPX123456789" }), "parcel");
assert.strictEqual(classifyNotification({ title: "Hub maintenance", text: "Notice" }, true), "announcements");

// 2. Exact sound rules per category
setPrefs({
  notificationsEnabled: true,
  inAppPopups: true,
  sound: true,
  soundVolume: 80,
  notifyParcel: true,
  notifyVerification: true,
  notifyMessages: true,
  notifyAnnouncements: true,
  soundMessages: true,
  soundAnnouncements: true,
}, { skipServerSync: true });

audioTriggers = 0;
notifyPopup({ title: "Parcel assigned", message: "SPX001", category: "parcel" });
assert.strictEqual(audioTriggers, 0, "Parcel & Delivery Updates MUST remain silent");

notifyPopup({ title: "Video rejected", message: "SPX001", category: "verification" });
assert.strictEqual(audioTriggers, 0, "Verification & Video Status MUST remain silent");

notifyPopup({ title: "New reply", message: "Check thread", category: "messages" });
assert.strictEqual(audioTriggers, 1, "Messages & Complaints MUST produce sound when enabled");

notifyPopup({ title: "Announcement", message: "Rain delay", category: "announcements" });
assert.strictEqual(audioTriggers, 2, "Hub Announcements MUST produce sound when enabled");

// 3. Disabling category must silence its sound
setPrefs({ notifyMessages: false }, { skipServerSync: true });
audioTriggers = 0;
notifyPopup({ title: "New message", message: "Ping", category: "messages" });
assert.strictEqual(audioTriggers, 0, "Disabled Messages category must prevent its sound");

// 4. Disabling sound toggle silences announcements cleanly without affecting parcel popup behavior
setPrefs({ notifyMessages: true, soundAnnouncements: false }, { skipServerSync: true });
audioTriggers = 0;
playAlertSound();
assert.strictEqual(audioTriggers, 0, "Disabled Hub Announcements sound toggle must prevent sound");

// 5. Disabling master notifications toggle silences all sounds
setPrefs({ soundAnnouncements: true, notificationsEnabled: false }, { skipServerSync: true });
audioTriggers = 0;
notifyPopup({ title: "Msg", message: "x", category: "messages" });
playAlertSound();
assert.strictEqual(audioTriggers, 0, "Master notifications OFF must disable all sounds");

// 6. Font size uses root fontSize instead of zoom (responsive viewport fit)
setPrefs({ fontSize: "sm", highContrast: true, enhancedFocus: true }, { skipServerSync: true });
assert.strictEqual(globalThis.document.documentElement.style.zoom, "");
assert.strictEqual(globalThis.document.documentElement.style.fontSize, "14px");
assert.strictEqual(rootClasses.has("high-contrast"), true, "high-contrast class should toggle on");
assert.strictEqual(rootClasses.has("enhanced-focus"), true, "enhanced-focus class should toggle on");

// 7. Browser Push permission status mapping
assert.deepStrictEqual(
  resolvePushStatusDisplay({ supported: false, permission: "unsupported", subscribed: false }),
  { key: "unsupported", label: "Unsupported Browser" }
);
assert.deepStrictEqual(
  resolvePushStatusDisplay({ supported: true, permission: "denied", subscribed: false }),
  { key: "denied", label: "Permission Denied" }
);
assert.deepStrictEqual(
  resolvePushStatusDisplay({ supported: true, permission: "default", subscribed: false }),
  { key: "not_enabled", label: "Not Enabled" }
);
assert.deepStrictEqual(
  resolvePushStatusDisplay({ supported: true, permission: "granted", subscribed: true }),
  { key: "granted", label: "Permission Granted" }
);

console.log("PASS: All Frontend notification rules, sound isolation, responsive fontSize, and push state checks passed!");
