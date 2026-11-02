import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import Pagination from "../../components/Pagination.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../../components/portal.jsx";
import ParcelReport from "../../components/seller/ParcelReport.jsx";
import { btnGhost, btnPrimary, inputCls, panel, td, th } from "../../components/styles.js";
import { listParcels } from "../../services/parcelService.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { statusInfo } from "../../utils/parcelStatus.js";
import { bucketOf } from "../../utils/stats.js";
import { getParcelAddress } from "../../store/customers.js";

const PAGE_SIZE = 10;
const PENDING = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

const FILTERS = [
  { key: "NEEDS_VIDEO", label: "Needs Video", icon: "fa-video", tone: "yellow", match: (p) => PENDING.includes(p.status) },
  { key: "UNDER_VERIFICATION", label: "Under Verification", icon: "fa-hourglass-half", tone: "blue", match: (p) => p.status === "VIDEO_SUBMITTED" },
  { key: "VERIFIED", label: "Verified / In Delivery", icon: "fa-circle-check", tone: "green", match: (p) => ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED"].includes(p.status) },
  { key: "RETURN_TO_HUB", label: "Return to Hub / Rejected", icon: "fa-warehouse", tone: "red", match: (p) => ["RETURN_TO_HUB", "REJECTED", "DELIVERY_FAILED"].includes(p.status) },
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
      return [p.parcel_id, p.transaction_number, p.receiver_name, p.receiver_contact, getParcelAddress(p), p.contents].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "status") return statusInfo(a.status).label.localeCompare(statusInfo(b.status).label);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [parcels, search, status, sort, isBucket]);

  useEffect(() => setPage(1), [search, status, sort]);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      <div className={reportOpen ? "print:hidden" : ""}>
        <StatGrid>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => toggle(f.key)} aria-pressed={status === f.key} className={`block h-full text-left [&>div]:h-full ${status === f.key ? "[&>div]:!border-brand" : ""}`}>
              <StatCard label={f.label} value={loading ? "…" : countOf(f)} icon={f.icon} tone={f.tone} />
            </button>
          ))}
        </StatGrid>
      </div>

      <section className={`${panel} p-[26px] max-[600px]:p-4 ${reportOpen ? "print:hidden" : ""}`}>
        <div className="mb-[18px] grid grid-cols-[1fr_190px_170px] gap-3 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div className="relative max-[900px]:col-span-2 max-[600px]:col-span-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, transaction no., customer, address, contact or contents..." aria-label="Search" className={`${inputCls} pl-9`} />
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

        {/* Desktop & Tablet Table View */}
        <div className="hidden min-[701px]:block w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                {["Parcel ID", "Transaction no.", "Customer / Receiver", "Address", "Contents", "Status", "Created", ""].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const needsVideo = PENDING.includes(p.status);
                const addr = getParcelAddress(p);
                return (
                  <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={`${td} whitespace-nowrap font-mono text-[12px]`}>{p.parcel_id}</td>
                    <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{p.transaction_number || "—"}</td>
                    <td className={td}>
                      <strong className="block text-[14px] text-[#333] dark:text-[#f1eeeb]">{p.receiver_name}</strong>
                      <span className="block text-[12px] text-[#aaa]">{p.receiver_contact || "—"}</span>
                    </td>
                    <td className={`${td} max-w-[220px]`}>
                      <span className="line-clamp-2 text-[12.5px]">{addr || "—"}</span>
                    </td>
                    <td className={td}>{p.contents || "—"}</td>
                    <td className={td}>
                      <StatusBadge status={p.status} />
                      {p.rescheduled && !p.returnToHub && p.scheduledFor && (
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
                      <Link to={`/seller/scan?txn=${encodeURIComponent(p.transaction_number || p.parcel_id)}`} className="font-semibold text-brand hover:underline">
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
                      <span className="block font-mono text-[11px] text-[#999]">{p.parcel_id}</span>
                      <strong className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                        #{p.transaction_number || p.parcel_id}
                      </strong>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.rescheduled && !p.returnToHub && p.scheduledFor && (
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
                      <span>{p.contents || "—"}</span>
                    </p>
                  </div>
                  <div className="mt-3.5 flex items-center justify-between border-t border-[#eee] pt-3 text-[12px] dark:border-night-line">
                    <span className="text-[#999]">{formatDate(p.created_at)}</span>
                    <Link
                      to={`/seller/scan?txn=${encodeURIComponent(p.transaction_number || p.parcel_id)}`}
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

        {!loading && rows.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />}
      </section>
    </>
  );
}
