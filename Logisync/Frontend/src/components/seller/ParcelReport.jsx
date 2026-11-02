import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../StatusBadge.jsx";
import { EmptyState } from "../ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../styles.js";
import { getUser } from "../../api.js";
import { toast } from "../../store/toast.js";
import { formatDate } from "../../utils/format.js";
import { downloadCsv, groupByPeriod, isoDay } from "../../utils/report.js";
import { statusInfo } from "../../utils/parcelStatus.js";
import { getParcelAddress } from "../../store/customers.js";

const STATUSES = ["WAITING_FOR_VIDEO", "VIDEO_SUBMITTED", "VERIFIED", "REJECTED", "REUPLOAD_REQUESTED"];
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  return isoDay(d);
};
const defaults = () => ({ by: "month", status: "ALL", from: "", to: "" });

const describe = (q) =>
  [
    q.by === "week" ? "Grouped per week" : "Grouped per month",
    q.status !== "ALL" ? statusInfo(q.status).label : "All statuses",
    q.from || q.to ? `${q.from || "Start"} to ${q.to || "Today"}` : "All dates",
  ].join(" · ");

function buildReport(parcels, query) {
  const rows = parcels
    .filter((p) => {
      const day = p.created_at ? isoDay(p.created_at) : "";
      return (
        (query.status === "ALL" || p.status === query.status) &&
        (!query.from || (day && day >= query.from)) &&
        (!query.to || (day && day <= query.to))
      );
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const id = `Parcel-Report-${isoDay(new Date())}-${String(rows.length).padStart(3, "0")}`;
  return { id, query: { ...query }, rows };
}

// Integrated Report section inside Seller's Parcel Records page.
// Automatically displays report details as soon as opened, and updates when filters are applied.
export default function ParcelReport({ parcels, onClose }) {
  const [q, setQ] = useState(defaults);
  const [result, setResult] = useState(() => buildReport(parcels, defaults()));
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value }));

  // Keep initial report synced when parcels finish loading from the API
  useEffect(() => {
    setResult((prev) => buildReport(parcels, prev ? prev.query : q));
  }, [parcels]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = () => {
    if (q.from && q.to && q.from > q.to) return toast("The start date must be before the end date.", "error");
    const next = buildReport(parcels, q);
    setResult(next);
    toast(`${next.id} generated (${next.rows.length} parcels).`);
  };

  const resetFilters = () => {
    const d = defaults();
    setQ(d);
    setResult(buildReport(parcels, d));
  };

  const applyQuickRange = (months) => {
    const nextQ = { ...q, from: monthsAgo(months), to: isoDay(new Date()) };
    setQ(nextQ);
    setResult(buildReport(parcels, nextQ));
  };

  const counts = useMemo(() => {
    if (!result) return null;
    const c = (...s) => result.rows.filter((p) => s.includes(p.status)).length;
    return [
      ["Total parcels", result.rows.length, "text-[#27364f] dark:text-[#f1eeeb]"],
      ["Needs video", c("WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"), "text-[#e99a00]"],
      ["Under verification", c("VIDEO_SUBMITTED"), "text-[#4285c5]"],
      ["Verified", c("VERIFIED"), "text-[#29945a]"],
      ["Rejected", c("REJECTED"), "text-[#d94747]"],
    ];
  }, [result]);

  const periods = useMemo(
    () => (result ? groupByPeriod(result.rows, (p) => p.created_at, result.query.by, (p) => p.status, STATUSES) : []),
    [result]
  );

  const exportCsv = () => {
    const head = ["Parcel ID", "Transaction no.", "Receiver", "Address", "Contact", "Contents", "Status", "Created"];
    downloadCsv(
      result.id,
      head,
      result.rows.map((p) => [
        p.parcel_id,
        p.transaction_number,
        p.receiver_name,
        getParcelAddress(p),
        p.receiver_contact,
        p.contents,
        statusInfo(p.status).label,
        formatDate(p.created_at),
      ])
    );
    toast("CSV downloaded.");
  };

  return (
    <section className={`${panel} mb-6 overflow-hidden border-brand/30 p-6 max-[600px]:p-4`}>
      {/* Report Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f1f1] pb-4 dark:border-night-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-night-head">
              <i className="fa-solid fa-file-lines" />
            </span>
            <h2 className="text-[18px] font-bold">{result?.id || "Parcel Report"}</h2>
          </div>
          <p className="mt-1 text-[13px] text-[#888]">{result ? describe(result.query) : ""}</p>
          <p className="hidden text-[13px] text-[#999] print:block">
            Seller: {getUser()?.name} · Generated {new Date().toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button onClick={exportCsv} className={btnGhost}>
            <i className="fa-solid fa-file-csv text-[#29945a]" /> Export CSV
          </button>
          <button onClick={() => window.print()} className={btnPrimary}>
            <i className="fa-solid fa-file-pdf" /> Save as PDF
          </button>
          <button
            onClick={onClose}
            aria-label="Close report"
            title="Close report"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#777] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      {/* Report Filters */}
      <div className="mb-6 rounded-xl bg-[#fafafa] p-4 print:hidden dark:bg-night-head">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-[#555] dark:text-[#d1c9c2]">
            <i className="fa-solid fa-sliders mr-1.5 text-brand" /> Report Filters
          </span>
          <div className="flex flex-wrap gap-1.5 text-[12px]">
            <button type="button" onClick={() => applyQuickRange(1)} className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1 font-semibold text-[#666] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]">
              Last 30 days
            </button>
            <button type="button" onClick={() => applyQuickRange(3)} className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1 font-semibold text-[#666] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]">
              Last 3 months
            </button>
            <button type="button" onClick={resetFilters} className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1 font-semibold text-[#666] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]">
              All time
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[540px]:grid-cols-1">
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
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button onClick={generate} className={btnPrimary}>
            <i className="fa-solid fa-rotate" /> Update Report
          </button>
          <button onClick={resetFilters} className={btnGhost}>Reset Filters</button>
        </div>
      </div>

      {/* Report Summary Metrics */}
      {result && counts && (
        <>
          <div className="mb-6 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-2">
            {counts.map(([l, v, colorCls]) => (
              <div key={l} className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] font-medium text-[#888]">{l}</small>
                <strong className={`mt-1 block text-[24px] leading-tight ${colorCls}`}>{v}</strong>
              </div>
            ))}
          </div>

          {result.rows.length === 0 ? (
            <EmptyState icon="fa-file-circle-xmark" title="No parcels match these report filters" text="Adjust the status or date range above and update the report." />
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2.5 text-[15px] font-bold">
                  <i className="fa-regular fa-calendar mr-1.5 text-brand" />
                  {result.query.by === "week" ? "Summary by Week" : "Summary by Month"}
                </h3>
                <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                  <table className="w-full min-w-[600px] border-collapse">
                    <thead className="bg-[#fafafa] dark:bg-night-head">
                      <tr>{[result.query.by === "week" ? "Week" : "Month", "Total", "Needs video", "Under verification", "Verified", "Rejected"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {periods.map((g) => (
                        <tr key={g.key} className="text-[#666] dark:text-[#d1c9c2]">
                          <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{g.label}</td>
                          <td className={`${td} font-semibold`}>{g.total}</td>
                          <td className={td}>{g.WAITING_FOR_VIDEO + g.REUPLOAD_REQUESTED}</td>
                          <td className={td}>{g.VIDEO_SUBMITTED}</td>
                          <td className={`${td} font-semibold text-[#29945a]`}>{g.VERIFIED}</td>
                          <td className={`${td} font-semibold text-[#d94747]`}>{g.REJECTED}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2.5 text-[15px] font-bold">
                  <i className="fa-solid fa-list-check mr-1.5 text-brand" />
                  Included Parcels ({result.rows.length})
                </h3>
                <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-[#fafafa] dark:bg-night-head">
                      <tr>{["Transaction no.", "Customer / Receiver", "Address", "Contents", "Status", "Created"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((p) => (
                        <tr key={p.parcel_id} className="text-[#666] dark:text-[#d1c9c2]">
                          <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{p.transaction_number || p.parcel_id}</td>
                          <td className={td}>
                            <strong className="block text-[#333] dark:text-[#f1eeeb]">{p.receiver_name}</strong>
                            <span className="text-[12px] text-[#999]">{p.receiver_contact || "—"}</span>
                          </td>
                          <td className={`${td} max-w-[220px]`}>{getParcelAddress(p) || "—"}</td>
                          <td className={td}>{p.contents || "—"}</td>
                          <td className={td}><StatusBadge status={p.status} /></td>
                          <td className={`${td} whitespace-nowrap`}>{formatDate(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
