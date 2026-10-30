import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { EmptyState, StatusBadge } from "../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../components/styles.js";
import { addReport, useParcels, useReportHistory, useRiders } from "../store/records.js";
import { logAction } from "../store/audit.js";
import { getUser } from "../api.js";
import { toast } from "../store/toast.js";

const PAGE_SIZE = 10;
const defaults = { status: "All", seller: "All", rider: "All", from: "2026-09-01", to: "2026-09-27" };

const filterRows = (parcels, q) =>
  parcels.filter(
    (p) =>
      (q.status === "All" || p.status === q.status) &&
      (q.seller === "All" || p.seller === q.seller) &&
      (q.rider === "All" || p.rider === q.rider) &&
      (!q.from || p.iso >= q.from) &&
      (!q.to || p.iso <= q.to)
  );

const describe = (q) =>
  [q.status !== "All" && `Status: ${q.status}`, q.seller !== "All" && `Seller: ${q.seller}`, q.rider !== "All" && `Rider: ${q.rider}`, `${q.from || "…"} to ${q.to || "…"}`]
    .filter(Boolean)
    .join(" · ");

function downloadCsv(name, rows) {
  const head = ["Tracking ID", "Seller", "Shop", "Recipient", "Rider", "Date", "Status", "Verification", "Amount (PHP)"];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [head, ...rows.map((p) => [p.id, p.seller, p.shop, p.recipient, p.rider, p.iso, p.status, p.verification, p.amount])];
  // BOM para tama ang characters kapag binuksan sa Excel
  const blob = new Blob(["﻿" + lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const parcels = useParcels();
  const riders = useRiders();
  const history = useReportHistory();
  const [q, setQ] = useState(defaults);
  const [result, setResult] = useState(null); // { id, query, rows }
  const [page, setPage] = useState(1);

  const sellers = useMemo(() => [...new Set(parcels.map((p) => p.seller))], [parcels]);
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value }));

  const generate = () => {
    if (q.from && q.to && q.from > q.to) return toast("The start date must be before the end date.", "error");
    const rows = filterRows(parcels, q);
    const today = new Date().toISOString().slice(0, 10);
    const id = `Report-${today}-${String(history.length + 1).padStart(3, "0")}`;
    setResult({ id, query: { ...q }, rows });
    setPage(1);
    // TODO: POST /api/reports (para ma-save sa server)
    addReport({ id, ts: Date.now(), name: q.status === "All" ? "Parcel report" : `${q.status} parcels`, filters: describe(q), rows: rows.length, by: getUser()?.name || "Coordinator", query: { ...q } });
    logAction({ category: "Reports", action: "Generated report", target: id, detail: describe(q) });
    toast(`${id} generated (${rows.length} parcels).`);
  };

  const summary = useMemo(() => {
    if (!result) return null;
    const r = result.rows;
    const count = (s) => r.filter((p) => p.status === s).length;
    const delivered = count("Delivered");
    return {
      total: r.length,
      delivered,
      transit: count("In Transit"),
      failed: count("Failed Delivery"),
      rate: delivered + count("Failed Delivery") ? Math.round((delivered / (delivered + count("Failed Delivery"))) * 100) : 0,
      cod: r.filter((p) => p.status === "Delivered").reduce((n, p) => n + p.amount, 0),
    };
  }, [result]);

  const pageRows = result ? result.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  return (
    <>
      <Topbar title="Reports" subtitle="Generate parcel reports and export them as CSV (Excel) or PDF." />

      <section className={`${panel} p-6 mb-6 print:hidden`}>
        <h2 className="text-[17px] font-bold mb-4"><i className="fa-solid fa-sliders mr-2 text-brand" />Report filters</h2>
        <div className="grid grid-cols-5 gap-4 max-[1200px]:grid-cols-3 max-[700px]:grid-cols-1">
          <div>
            <label className={labelCls} htmlFor="r-status">Status</label>
            <select id="r-status" value={q.status} onChange={set("status")} className={inputCls}>
              {["All", "In Transit", "Delivered", "Failed Delivery"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="r-seller">Seller</label>
            <select id="r-seller" value={q.seller} onChange={set("seller")} className={inputCls}>
              <option>All</option>
              {sellers.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="r-rider">Rider</label>
            <select id="r-rider" value={q.rider} onChange={set("rider")} className={inputCls}>
              <option>All</option>
              {riders.map((r) => <option key={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="r-from">From</label>
            <input id="r-from" type="date" value={q.from} onChange={set("from")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="r-to">To</label>
            <input id="r-to" type="date" value={q.to} onChange={set("to")} className={inputCls} />
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button onClick={generate} className={btnPrimary}><i className="fa-solid fa-file-lines" /> Generate Report</button>
          <button onClick={() => { setQ(defaults); setResult(null); }} className={btnGhost}>Reset</button>
        </div>
      </section>

      {result && summary && (
        <section className={`${panel} p-6 mb-6`}>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <h2 className="text-[18px] font-bold">{result.id}</h2>
              <p className="text-[13px] text-[#999] mt-1">{describe(result.query)}</p>
              <p className="hidden print:block text-[13px] text-[#999]">Generated {new Date().toLocaleString()}</p>
            </div>
            <div className="flex gap-2.5 print:hidden">
              <button onClick={() => { downloadCsv(result.id, result.rows); toast("CSV downloaded."); }} className={btnGhost}><i className="fa-solid fa-file-csv" /> Export CSV</button>
              <button onClick={() => window.print()} className={btnPrimary}><i className="fa-solid fa-file-pdf" /> Save as PDF</button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-6 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2">
            {[
              ["Total parcels", summary.total],
              ["Delivered", summary.delivered],
              ["In transit", summary.transit],
              ["Failed", summary.failed],
              ["Delivery success rate", `${summary.rate}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[#fffaf7] border border-[#ffe9dc] p-4 dark:bg-night-head dark:border-night-line">
                <small className="block text-[12px] text-[#999]">{l}</small>
                <strong className="block text-[24px] mt-1">{v}</strong>
              </div>
            ))}
          </div>
          <p className="mb-4 text-[13px] text-[#999]">COD collected from delivered parcels: <strong className="text-ink dark:text-[#f1eeeb]">₱{summary.cod.toLocaleString()}</strong></p>

          {result.rows.length === 0 ? (
            <EmptyState icon="fa-file-circle-xmark" title="No parcels match these filters" text="Change the filters and generate again." />
          ) : (
            <>
              <div className="w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line print:hidden">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head">
                    <tr>{["Tracking ID", "Seller", "Recipient", "Rider", "Date", "Status", "Amount"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {pageRows.map((p) => (
                      <tr key={p.id} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={td}><Link to={`/parcels/${p.id}`} className="font-bold text-brand hover:underline">{p.id}</Link></td>
                        <td className={td}>{p.seller}</td>
                        <td className={td}>{p.recipient}</td>
                        <td className={td}>{p.rider}</td>
                        <td className={`${td} whitespace-nowrap`}>{p.dateLabel}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                        <td className={td}>₱{p.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="print:hidden"><Pagination page={page} pageSize={PAGE_SIZE} total={result.rows.length} onPage={setPage} /></div>
              {/* Kumpletong table para sa Print / Save as PDF */}
              <table className="hidden print:table w-full border-collapse text-[12px]">
                <thead><tr>{["Tracking ID", "Seller", "Recipient", "Rider", "Date", "Status", "Amount"].map((h) => <th key={h} className="px-2 py-1.5 text-left border-b border-[#ccc]">{h}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((p) => (
                    <tr key={p.id}><td className="px-2 py-1 border-b border-[#eee]">{p.id}</td><td className="px-2 py-1 border-b border-[#eee]">{p.seller}</td><td className="px-2 py-1 border-b border-[#eee]">{p.recipient}</td><td className="px-2 py-1 border-b border-[#eee]">{p.rider}</td><td className="px-2 py-1 border-b border-[#eee]">{p.dateLabel}</td><td className="px-2 py-1 border-b border-[#eee]">{p.status}</td><td className="px-2 py-1 border-b border-[#eee]">₱{p.amount.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      <section className={`${panel} p-6 print:hidden`}>
        <h2 className="text-[17px] font-bold mb-4"><i className="fa-solid fa-clock-rotate-left mr-2 text-brand" />Recent reports</h2>
        {history.length === 0 ? (
          <EmptyState icon="fa-file" title="No reports yet" />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr>{["Report", "Filters", "Rows", "Generated", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="text-[#666] dark:text-[#d1c9c2]">
                    <td className={td}><strong className="text-[#333] dark:text-[#f1eeeb]">{r.id}</strong></td>
                    <td className={td}>{r.filters}</td>
                    <td className={td}>{r.rows}</td>
                    <td className={`${td} whitespace-nowrap`}>{new Date(r.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.by}</td>
                    <td className={`${td} text-right`}>
                      <button className="text-brand text-[13px] font-semibold hover:underline" onClick={() => { downloadCsv(r.id, filterRows(parcels, r.query)); toast("CSV downloaded."); }}>
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
