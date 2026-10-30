import { useMemo, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../../components/styles.js";
import { getUser } from "../../api.js";
import { createStore } from "../../store/createStore.js";
import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";
import { toast } from "../../store/toast.js";
import { formatDate } from "../../utils/format.js";
import { downloadCsv, groupByPeriod, isoDay, pct } from "../../utils/report.js";

// Ulat ng rider para sa sarili niyang deliveries: ilan ang na-deliver kada linggo / kada buwan.
// Kapareho ng Reports ng Coordinator pero para sa kanya lang. Ang history ay naka-save sa browser.
// TODO: POST /api/rider/reports kapag may backend na.
const history = createStore([], "pt-rider-reports");

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  return isoDay(d);
};
const defaults = () => ({ by: "week", result: "All", from: monthsAgo(2), to: isoDay(new Date()) });

const filterRows = (rows, q) =>
  rows.filter((d) => {
    const day = isoDay(d.doneAt);
    return (q.result === "All" || d.stage === q.result) && (!q.from || day >= q.from) && (!q.to || day <= q.to);
  });

const describe = (q) =>
  `${q.by === "week" ? "Per week" : "Per month"}${q.result !== "All" ? ` · ${q.result === STAGE.DELIVERED ? "Delivered" : "Failed"} only` : ""} · ${q.from || "…"} to ${q.to || "…"}`;

export default function RiderReports() {
  const all = useMyDeliveries();
  const me = Number(getUser()?.user_id);
  const saved = history.use().filter((r) => r.userId === me);
  const [q, setQ] = useState(defaults);
  const [result, setResult] = useState(null); // { id, query, rows }

  // Delivered at Failed lang ang may petsa ng pagtatapos
  const finished = useMemo(() => all.filter((d) => d.doneAt && (d.stage === STAGE.DELIVERED || d.stage === STAGE.FAILED)), [all]);
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value }));

  const generate = () => {
    if (q.from && q.to && q.from > q.to) return toast("The start date must be before the end date.", "error");
    const rows = filterRows(finished, q).sort((a, b) => b.doneAt - a.doneAt);
    const id = `Rider-Report-${isoDay(new Date())}-${String(saved.length + 1).padStart(3, "0")}`;
    setResult({ id, query: { ...q }, rows });
    history.set((l) => [{ id, userId: me, ts: Date.now(), filters: describe(q), rows: rows.length, query: { ...q } }, ...l].slice(0, 30));
    toast(`${id} generated (${rows.length} parcels).`);
  };

  const summary = useMemo(() => {
    if (!result) return null;
    const delivered = result.rows.filter((d) => d.stage === STAGE.DELIVERED).length;
    const failed = result.rows.length - delivered;
    return { total: result.rows.length, delivered, failed, rate: pct(delivered, result.rows.length) };
  }, [result]);

  const periods = useMemo(
    () => (result ? groupByPeriod(result.rows, (d) => d.doneAt, result.query.by, (d) => d.stage, [STAGE.DELIVERED, STAGE.FAILED]) : []),
    [result]
  );

  const exportCsv = (name, rows, query) => {
    const grouped = groupByPeriod(rows, (d) => d.doneAt, query.by, (d) => d.stage, [STAGE.DELIVERED, STAGE.FAILED]);
    const head = ["Section", "Period / Transaction no.", "Receiver", "Seller", "Result", "Reason", "Date"];
    const lines = [
      ...grouped.map((g) => ["Summary", g.label, "", "", `${g.delivered} delivered / ${g.failed} failed (${pct(g.delivered, g.total)}% success)`, "", ""]),
      ...rows.map((d) => ["Parcel", d.transaction_number, d.receiver, d.seller, d.stage === STAGE.DELIVERED ? "Delivered" : "Failed", d.reason || "", formatDate(d.doneAt)]),
    ];
    downloadCsv(name, head, lines);
    toast("CSV downloaded.");
  };

  return (
    <>
      <Topbar title="My Reports" subtitle="Your own delivery report: how many parcels you delivered per week or per month." />

      <section className={`${panel} mb-6 p-6 print:hidden`}>
        <h2 className="mb-4 text-[17px] font-bold"><i className="fa-solid fa-sliders mr-2 text-brand" />Report filters</h2>
        <div className="grid grid-cols-4 gap-4 max-[1000px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div>
            <label className={labelCls} htmlFor="rr-by">Group by</label>
            <select id="rr-by" value={q.by} onChange={set("by")} className={inputCls}>
              <option value="week">Per week</option>
              <option value="month">Per month</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rr-result">Result</label>
            <select id="rr-result" value={q.result} onChange={set("result")} className={inputCls}>
              <option value="All">Delivered and failed</option>
              <option value={STAGE.DELIVERED}>Delivered only</option>
              <option value={STAGE.FAILED}>Failed only</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rr-from">From</label>
            <input id="rr-from" type="date" value={q.from} onChange={set("from")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="rr-to">To</label>
            <input id="rr-to" type="date" value={q.to} onChange={set("to")} className={inputCls} />
          </div>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button onClick={generate} className={btnPrimary}><i className="fa-solid fa-file-lines" /> Generate Report</button>
          <button onClick={() => { setQ(defaults()); setResult(null); }} className={btnGhost}>Reset</button>
        </div>
      </section>

      {result && summary && (
        <section className={`${panel} mb-6 p-6`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold">{result.id}</h2>
              <p className="mt-1 text-[13px] text-[#999]">{describe(result.query)}</p>
              <p className="hidden text-[13px] text-[#999] print:block">Rider: {getUser()?.name} · Generated {new Date().toLocaleString()}</p>
            </div>
            <div className="flex gap-2.5 print:hidden">
              <button onClick={() => exportCsv(result.id, result.rows, result.query)} className={btnGhost}><i className="fa-solid fa-file-csv" /> Export CSV</button>
              <button onClick={() => window.print()} className={btnPrimary}><i className="fa-solid fa-file-pdf" /> Save as PDF</button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
            {[["Total parcels", summary.total], ["Delivered", summary.delivered], ["Failed", summary.failed], ["Delivery success rate", `${summary.rate}%`]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#999]">{l}</small>
                <strong className="mt-1 block text-[24px]">{v}</strong>
              </div>
            ))}
          </div>

          {result.rows.length === 0 ? (
            <EmptyState icon="fa-file-circle-xmark" title="No deliveries in this period" text="Change the dates and generate again." />
          ) : (
            <>
              <h3 className="mb-2 text-[15px] font-bold">{result.query.by === "week" ? "Per week" : "Per month"}</h3>
              <div className="mb-6 w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{[result.query.by === "week" ? "Week" : "Month", "Delivered", "Failed", "Total", "Success rate"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {periods.map((g) => (
                      <tr key={g.key} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{g.label}</td>
                        <td className={`${td} font-semibold text-[#29945a]`}>{g.delivered}</td>
                        <td className={`${td} font-semibold text-[#d94747]`}>{g.failed}</td>
                        <td className={td}>{g.total}</td>
                        <td className={td}>{pct(g.delivered, g.total)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 text-[15px] font-bold">Parcels</h3>
              <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Transaction no.", "Receiver", "Seller", "Result", "Reason", "Date"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {result.rows.map((d) => (
                      <tr key={d.parcel_id} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{d.transaction_number}</td>
                        <td className={td}>{d.receiver}</td>
                        <td className={td}>{d.seller}</td>
                        <td className={`${td} font-semibold ${d.stage === STAGE.DELIVERED ? "text-[#29945a]" : "text-[#d94747]"}`}>{d.stage === STAGE.DELIVERED ? "Delivered" : "Failed"}</td>
                        <td className={td}>{d.reason || "—"}</td>
                        <td className={`${td} whitespace-nowrap`}>{formatDate(d.doneAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <section className={`${panel} p-6 print:hidden`}>
        <h2 className="mb-4 text-[17px] font-bold"><i className="fa-solid fa-clock-rotate-left mr-2 text-brand" />Recent reports</h2>
        {saved.length === 0 ? (
          <EmptyState icon="fa-file" title="No reports yet" />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead><tr>{["Report", "Filters", "Parcels", "Generated", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {saved.map((r) => (
                  <tr key={r.id} className="text-[#666] dark:text-[#d1c9c2]">
                    <td className={td}><strong className="text-[#333] dark:text-[#f1eeeb]">{r.id}</strong></td>
                    <td className={td}>{r.filters}</td>
                    <td className={td}>{r.rows}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(r.ts)}</td>
                    <td className={`${td} text-right`}>
                      <button className="text-[13px] font-semibold text-brand hover:underline" onClick={() => exportCsv(r.id, filterRows(finished, r.query).sort((a, b) => b.doneAt - a.doneAt), r.query)}>
                        <i className="fa-solid fa-download mr-1" />CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
