import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EmptyState, CodBadge } from "../../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../../components/portal.jsx";
import ParcelReport from "../../components/seller/ParcelReport.jsx";
import { btnGhost, btnPrimary, inputCls, tableCard, tableHead, tableRow, tableScroll, td, th } from "../../components/styles.js";
import { listParcels } from "../../services/parcelService.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { statusInfo } from "../../utils/parcelStatus.js";
import { bucketOf } from "../../utils/stats.js";
import { getParcelAddress } from "../../store/customers.js";

const PAGE_SIZE = 10;
const PENDING = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

function shortParcelId(id) {
  const str = String(id || "").trim();
  if (!str) return "—";
  if (str.length <= 10) return str;
  return `${str.slice(0, 2)}-${str.slice(-6)}`;
}

const FILTERS = [
  { key: "NEEDS_VIDEO", label: "Needs Video", icon: "fa-video", tone: "blue", match: (p) => PENDING.includes(p.status) },
  { key: "UNDER_VERIFICATION", label: "Under Verification", icon: "fa-hourglass-half", tone: "yellow", match: (p) => p.status === "VIDEO_SUBMITTED" },
  { key: "VERIFIED", label: "Verified / In Delivery", icon: "fa-circle-check", tone: "green", match: (p) => ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED"].includes(p.status) && !p.returnToHub && !p.rth_status },
  { key: "RETURN_TO_HUB", label: "Return to Hub / Failed", icon: "fa-warehouse", tone: "red", match: (p) => ["RETURN_TO_HUB", "REJECTED", "DELIVERY_FAILED", "RTH_PENDING", "RTH_CONFIRMED"].includes(p.status) || Boolean(p.returnToHub || p.rth_status) },
];
const BUCKETS = { FLAGGED: "Flagged", PENDING: "Pending", DELIVERED: "Delivered" };

export default function ParcelRecords() {
  const [params, setParams] = useSearchParams();
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(params.get("report") === "1");
  const status = params.get("status") || "ALL";
  const isBucket = status in BUCKETS;

  useEffect(() => {
    if (params.get("report") === "1") setReportOpen(true);
  }, [params]);

  const load = () => {
    setLoading(true);
    setError("");
    listParcels()
      .then(setParcels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filter = FILTERS.find((f) => f.key === status);
    const list = parcels.filter((p) => {
      if (isBucket) {
        if (bucketOf(p) !== status) return false;
      } else if (filter && !filter.match(p)) return false;
      if (!q) return true;
      return [
        p.parcel_id,
        p.transaction_number,
        p.receiver_name,
        p.receiver_contact,
        getParcelAddress(p),
        p.contents,
        p.content_category,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
    return [...list].sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "status") return statusInfo(a.status).label.localeCompare(statusInfo(b.status).label);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [parcels, search, status, sort, isBucket]);

  useEffect(() => setPage(1), [search, status, sort]);
  const visible = rows;

  const setStatus = (v) => {
    if (v === "ALL") params.delete("status");
    else params.set("status", v);
    setParams(params, { replace: true });
  };

  const toggleReport = () => {
    setReportOpen((v) => {
      const next = !v;
      if (next) params.set("report", "1");
      else params.delete("report");
      setParams(params, { replace: true });
      return next;
    });
  };

  const countOf = (f) => parcels.filter(f.match).length;
  const toggle = (key) => setStatus(status === key ? "ALL" : key);

  return (
    <>
      <Topbar title="Parcel Records" subtitle="All the parcels you registered, with their verification & delivery status and report generation.">
        <Link to="/seller/create" className={btnGhost}>
          <i className="fa-solid fa-plus" /> Create Parcel
        </Link>
        <button
          onClick={toggleReport}
          aria-expanded={reportOpen}
          className={reportOpen ? btnGhost : btnPrimary}
        >
          <i className={`fa-solid ${reportOpen ? "fa-xmark" : "fa-file-lines"}`} />{" "}
          {reportOpen ? "Hide Report" : "Generate Report"}
        </button>
      </Topbar>

      {reportOpen && (
        <ParcelReport
          parcels={parcels}
          onClose={() => {
            setReportOpen(false);
            params.delete("report");
            setParams(params, { replace: true });
          }}
        />
      )}

      {error && (
        <div className="mb-4">
          <Notice tone="error" icon="fa-circle-exclamation" role="alert">
            {error} <button onClick={load} className="font-bold underline">Try again</button>
          </Notice>
        </div>
      )}

      {/* MOBILE 4-TAB HORIZONTAL FILTER BAR (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Filter parcels by status"
        className={`sticky top-14 z-30 -mx-3.5 -mt-3.5 mb-3 max-[380px]:-mx-2.5 grid grid-cols-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95 ${reportOpen ? "print:hidden" : ""}`}
      >
        {[
          {
            key: "NEEDS_VIDEO",
            label: "Needs Video",
            activeText: "text-[#3b82f6] dark:text-[#60a5fa]",
            activeBar: "bg-[#3b82f6]",
            activeBadge: "bg-[#dbeafe] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-[#60a5fa]",
            filter: FILTERS[0],
          },
          {
            key: "UNDER_VERIFICATION",
            label: "Under Verif.",
            activeText: "text-[#ca8a04] dark:text-[#facc15]",
            activeBar: "bg-[#facc15]",
            activeBadge: "bg-[#fef9c3] text-[#a16207] dark:bg-yellow-500/20 dark:text-[#facc15]",
            filter: FILTERS[1],
          },
          {
            key: "VERIFIED",
            label: "Verified",
            activeText: "text-[#16a34a] dark:text-[#4ade80]",
            activeBar: "bg-[#16a34a]",
            activeBadge: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
            filter: FILTERS[2],
          },
          {
            key: "RETURN_TO_HUB",
            label: "Return/Failed",
            activeText: "text-[#dc2626] dark:text-[#f87171]",
            activeBar: "bg-[#dc2626]",
            activeBadge: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
            filter: FILTERS[3],
          },
        ].map((tab) => {
          const active = status === tab.key;
          const cnt = countOf(tab.filter);
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => toggle(tab.key)}
              className={`relative flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-center leading-tight transition ${
                active
                  ? `font-extrabold ${tab.activeText}`
                  : "font-semibold text-slate-500 hover:text-[#0f172a] dark:text-[#b8b0a8] dark:hover:text-white"
              }`}
            >
              <span className="max-w-full truncate text-[10.5px] max-[360px]:text-[9.5px]">{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active
                    ? tab.activeBadge
                    : "bg-slate-100 text-slate-500 dark:bg-night-head dark:text-[#b8b0a8]"
                }`}
              >
                {loading ? "…" : cnt}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-[2.5px] rounded-full ${tab.activeBar}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* MOBILE ACTION BAR (below filter tabs, above records container) */}
      <div className="mb-3 flex items-center justify-between gap-2 min-[821px]:hidden print:hidden">
        {status !== "ALL" ? (
          <button
            type="button"
            onClick={() => setStatus("ALL")}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 transition active:scale-95 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
          >
            <i className="fa-solid fa-xmark text-[10px]" />
            <span>Show All ({parcels.length})</span>
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={toggleReport}
          aria-expanded={reportOpen}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition active:scale-95 ${
            reportOpen
              ? "border border-slate-200 bg-white text-slate-600 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
              : "bg-brand text-white shadow-xs hover:bg-brand-dark"
          }`}
        >
          <i className={`fa-solid ${reportOpen ? "fa-xmark" : "fa-file-lines"} text-[12px]`} />
          <span>{reportOpen ? "Hide Report" : "Generate Report"}</span>
        </button>
      </div>

      {/* DESKTOP 4-CARD SUMMARY GRID (min-[821px] — 100% unchanged) */}
      <div className={`hidden min-[821px]:block ${reportOpen ? "print:hidden" : ""}`}>
        <StatGrid>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => toggle(f.key)} aria-pressed={status === f.key} className="block h-full text-left rounded-2xl focus:outline-none [&>div]:h-full">
              <StatCard label={f.label} value={loading ? "…" : countOf(f)} icon={f.icon} tone={f.tone} interactive active={status === f.key} />
            </button>
          ))}
        </StatGrid>
      </div>

      <section className={`${tableCard} p-[26px] max-[600px]:p-4 ${reportOpen ? "print:hidden" : ""}`}>
        <div className="mb-[18px] grid grid-cols-[1fr_190px_170px] gap-3 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div className="relative max-[900px]:col-span-2 max-[600px]:col-span-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, transaction no., customer, address, contact, category or contents..." aria-label="Search" className={`${inputCls} pl-9`} />
          </div>
          <select value={isBucket ? "ALL" : status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" className={inputCls}>
            <option value="ALL">Filter by status</option>
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={inputCls}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="status">By status</option>
          </select>
        </div>

        {isBucket && (
          <p className="mb-3 text-[13px] text-[#777] dark:text-[#d1c9c2]">
            Showing: <span className="rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand dark:bg-night-head">{BUCKETS[status]}</span>{" "}
            <button onClick={() => setStatus("ALL")} className="ml-1 font-semibold text-brand hover:underline">Clear</button>
          </p>
        )}

        {/* Desktop & Tablet Table View + Create Parcel Quick Card */}
        <div className="hidden min-[701px]:grid grid-cols-[1fr_220px] items-stretch gap-4 max-[1080px]:grid-cols-1">
          <div className={tableScroll}>
            <table className="w-full min-w-[860px] border-collapse">
              <thead className={tableHead}>
                <tr>
                  {["Parcel ID", "Transaction no.", "Customer / Receiver", "Address", "Category & Contents", "Status", "Created", ""].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const needsVideo = PENDING.includes(p.status);
                  const addr = getParcelAddress(p);
                  return (
                    <tr key={p.parcel_id} className={tableRow}>
                    <td className={`${td} whitespace-nowrap font-mono text-[12px]`} title={p.parcel_id}>{shortParcelId(p.parcel_id)}</td>
                    <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span>{p.transaction_number || "—"}</span>
                        {(p.is_cod || p.payment_method === "COD") && <CodBadge />}
                      </span>
                    </td>
                    <td className={td}>
                      <strong className="block text-[14px] text-[#333] dark:text-[#f1eeeb]">{p.receiver_name}</strong>
                      <span className="block text-[12px] text-[#aaa]">{p.receiver_contact || "—"}</span>
                    </td>
                    <td className={`${td} max-w-[220px]`}>
                      <span className="line-clamp-2 text-[12.5px]">{addr || "—"}</span>
                    </td>
                    <td className={td}>
                      {p.content_category && (
                        <span className="block text-[12px] font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                          {p.content_category}
                        </span>
                      )}
                      <span className="block text-[12.5px]">{p.contents || "—"}</span>
                      {p.discrete_item && (
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            p.discreet_status === "APPROVED"
                              ? "bg-[#eaf8ef] text-[#1f7f4a]"
                              : p.discreet_status === "REJECTED"
                              ? "bg-[#fdecec] text-[#c53030]"
                              : "bg-[#fff4e5] text-[#b45309]"
                          }`}
                        >
                          <i className="fa-solid fa-user-shield text-[9px]" />
                          Discreet:{" "}
                          {p.discreet_status === "APPROVED"
                            ? "Approved"
                            : p.discreet_status === "REJECTED"
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <StatusBadge status={p.status} />
                      {p.rescheduled && !p.returnToHub && p.status !== "DELIVERED" && p.scheduledFor && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#c98200]">
                          Day {p.rescheduleCount || 1}/3 · {formatDay(p.scheduledFor)}
                        </span>
                      )}
                      {p.returnToHub && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#7c3aed]">
                          {p.returnCoordinated ? "Return Coordinated" : "3-Day Limit Reached"}
                        </span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(p.created_at)}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <Link to={`/seller/parcels/${encodeURIComponent(p.transaction_number || p.parcel_id)}`} className="font-semibold text-brand hover:underline">
                        {needsVideo ? "Upload video" : "View details"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <p className="py-10 text-center text-[14px] text-[#999]">Loading…</p>}
            {!loading && visible.length === 0 && (
              <EmptyState
                title={parcels.length ? "No parcels match your filters" : "You have no parcels yet"}
                text={parcels.length ? "Try a different search or status." : "Create your first parcel to see it here."}
              />
            )}
          </div>

          <Link
            to="/seller/create"
            className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#fdba74] bg-[#fffaf5] p-5 text-center transition hover:border-[#ee4d2d] hover:bg-[#fff3e8] dark:border-[#9a3412]/70 dark:bg-night-head/60 dark:hover:border-[#ee4d2d] max-[1080px]:hidden"
          >
            <svg viewBox="0 0 120 96" className="mb-3 h-24 w-28" fill="none" aria-hidden="true">
              <ellipse cx="60" cy="84" rx="40" ry="7" fill="#ffedd5" />
              <rect x="34" y="34" width="46" height="40" rx="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
              <path d="M34 45h46M57 34v40" stroke="#94a3b8" strokeWidth="2" />
              <rect x="20" y="22" width="26" height="19" rx="5" fill="#ee4d2d" />
              <circle cx="33" cy="31.5" r="4.5" fill="#ffffff" />
              <path d="M88 22c-6.6 0-12 5.4-12 12 0 8.5 12 20 12 20s12-11.5 12-20c0-6.6-5.4-12-12-12z" fill="#f97316" />
              <circle cx="88" cy="34" r="4.5" fill="#ffffff" />
            </svg>
            <p className="mb-4 text-[12.5px] leading-relaxed text-[#64748b] dark:text-[#d1c9c2]">
              Ready to ship a new order? Register your parcel to get started.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ee4d2d] px-4 py-2 text-[13px] font-bold text-white shadow-xs transition group-hover:bg-[#d94122]">
              <i className="fa-solid fa-plus text-[11px]" /> Create Parcel
            </span>
          </Link>
        </div>

        {/* Mobile Card View */}
        <div className="min-[701px]:hidden space-y-3">
          {loading && <p className="py-10 text-center text-[14px] text-[#999]">Loading…</p>}
          {!loading && visible.length === 0 && (
            <EmptyState
              title={parcels.length ? "No parcels match your filters" : "You have no parcels yet"}
              text={parcels.length ? "Try a different search or status." : "Create your first parcel to see it here."}
            />
          )}
          {!loading &&
            visible.map((p) => {
              const needsVideo = PENDING.includes(p.status);
              const addr = getParcelAddress(p);
              return (
                <article
                  key={p.parcel_id}
                  className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="block font-mono text-[11px] text-[#999]" title={p.parcel_id}>{shortParcelId(p.parcel_id)}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                          #{p.transaction_number || shortParcelId(p.parcel_id)}
                        </strong>
                        {(p.is_cod || p.payment_method === "COD") && <CodBadge />}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.rescheduled && !p.returnToHub && p.status !== "DELIVERED" && p.scheduledFor && (
                    <p className="mt-2 rounded-lg bg-[#fff8eb] px-2.5 py-1 text-[12px] font-semibold text-[#c98200]">
                      <i className="fa-solid fa-calendar-day mr-1" />
                      Rescheduled (Day {p.rescheduleCount || 1}/3) · {formatDay(p.scheduledFor)}
                    </p>
                  )}
                  {p.returnToHub && (
                    <p className="mt-2 rounded-lg bg-[#f2ecff] px-2.5 py-1 text-[12px] font-semibold text-[#7c3aed]">
                      <i className="fa-solid fa-warehouse mr-1" />
                      Return to Hub · {p.returnCoordinated ? "Return to Seller Coordinated" : "Reached 3-Day Reschedule Limit"}
                    </p>
                  )}
                  <div className="mt-3 space-y-1.5 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                    <p className="flex items-center gap-2">
                      <i className="fa-regular fa-user w-4 text-center text-[#999]" />
                      <strong className="text-[#333] dark:text-[#f1eeeb]">{p.receiver_name}</strong>
                      {p.receiver_contact && <span className="text-[#888]">· {p.receiver_contact}</span>}
                    </p>
                    {addr && (
                      <p className="flex items-start gap-2">
                        <i className="fa-solid fa-location-dot mt-0.5 w-4 text-center text-brand" />
                        <span className="flex-1 break-words text-[12.5px]">{addr}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <i className="fa-solid fa-box-open w-4 text-center text-[#999]" />
                      <span>
                        {p.content_category ? `${p.content_category}: ` : ""}
                        {p.contents || "—"}
                      </span>
                    </p>
                    {p.discrete_item && (
                      <p className="flex items-center gap-2 text-[12px] font-semibold text-[#b45309]">
                        <i className="fa-solid fa-user-shield w-4 text-center text-brand" />
                        <span>
                          Discreet:{" "}
                          {p.discreet_status === "APPROVED"
                            ? "Approved"
                            : p.discreet_status === "REJECTED"
                            ? "Rejected"
                            : "Pending Review"}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3.5 flex items-center justify-between border-t border-[#eee] pt-3 text-[12px] dark:border-night-line">
                    <span className="text-[#999]">{formatDate(p.created_at)}</span>
                    <Link
                      to={`/seller/parcels/${encodeURIComponent(p.transaction_number || p.parcel_id)}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${
                          needsVideo ? "bg-brand text-white" : "bg-brand-soft text-brand dark:bg-night-panel"
                        }`}
                      >
                        <i className={`fa-solid ${needsVideo ? "fa-video" : "fa-arrow-right"}`} />
                        {needsVideo ? "Upload video" : "View details"}
                      </Link>
                  </div>
                </article>
              );
            })}
        </div>

      </section>
    </>
  );
}
