import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import Pagination from "../../components/Pagination.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../../components/styles.js";
import { getUser } from "../../api.js";
import { createStore } from "../../store/createStore.js";
import { MAX_RESCHEDULES, STAGE, useAssignedParcels, useMyDeliveries } from "../../store/riderDeliveries.js";
import { toast } from "../../store/toast.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { downloadCsv, groupByPeriod, isoDay, pct } from "../../utils/report.js";

const PAGE_SIZE = 10;
const reportHistoryStore = createStore([], "pt-rider-reports");

const BADGE = {
  waiting: ["Waiting to be scanned", "bg-[#fff4d8] text-[#c98200]"],
  [STAGE.TO_DELIVER]: ["To be delivered", "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"],
  rescheduled: ["Rescheduled", "bg-[#fff4d8] text-[#c98200]"],
  [STAGE.DELIVERED]: ["Delivered", "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"],
  [STAGE.RETURN_TO_HUB]: ["Return to Hub", "bg-[#f2ecff] text-[#7c3aed]"],
  [STAGE.FAILED]: ["Failed", "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"],
};

const TABS = [
  ["all", "All"],
  ["waiting", "Waiting to be scanned"],
  [STAGE.TO_DELIVER, "To Be Delivered"],
  [STAGE.DELIVERED, "Delivered"],
  [STAGE.RETURN_TO_HUB, "Return to Hub"],
];

const ACTION = {
  waiting: (p) => ({ to: `/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`, label: "Scan QR", primary: true }),
  [STAGE.TO_DELIVER]: () => ({ to: "/rider/deliveries", label: "Open" }),
  [STAGE.DELIVERED]: () => ({ to: "/rider/deliveries?tab=delivered", label: "View" }),
  [STAGE.RETURN_TO_HUB]: () => ({ to: "/rider/deliveries?tab=failed", label: "View" }),
  [STAGE.FAILED]: () => ({ to: "/rider/deliveries?tab=failed", label: "View" }),
};

function getBadgeForParcel(p) {
  if (p.returnToHub || p.stage === STAGE.RETURN_TO_HUB) {
    return [`Return to Hub (${MAX_RESCHEDULES}/${MAX_RESCHEDULES}d)`, BADGE[STAGE.RETURN_TO_HUB][1]];
  }
  if (p.stage === STAGE.TO_DELIVER && p.rescheduled) {
    return [`Rescheduled (Day ${p.rescheduleCount || 1}/${MAX_RESCHEDULES}) · ${formatDay(p.scheduledFor)}`, BADGE.rescheduled[1]];
  }
  return BADGE[p.stage] || BADGE[STAGE.TO_DELIVER];
}

const reportDefaults = () => ({ by: "week", result: "All", from: "", to: "" });

const filterReportRows = (rows, q) =>
  rows.filter((d) => {
    const day = d.doneAt ? isoDay(d.doneAt) : "";
    const normalizedStage = d.returnToHub || d.stage === STAGE.RETURN_TO_HUB ? STAGE.FAILED : d.stage;
    return (q.result === "All" || normalizedStage === q.result) && (!q.from || (day && day >= q.from)) && (!q.to || (day && day <= q.to));
  });

const describeReport = (q) =>
  [
    q.by === "week" ? "Grouped per week" : "Grouped per month",
    q.result !== "All" ? `${q.result === STAGE.DELIVERED ? "Delivered" : "Failed / Return to Hub"} only` : "Delivered & Failed / Return to Hub",
    q.from || q.to ? `${q.from || "Start"} to ${q.to || "Today"}` : "All dates",
  ].join(" · ");

export default function RiderParcels() {
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();
  const me = Number(getUser()?.user_id);
  const savedReports = reportHistoryStore.use().filter((r) => r.userId === me);

  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(params.get("report") === "1");
  const [q, setQ] = useState(reportDefaults);
  const [reportResult, setReportResult] = useState(null);

  const filter = TABS.some(([k]) => k === params.get("status")) ? params.get("status") : "all";

  useEffect(() => {
    if (params.get("report") === "1") setReportOpen(true);
  }, [params]);

  const finished = useMemo(
    () =>
      mine.filter(
        (d) => d.doneAt && (d.stage === STAGE.DELIVERED || d.stage === STAGE.FAILED || d.stage === STAGE.RETURN_TO_HUB || d.returnToHub)
      ),
    [mine]
  );

  useEffect(() => {
    if (!reportOpen) return;
    const rows = filterReportRows(finished, q).sort((a, b) => b.doneAt - a.doneAt);
    const id = reportResult?.id || `Rider-Report-${isoDay(new Date())}-${String(savedReports.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: { ...q }, rows });
  }, [reportOpen, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(
    () =>
      [
        ...assigned.map((p) => ({ ...p, stage: "waiting", at: new Date(p.updated_at).getTime() })),
        ...mine.map((d) => ({
          ...d,
          stage: d.returnToHub || d.stage === STAGE.RETURN_TO_HUB ? STAGE.RETURN_TO_HUB : d.stage,
          at: d.doneAt || d.returnToHubAt || d.scannedAt,
        })),
      ].sort((a, b) => (b.at || 0) - (a.at || 0)),
    [assigned, mine]
  );

  const count = (k) => (k === "all" ? all.length : all.filter((p) => p.stage === k).length);
  const list = filter === "all" ? all : all.filter((p) => p.stage === filter);
  const safePage = Math.min(page, Math.max(1, Math.ceil(list.length / PAGE_SIZE)));
  const rows = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pick = (k) => {
    setPage(1);
    const next = new URLSearchParams(params);
    if (k === "all") next.delete("status");
    else next.set("status", k);
    setParams(next, { replace: true });
  };

  const toggleReport = () => {
    setReportOpen((prev) => {
      const next = !prev;
      const nextParams = new URLSearchParams(params);
      if (next) {
        nextParams.set("report", "1");
        const r = filterReportRows(finished, q).sort((a, b) => b.doneAt - a.doneAt);
        const id = `Rider-Report-${isoDay(new Date())}-${String(savedReports.length + 1).padStart(3, "0")}`;
        setReportResult({ id, query: { ...q }, rows: r });
      } else {
        nextParams.delete("report");
      }
      setParams(nextParams, { replace: true });
      return next;
    });
  };

  const setRQ = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.value }));

  const generateReport = () => {
    if (q.from && q.to && q.from > q.to) return toast("The start date must be before the end date.", "error");
    const r = filterReportRows(finished, q).sort((a, b) => b.doneAt - a.doneAt);
    const id = `Rider-Report-${isoDay(new Date())}-${String(savedReports.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: { ...q }, rows: r });
    reportHistoryStore.set((l) => [{ id, userId: me, ts: Date.now(), filters: describeReport(q), rows: r.length, query: { ...q } }, ...l].slice(0, 30));
    toast(`${id} generated (${r.length} parcels).`);
  };

  const resetReport = () => {
    const d = reportDefaults();
    setQ(d);
    const r = filterReportRows(finished, d).sort((a, b) => b.doneAt - a.doneAt);
    const id = `Rider-Report-${isoDay(new Date())}-${String(savedReports.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: d, rows: r });
  };

  const summary = useMemo(() => {
    if (!reportResult) return null;
    const delivered = reportResult.rows.filter((d) => d.stage === STAGE.DELIVERED).length;
    const failed = reportResult.rows.length - delivered;
    return {
      total: reportResult.rows.length,
      delivered,
      failed,
      rate: pct(delivered, reportResult.rows.length),
    };
  }, [reportResult]);

  const periods = useMemo(
    () =>
      reportResult
        ? groupByPeriod(
            reportResult.rows,
            (d) => d.doneAt,
            reportResult.query.by,
            (d) => (d.stage === STAGE.DELIVERED ? STAGE.DELIVERED : STAGE.FAILED),
            [STAGE.DELIVERED, STAGE.FAILED]
          )
        : [],
    [reportResult]
  );

  const exportCsv = (name, rRows, query) => {
    const grouped = groupByPeriod(
      rRows,
      (d) => d.doneAt,
      query.by,
      (d) => (d.stage === STAGE.DELIVERED ? STAGE.DELIVERED : STAGE.FAILED),
      [STAGE.DELIVERED, STAGE.FAILED]
    );
    const head = ["Section", "Period / Transaction no.", "Receiver", "Seller", "Result", "Reason", "Date"];
    const lines = [
      ...grouped.map((g) => ["Summary", g.label, "", "", `${g.delivered} delivered / ${g.failed} failed (${pct(g.delivered, g.total)}% success)`, "", ""]),
      ...rRows.map((d) => [
        "Parcel",
        d.transaction_number,
        d.receiver,
        d.seller,
        d.stage === STAGE.DELIVERED ? "Delivered" : d.returnToHub || d.stage === STAGE.RETURN_TO_HUB ? "Return to Hub" : "Failed",
        d.reason || d.lastFailure || "",
        formatDate(d.doneAt),
      ]),
    ];
    downloadCsv(name, head, lines);
    toast("CSV downloaded.");
  };

  return (
    <>
      <Topbar title="My Parcels" subtitle="Every parcel assigned to you, its delivery status, and your delivery reports.">
        <Link to="/rider/scan" className={btnGhost}>
          <i className="fa-solid fa-qrcode" /> Scan QR Code
        </Link>
        <button
          type="button"
          onClick={toggleReport}
          aria-expanded={reportOpen}
          className={reportOpen ? btnGhost : btnPrimary}
        >
          <i className={`fa-solid ${reportOpen ? "fa-xmark" : "fa-file-lines"}`} />{" "}
          {reportOpen ? "Hide Report" : "Generate Report"}
        </button>
      </Topbar>

      {/* INTEGRATED RIDER REPORT SECTION */}
      {reportOpen && reportResult && summary && (
        <section className={`${panel} mb-6 border-brand/30 p-6 max-[600px]:p-4`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#f1f1f1] pb-4 dark:border-night-line">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-night-head">
                  <i className="fa-solid fa-file-lines" />
                </span>
                <h2 className="text-[18px] font-bold">{reportResult.id}</h2>
              </div>
              <p className="mt-1 text-[13px] text-[#888]">{describeReport(reportResult.query)}</p>
              <p className="hidden text-[13px] text-[#999] print:block">
                Rider: {getUser()?.name} · Generated {new Date().toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button onClick={() => exportCsv(reportResult.id, reportResult.rows, reportResult.query)} className={btnGhost}>
                <i className="fa-solid fa-file-csv text-[#29945a]" /> Export CSV
              </button>
              <button onClick={() => window.print()} className={btnPrimary}>
                <i className="fa-solid fa-file-pdf" /> Save as PDF
              </button>
              <button
                type="button"
                onClick={toggleReport}
                aria-label="Close report"
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#777] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>

          <div className="mb-6 rounded-xl bg-[#fafafa] p-4 print:hidden dark:bg-night-head">
            <h3 className="mb-3 text-[13px] font-bold text-[#555] dark:text-[#d1c9c2]">
              <i className="fa-solid fa-sliders mr-1.5 text-brand" /> Report Filters
            </h3>
            <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[540px]:grid-cols-1">
              <div>
                <label className={labelCls} htmlFor="rr-by">Group by</label>
                <select id="rr-by" value={q.by} onChange={setRQ("by")} className={inputCls}>
                  <option value="week">Per week</option>
                  <option value="month">Per month</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="rr-result">Result</label>
                <select id="rr-result" value={q.result} onChange={setRQ("result")} className={inputCls}>
                  <option value="All">Delivered &amp; Return to Hub</option>
                  <option value={STAGE.DELIVERED}>Delivered only</option>
                  <option value={STAGE.FAILED}>Return to Hub / Failed only</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="rr-from">From</label>
                <input id="rr-from" type="date" value={q.from} onChange={setRQ("from")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="rr-to">To</label>
                <input id="rr-to" type="date" value={q.to} onChange={setRQ("to")} className={inputCls} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={generateReport} className={btnPrimary}>
                <i className="fa-solid fa-rotate" /> Update Report
              </button>
              <button onClick={resetReport} className={btnGhost}>Reset Filters</button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
            {[
              ["Completed parcels", summary.total, "text-[#27364f] dark:text-[#f1eeeb]"],
              ["Delivered", summary.delivered, "text-[#29945a]"],
              ["Return to Hub / Failed", summary.failed, "text-[#7c3aed]"],
              ["Success rate", `${summary.rate}%`, "text-brand"],
            ].map(([l, v, cls]) => (
              <div key={l} className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#888]">{l}</small>
                <strong className={`mt-1 block text-[24px] leading-tight ${cls}`}>{v}</strong>
              </div>
            ))}
          </div>

          {reportResult.rows.length === 0 ? (
            <EmptyState icon="fa-file-circle-xmark" title="No completed deliveries in this period" text="Completed (delivered or Return to Hub) parcels will appear in your delivery report." />
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-[15px] font-bold">{reportResult.query.by === "week" ? "Per week" : "Per month"}</h3>
                <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                  <table className="w-full min-w-[520px] border-collapse">
                    <thead className="bg-[#fafafa] dark:bg-night-head">
                      <tr>{[reportResult.query.by === "week" ? "Week" : "Month", "Delivered", "Return to Hub / Failed", "Total", "Success rate"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {periods.map((g) => (
                        <tr key={g.key} className="text-[#666] dark:text-[#d1c9c2]">
                          <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{g.label}</td>
                          <td className={`${td} font-semibold text-[#29945a]`}>{g.delivered}</td>
                          <td className={`${td} font-semibold text-[#7c3aed]`}>{g.failed}</td>
                          <td className={td}>{g.total}</td>
                          <td className={td}>{pct(g.delivered, g.total)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-[15px] font-bold">Parcels</h3>
                <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-[#fafafa] dark:bg-night-head">
                      <tr>{["Transaction no.", "Receiver", "Seller", "Result", "Reason", "Date"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {reportResult.rows.map((d) => (
                        <tr key={d.parcel_id} className="text-[#666] dark:text-[#d1c9c2]">
                          <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{d.transaction_number}</td>
                          <td className={td}>{d.receiver}</td>
                          <td className={td}>{d.seller}</td>
                          <td className={`${td} font-semibold ${d.stage === STAGE.DELIVERED ? "text-[#29945a]" : "text-[#7c3aed]"}`}>
                            {d.stage === STAGE.DELIVERED ? "Delivered" : d.returnToHub || d.stage === STAGE.RETURN_TO_HUB ? "Return to Hub" : "Failed"}
                          </td>
                          <td className={td}>{d.reason || d.lastFailure || "—"}</td>
                          <td className={`${td} whitespace-nowrap`}>{formatDate(d.doneAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <div
        className={`mb-5 flex flex-wrap gap-2 max-[800px]:grid max-[800px]:grid-cols-1 max-[800px]:gap-2 max-[800px]:rounded-2xl max-[800px]:border max-[800px]:border-[#eee] max-[800px]:bg-white max-[800px]:p-2 dark:max-[800px]:border-night-line dark:max-[800px]:bg-night-panel ${
          reportOpen ? "print:hidden" : ""
        }`}
      >
        {TABS.map(([k, label]) => {
          const active = filter === k;
          const total = count(k);
          return (
            <button
              key={k}
              onClick={() => pick(k)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition max-[800px]:flex max-[800px]:w-full max-[800px]:items-center max-[800px]:justify-between max-[800px]:rounded-xl max-[800px]:px-4 max-[800px]:py-3 max-[800px]:text-[14px] ${
                active
                  ? "bg-brand text-white max-[800px]:font-bold"
                  : "border border-[#eee] bg-white text-[#777] hover:text-brand max-[800px]:border-transparent max-[800px]:bg-[#fafafa] dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2] dark:max-[800px]:bg-night-head"
              }`}
            >
              <span className="max-[800px]:truncate">
                {label}
                <span className="max-[800px]:hidden"> ({total})</span>
              </span>
              <span className="hidden shrink-0 rounded-full bg-black/10 px-2.5 py-0.5 text-[12px] font-bold max-[800px]:inline-block">
                {total}
              </span>
            </button>
          );
        })}
      </div>

      <section className={`${panel} overflow-hidden p-[26px] max-[600px]:p-4 ${reportOpen ? "print:hidden" : ""}`}>
        {list.length === 0 ? (
          <EmptyState
            icon="fa-box-open"
            title="No parcels here"
            text={filter === "all" ? "Parcels the coordinator assigns to you will show up here." : "Nothing matches this filter yet."}
          />
        ) : (
          <>
            {/* Desktop & Tablet Table View */}
            <div className="hidden min-[701px]:block overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-[#fafafa] dark:bg-night-head">
                  <tr>{["Parcel", "Receiver", "Address", "Seller", "Status", "Updated", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const [label, cls] = getBadgeForParcel(p);
                    const a = (ACTION[p.stage] || ACTION[STAGE.TO_DELIVER])(p);
                    return (
                      <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                        <td className={`${td} whitespace-nowrap`}>
                          <strong className="block text-[#333] dark:text-[#f1eeeb]">{p.transaction_number || p.parcel_id}</strong>
                          {p.contents && String(p.contents).trim() !== "-" && String(p.contents).trim() !== "—" && (
                            <span className="text-[12px] text-[#aaa]">{p.contents}</span>
                          )}
                        </td>
                        <td className={td}>{p.receiver || "—"}</td>
                        <td className={`${td} max-w-[240px]`}>{p.address || "—"}</td>
                        <td className={td}>{p.seller || "—"}</td>
                        <td className={td}>
                          <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>{label}</span>
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{p.at ? formatDate(p.at) : "—"}</td>
                        <td className={`${td} whitespace-nowrap text-right`}>
                          {a.primary ? (
                            <Link to={a.to} className={btnPrimary}><i className="fa-solid fa-qrcode" /> {a.label}</Link>
                          ) : (
                            <Link to={a.to} className="font-semibold text-brand hover:underline">{a.label}</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="min-[701px]:hidden space-y-3">
              {rows.map((p) => {
                const [label, cls] = getBadgeForParcel(p);
                const a = (ACTION[p.stage] || ACTION[STAGE.TO_DELIVER])(p);
                const validContents =
                  p.contents && String(p.contents).trim() !== "-" && String(p.contents).trim() !== "—"
                    ? String(p.contents).trim()
                    : "";
                const validContact =
                  (p.contact || p.receiver_contact) &&
                  String(p.contact || p.receiver_contact).trim() !== "-" &&
                  String(p.contact || p.receiver_contact).trim() !== "—"
                    ? String(p.contact || p.receiver_contact).trim()
                    : "";
                const validAddress =
                  (p.address || p.receiver_address) &&
                  String(p.address || p.receiver_address).trim() !== "-" &&
                  String(p.address || p.receiver_address).trim() !== "—"
                    ? String(p.address || p.receiver_address).trim()
                    : "";
                const validSeller =
                  p.seller && String(p.seller).trim() !== "-" && String(p.seller).trim() !== "—"
                    ? String(p.seller).trim()
                    : "";
                return (
                  <article key={p.parcel_id} className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                          {p.transaction_number || p.parcel_id}
                        </strong>
                        {validContents && <span className="block text-[12px] text-[#888]">{validContents}</span>}
                      </div>
                      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
                        {label}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                      {p.receiver && String(p.receiver).trim() !== "-" && String(p.receiver).trim() !== "—" && (
                        <p className="flex items-center gap-2">
                          <i className="fa-regular fa-user w-4 text-center text-[#999]" />
                          <strong className="text-[#333] dark:text-[#f1eeeb]">{p.receiver}</strong>
                        </p>
                      )}
                      {validContact && (
                        <p className="flex items-center gap-2">
                          <i className="fa-solid fa-phone w-4 text-center text-brand" />
                          <a href={`tel:${validContact}`} className="hover:text-brand hover:underline">
                            {validContact}
                          </a>
                        </p>
                      )}
                      {validAddress && (
                        <p className="flex items-start gap-2">
                          <i className="fa-solid fa-location-dot mt-0.5 w-4 text-center text-brand" />
                          <span className="flex-1 break-words text-[12.5px]">{validAddress}</span>
                        </p>
                      )}
                      {validSeller && (
                        <p className="flex items-center gap-2">
                          <i className="fa-solid fa-store w-4 text-center text-[#999]" />
                          <span>{validSeller}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-3.5 flex items-center justify-between border-t border-[#eee] pt-3 text-[12px] dark:border-night-line">
                      <span className="text-[#999]">{p.at ? formatDate(p.at) : ""}</span>
                      {a.primary ? (
                        <Link to={a.to} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-bold text-white">
                          <i className="fa-solid fa-qrcode" /> {a.label}
                        </Link>
                      ) : (
                        <Link to={a.to} className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-1.5 text-[12.5px] font-bold text-brand dark:bg-night-panel">
                          {a.label} <i className="fa-solid fa-chevron-right text-[10px]" />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
