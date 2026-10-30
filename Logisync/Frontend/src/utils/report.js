// Pang-ayos ng ulat (Rider at Seller): pag-grupo kada linggo / buwan at pag-export ng CSV.

export const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const short = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Lunes ang simula ng linggo
export function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// { key, label } ng linggo/buwan na kinabibilangan ng petsa. `key` ay pang-sort.
export function periodOf(date, by) {
  const d = new Date(date);
  if (by === "month") {
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  const start = weekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { key: isoDay(start), label: `${short(start)} – ${short(end)}, ${end.getFullYear()}` };
}

// rows -> [{ key, label, ...counts }] (pinakabago muna). `classify(row)` ay nagbabalik ng pangalan ng bilang (hal. "delivered").
export function groupByPeriod(rows, getDate, by, classify, fields) {
  const map = new Map();
  rows.forEach((r) => {
    const p = periodOf(getDate(r), by);
    if (!map.has(p.key)) map.set(p.key, { ...p, total: 0, ...Object.fromEntries(fields.map((f) => [f, 0])) });
    const g = map.get(p.key);
    g.total += 1;
    const c = classify(r);
    if (c in g) g[c] += 1;
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function downloadCsv(name, head, lines) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  // BOM para tama ang characters kapag binuksan sa Excel
  const blob = new Blob(["\ufeff" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
