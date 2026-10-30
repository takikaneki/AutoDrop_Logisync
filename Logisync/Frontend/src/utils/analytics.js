import { bucketOf } from "./stats.js";
import { isoDay, weekStart } from "./report.js";

// Mga bar sa graph: Delivered / Pending / Flagged (pareho ng summary cards sa Dashboard)
export const SERIES = ["Delivered", "Pending", "Flagged"];
const NAME = { DELIVERED: "Delivered", PENDING: "Pending", FLAGGED: "Flagged" };

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const short = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Gumagawa ng listahan ng "buckets" (bawat isa = isang bar) na may start at end (end hindi kasama)
function buildBuckets(period, offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];

  if (period === "day") {
    // Lunes hanggang Linggo ng napiling linggo (offset 0 = linggong ito, -1 = nakaraan)
    const monday = addDays(weekStart(today), offset * 7);
    for (let i = 0; i < 7; i++) {
      const s = addDays(monday, i);
      out.push({ start: s, end: addDays(s, 1), label: s.toLocaleDateString("en-US", { weekday: "short" }), full: s.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }) });
    }
  } else if (period === "week") {
    // Huling 8 linggo (Lunes-Linggo), pinakabago sa kanan
    const thisMonday = weekStart(today);
    for (let i = 7; i >= 0; i--) {
      const s = addDays(thisMonday, -i * 7);
      const last = addDays(s, 6);
      out.push({ start: s, end: addDays(s, 7), label: short(s), full: `${short(s)} – ${short(last)}, ${last.getFullYear()}` });
    }
  } else {
    // Huling 6 na buwan, pinakabago sa kanan
    for (let i = 5; i >= 0; i--) {
      const s = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push({ start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1), label: s.toLocaleDateString("en-US", { month: "short" }), full: s.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
    }
  }
  return out;
}

// parcels = galing sa GET /api/parcels (totoong data). Gamit ang created_at.
// Nagbabalik ng { rows: [{ label, full, Delivered, Pending, Flagged }], range, total }
export function buildParcelSeries(parcels, period, offset = 0) {
  const buckets = buildBuckets(period, offset);
  const rows = buckets.map((b) => ({ label: b.label, full: b.full, Delivered: 0, Pending: 0, Flagged: 0 }));

  parcels.forEach((p) => {
    const t = new Date(p.created_at);
    if (Number.isNaN(t.getTime())) return;
    const i = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (i >= 0) rows[i][NAME[bucketOf(p)]] += 1;
  });

  const first = buckets[0].start;
  const last = addDays(buckets[buckets.length - 1].end, -1);
  const range =
    period === "month"
      ? `${first.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${last.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
      : `${short(first)} – ${short(last)}, ${last.getFullYear()}`;
  const total = rows.reduce((n, r) => n + r.Delivered + r.Pending + r.Flagged, 0);
  return { rows, range, total };
}

// Bilang ng bawat status (para sa pie) — parehong bucket ng graph at ng summary cards
export function statusTotals(parcels) {
  const c = { Delivered: 0, Pending: 0, Flagged: 0 };
  parcels.forEach((p) => { c[NAME[bucketOf(p)]] += 1; });
  return SERIES.map((name) => ({ name, value: c[name] }));
}

export { isoDay };
