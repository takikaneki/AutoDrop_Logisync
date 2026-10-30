import { useMemo, useState } from "react";
import StatusBadge from "../StatusBadge.jsx";
import { EmptyState } from "../ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../styles.js";
import { getUser } from "../../api.js";
import { toast } from "../../store/toast.js";
import { formatDate } from "../../utils/format.js";
import { downloadCsv, groupByPeriod, isoDay } from "../../utils/report.js";
import { statusInfo } from "../../utils/parcelStatus.js";

const STATUSES = ["WAITING_FOR_VIDEO", "VIDEO_SUBMITTED", "VERIFIED", "REJECTED", "REUPLOAD_REQUESTED"];
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  return isoDay(d);
};
const defaults = () => ({ by: "month", status: "ALL", from: monthsAgo(2), to: isoDay(new Date()) });

const describe = (q) =>
  `${q.by === "week" ? "Per week" : "Per month"}${q.status !== "ALL" ? ` · ${statusInfo(q.status).label}` : ""} · ${q.from || "…"} to ${q.to || "…"}`;

// Generate Report ng Seller para sa sarili niyang parcel records (galing sa listahan na galing sa backend).
export default function ParcelReport({ parcels, onClose }) {
  const [q, setQ] = useState(defaults);
  const [result, setResult] = useState(null); // { id, query, rows }
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value }));

  const generate = () => {
    if (q.from && q.to && q.from > q.to) return toast("The start date must be before the end date.", "error");
    const rows = parcels
      .filter((p) => {
        const day = isoDay(p.created_at);
        return (q.status === "ALL" || p.status === q.status) && (!q.from || day >= q.from) && (!q.to || day <= q.to);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const id = `Parcel-Report-${isoDay(new Date())}-${String(Date.now()).slice(-4)}`;
    setResult({ id, query: { ...q }, rows });
    toast(`${id} generated (${rows.length} parcels).`);
  };

  const counts = useMemo(() => {
    if (!result) return null;
    const c = (...s) => result.rows.filter((p) => s.includes(p.status)).length;
    return [
      ["Total parcels", result.rows.length],
      ["Needs video", c("WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED")],
      ["Under verification", c("VIDEO_SUBMITTED")],
      ["Verified", c("VERIFIED")],
      ["Rejected", c("REJECTED")],
    ];
  }, [result]);

  const periods = useMemo(
    () => (result ? groupByPeriod(result.rows, (p) => p.created_at, result.query.by, (p) => p.status, STATUSES) : []),
    [result]
  );

  const exportCsv = () => {
    const head = ["Parcel ID", "Transaction no.", "Receiver", "Contact", "Contents", "Status", "Created"];
    downloadCsv(
      result.id,
      head,
      result.rows.map((p) => [p.parcel_id, p.transaction_number, p.receiver_name, p.receiver_contact, p.contents, statusInfo(p.status).label, formatDate(p.created_at)])
    );
    toast("CSV downloaded.");
  };

  return (
    <>
      <section className={`${panel} mb-6 p-6 print:hidden`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold"><i className="fa-solid fa-file-lines mr-2 text-brand" />Generate Report</h2>
          <button onClick={onClose} aria-label="Close report" className="h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="grid grid-cols-4 gap-4 max-[1000px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div>
            <label className={labelCls} htmlFor="sr-by">Group by</label>
            <select id="sr-by" value={q.by} onChange={set("by")} className={inputCls}>
              <option value="week">Per week</option>
              <option value="month">Per month</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="sr-status">Status</label>
            <select id="sr-status" value={q.status} onChange={set("status")} className={inputCls}>
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{statusInfo(s).label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="sr-from">From</label>
            <input id="sr-from" type="date" value={q.from} onChange={set("from")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sr-to">To</label>
            <input id="sr-to" type="date" value={q.to} onChange={set("to")} className={inputCls} />
          </div>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button onClick={generate} className={btnPrimary}><i className="fa-solid fa-file-lines" /> Generate Report</button>
          <button onClick={() => { setQ(defaults()); setResult(null); }} className={btnGhost}>Reset</button>
        </div>
      </section>

      {result && counts && (
        <section className={`${panel} mb-6 p-6`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold">{result.id}</h2>
              <p className="mt-1 text-[13px] text-[#999]">{describe(result.query)}</p>
              <p className="hidden text-[13px] text-[#999] print:block">Seller: {getUser()?.name} · Generated {new Date().toLocaleString()}</p>
            </div>
            <div className="flex gap-2.5 print:hidden">
              <button onClick={exportCsv} className={btnGhost}><i className="fa-solid fa-file-csv" /> Export CSV</button>
              <button onClick={() => window.print()} className={btnPrimary}><i className="fa-solid fa-file-pdf" /> Save as PDF</button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-5 gap-4 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2">
            {counts.map(([l, v]) => (
              <div key={l} className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#999]">{l}</small>
                <strong className="mt-1 block text-[24px]">{v}</strong>
              </div>
            ))}
          </div>

          {result.rows.length === 0 ? (
            <EmptyState icon="fa-file-circle-xmark" title="No parcels match these filters" text="Change the filters and generate again." />
          ) : (
            <>
              <h3 className="mb-2 text-[15px] font-bold">{result.query.by === "week" ? "Parcels created per week" : "Parcels created per month"}</h3>
              <div className="mb-6 w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head">
                    <tr>{[result.query.by === "week" ? "Week" : "Month", "Total", "Needs video", "Under verification", "Verified", "Rejected"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {periods.map((g) => (
                      <tr key={g.key} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{g.label}</td>
                        <td className={td}>{g.total}</td>
                        <td className={td}>{g.WAITING_FOR_VIDEO + g.REUPLOAD_REQUESTED}</td>
                        <td className={td}>{g.VIDEO_SUBMITTED}</td>
                        <td className={td}>{g.VERIFIED}</td>
                        <td className={td}>{g.REJECTED}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 text-[15px] font-bold">Parcels</h3>
              <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Transaction no.", "Receiver", "Contents", "Status", "Created"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {result.rows.map((p) => (
                      <tr key={p.parcel_id} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{p.transaction_number || p.parcel_id}</td>
                        <td className={td}>{p.receiver_name}</td>
                        <td className={td}>{p.contents || "—"}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                        <td className={`${td} whitespace-nowrap`}>{formatDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
