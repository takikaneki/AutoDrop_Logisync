const MANILA_TZ = "Asia/Manila";

export function parseValidTimestamp(value) {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") return null;
  if (typeof value === "number") {
    if (!Number.isNaN(value) && value > 1577836800000) return value; // After Jan 1, 2020
    return null;
  }
  const s = String(value).trim();
  if (/^\d{10,}$/.test(s)) {
    const num = Number(s);
    if (!Number.isNaN(num) && num > 1577836800000) return num;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00+08:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getTime() > 1577836800000) {
    return d.getTime();
  }
  return null;
}

// Pang-format ng petsa at oras sa Asia/Manila timezone
export function formatDate(value) {
  const ts = parseValidTimestamp(value);
  if (!ts) return "—";
  const d = new Date(ts);
  let hour12;
  try {
    const tf = JSON.parse(localStorage.getItem("pt-prefs") || "{}").timeFormat;
    if (tf === "12h") hour12 = true;
    else if (tf === "24h") hour12 = false;
  } catch {
    /* ignore */
  }
  return d.toLocaleString("en-US", {
    timeZone: MANILA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(hour12 !== undefined ? { hour12 } : {}),
  });
}

export function formatSize(bytes) {
  const n = Number(bytes);
  if (!n) return "0 B";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// "2026-10-24" / timestamp -> "Sat, Oct 24"
export function formatDay(value) {
  const ts = parseValidTimestamp(value);
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// YYYY-MM-DD sa Asia/Manila
export function getManilaDateKey(value = Date.now()) {
  const ts = parseValidTimestamp(value) || Date.now();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

// "Today", "Yesterday", o "Sun, Nov 8, 2026"
export function formatDeliveryDayLabel(value) {
  const ts = parseValidTimestamp(value) || Date.now();
  const dateKey = getManilaDateKey(ts);
  const todayKey = getManilaDateKey(Date.now());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getManilaDateKey(yesterday.getTime());

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

// "Nov 9"
export function formatShortDay(value) {
  const ts = parseValidTimestamp(value) || Date.now();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}
