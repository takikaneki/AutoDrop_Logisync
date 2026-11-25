import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { StatCard, StatGrid } from "../components/portal.jsx";
import {
  Avatar,
  CodBadge,
  EmptyState,
  StatusBadge,
  TableSkeleton,
} from "../components/ui.jsx";
import {
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
  panel,
  stickyThead,
  tableCard,
  tableHead,
  tableRow,
  tableScroll,
  tableScrollCompact,
  td,
  th,
} from "../components/styles.js";
import { api, getUser } from "../api.js";
import { getParcelStatus } from "../utils/parcelStatus.js";
import { formatDay } from "../utils/format.js";
import { addReport, useReportHistory } from "../store/records.js";
import { listUsers } from "../services/userService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { getParcelAddress, syncCustomersFromParcels } from "../store/customers.js";
import { enrichParcel } from "../services/parcelService.js";
import { useNetworkResource } from "../hooks/useNetworkResource.js";
import {
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
  ParcelCardListSkeleton,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";
import Pagination from "../components/Pagination.jsx";
import { DatePickerInput, FilterSelect, SearchFilterBar, SearchInput } from "../components/SearchFilterBar.jsx";

const statusIcons = {
  "In Transit": "truck",
  "Ready for Delivery": "circle-check",
  "Rescheduled for Delivery": "calendar-days",
  Rescheduled: "calendar-days",
  Delivered: "check",
  "Return to Hub – Pending Confirmation": "history",
  "Return to Hub – Confirmed": "undo-2",
  "Return to Hub": "undo-2",
  "Failed Delivery": "triangle-alert",
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  "In Transit",
  "Ready for Delivery",
  "Rescheduled for Delivery",
  "Delivered",
  "Return to Hub – Pending Confirmation",
  "Return to Hub – Confirmed",
  "Return to Hub",
  "Failed Delivery",
  "Failed / Return to Hub",
];
const REPORT_DEFAULTS = { status: "All", seller: "All", rider: "All", from: "", to: "" };

function mapParcel(rawParcel, index) {
  const parcel = enrichParcel(rawParcel);
  const sellerName = parcel.seller_name || parcel.seller || "Unknown Seller";
  const shopName = parcel.shop_name || parcel.shop || sellerName;
  const initials = (shopName || sellerName)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const date = parcel.created_at ? new Date(parcel.created_at) : parcel.ts ? new Date(parcel.ts) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const iso = validDate ? date.toISOString().slice(0, 10) : parcel.iso || "";

  let resolvedStatus = getParcelStatus(parcel);
  if (parcel.rth_status === "CONFIRMED" || parcel.status === "RTH_CONFIRMED") {
    resolvedStatus = "Return to Hub – Confirmed";
  } else if (parcel.rth_status === "PENDING_CONFIRMATION" || parcel.status === "RTH_PENDING") {
    resolvedStatus = "Return to Hub – Pending Confirmation";
  } else if (parcel.returnToHub) {
    resolvedStatus = "Return to Hub";
  } else if (parcel.rescheduled && resolvedStatus !== "Delivered") {
    resolvedStatus = "Rescheduled for Delivery";
  }

  return {
    id: String(parcel.parcel_id ?? parcel.id ?? ""),
    transactionNumber: String(parcel.transaction_number || parcel.id || "—"),
    parcelId: parcel.parcel_id ?? parcel.id,
    seller: sellerName,
    sellerCode: parcel.seller_code || "",
    shop: shopName,
    initials: initials || "US",
    tone: parcel.tone || "orange",
    recipient: parcel.receiver_name || parcel.recipient || "—",
    contact: parcel.receiver_contact || "",
    address: getParcelAddress(parcel),
    contents: parcel.contents || parcel.item || "—",
    rider: parcel.rider_name || parcel.rider || parcel.deliveryRecord?.rider_name || "Unassigned",
    status: resolvedStatus,
    isCod: Boolean(parcel.is_cod || String(parcel.payment_method || "").toUpperCase() === "COD"),
    deliveryHold: Boolean(parcel.delivery_hold),
    deliveryHoldReason: parcel.delivery_hold_reason || "",
    rescheduled: Boolean(parcel.rescheduled),
    scheduledFor: parcel.scheduledFor || null,
    rescheduleCount: Number(parcel.rescheduleCount || 0),
    returnToHub: Boolean(parcel.returnToHub),
    returnCoordinated: Boolean(parcel.returnCoordinated),
    lastFailure: parcel.lastFailure || "",
    attempts: parcel.attempts || [],
    verification: parcel.verification_status || parcel.verification || "Pending",
    amount: Number(parcel.amount || 0),
    iso,
    dateLabel: validDate
      ? date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : parcel.dateLabel || "—",
    ts: validDate ? date.getTime() : index,
  };
}

const filterReportRows = (parcels, q) =>
  parcels.filter(
    (p) =>
      (q.status === "All" ||
        p.status === q.status ||
        (q.status === "In Transit" && (p.status === "In Transit" || p.status === "Rescheduled")) ||
        (q.status === "Failed / Return to Hub" &&
          (p.status === "Failed Delivery" ||
            p.status === "Return to Hub" ||
            String(p.status || "").startsWith("Return to Hub") ||
            p.returnToHub))) &&
      (q.seller === "All" || p.seller === q.seller) &&
      (q.rider === "All" || p.rider === q.rider) &&
      (!q.from || (p.iso && p.iso >= q.from)) &&
      (!q.to || (p.iso && p.iso <= q.to))
  );

const describeReport = (q) =>
  [
    q.status !== "All" ? `Status: ${q.status}` : "All statuses",
    q.seller !== "All" && `Seller: ${q.seller}`,
    q.rider !== "All" && `Rider: ${q.rider}`,
    q.from || q.to ? `${q.from || "Start"} to ${q.to || "Today"}` : "All dates",
  ]
    .filter(Boolean)
    .join(" · ");

function downloadCsv(name, rows) {
  const head = ["Tracking ID", "Transaction No.", "Seller", "Recipient", "Address", "Rider", "Date", "Status", "Verification"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    head,
    ...rows.map((p) => [
      p.id,
      p.transactionNumber,
      p.seller,
      p.recipient,
      p.address || "—",
      p.rider,
      p.iso || p.dateLabel,
      p.status,
      p.verification,
    ]),
  ];
  const blob = new Blob(["\ufeff" + lines.map((l) => l.map(esc).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Parcels() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const history = useReportHistory();
  const [dbUsers, setDbUsers] = useState([]);

  const urlStatus = searchParams.get("status");
  const initialStatus = STATUS_OPTIONS.includes(urlStatus) ? urlStatus : "All Status";

  const {
    data: parcels,
    loading,
    error,
    offlineEmpty,
    isStaleOffline,
    cachedAt,
    reload: reloadParcels,
  } = useNetworkResource(
    "coordinator-parcels",
    async () => {
      const data = await api("/parcels");
      if (!Array.isArray(data.parcels)) {
        throw new Error("Invalid parcel data returned by the server.");
      }
      syncCustomersFromParcels(data.parcels);
      return data.parcels.map(mapParcel);
    },
    { initialData: [] }
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState({ key: "ts", dir: "desc" });
  const [page, setPage] = useState(1);

  // Integrated Report state
  const [reportOpen, setReportOpen] = useState(searchParams.get("report") === "1");
  const [reportQuery, setReportQuery] = useState(REPORT_DEFAULTS);
  const [reportResult, setReportResult] = useState(null);
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    listUsers().then(setDbUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setStatus(initialStatus);
    setPage(1);
  }, [initialStatus]);

  const reportSource = parcels;

  useEffect(() => {
    if (!reportOpen) return;
    const rows = filterReportRows(reportSource, reportQuery);
    const today = new Date().toISOString().slice(0, 10);
    const id = reportResult?.id || `Report-${today}-${String(history.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: { ...reportQuery }, rows });
  }, [reportOpen, reportSource]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get("report") === "1") {
      setReportOpen(true);
    }
  }, [searchParams]);

  const toggleReport = () => {
    setReportOpen((prev) => {
      const next = !prev;
      const nextParams = new URLSearchParams(searchParams);
      if (next) {
        nextParams.set("report", "1");
        const rows = filterReportRows(reportSource, reportQuery);
        const today = new Date().toISOString().slice(0, 10);
        const id = `Report-${today}-${String(history.length + 1).padStart(3, "0")}`;
        setReportResult({ id, query: { ...reportQuery }, rows });
        setReportPage(1);
      } else {
        nextParams.delete("report");
      }
      setSearchParams(nextParams, { replace: true });
      return next;
    });
  };

  const generateReport = () => {
    if (reportQuery.from && reportQuery.to && reportQuery.from > reportQuery.to) {
      return toast("The start date must be before the end date.", "error");
    }
    const rows = filterReportRows(reportSource, reportQuery);
    const today = new Date().toISOString().slice(0, 10);
    const id = `Report-${today}-${String(history.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: { ...reportQuery }, rows });
    setReportPage(1);
    addReport({
      id,
      ts: Date.now(),
      name: reportQuery.status === "All" ? "Parcel report" : `${reportQuery.status} parcels`,
      filters: describeReport(reportQuery),
      rows: rows.length,
      by: getUser()?.name || "Coordinator",
      query: { ...reportQuery },
    });
    logAction({ category: "Reports", action: "Generated report", target: id, detail: describeReport(reportQuery) });
    toast(`${id} generated (${rows.length} parcels).`);
  };

  const resetReport = () => {
    setReportQuery(REPORT_DEFAULTS);
    const rows = filterReportRows(reportSource, REPORT_DEFAULTS);
    const today = new Date().toISOString().slice(0, 10);
    const id = `Report-${today}-${String(history.length + 1).padStart(3, "0")}`;
    setReportResult({ id, query: { ...REPORT_DEFAULTS }, rows });
    setReportPage(1);
  };

  const sellersList = useMemo(() => {
    const names = new Set([
      ...dbUsers.filter((u) => u.role === "seller").map((u) => u.name),
      ...reportSource.map((p) => p.seller).filter(Boolean),
    ]);
    return [...names].filter(Boolean);
  }, [dbUsers, reportSource]);
  const ridersList = useMemo(() => {
    const names = new Set([
      ...dbUsers.filter((u) => u.role === "rider").map((u) => u.name),
      ...reportSource.map((p) => p.rider).filter((r) => r && r !== "Unassigned"),
    ]);
    return [...names].filter(Boolean);
  }, [dbUsers, reportSource]);

  const reportSummary = useMemo(() => {
    if (!reportResult) return null;
    const r = reportResult.rows;
    const count = (...s) => r.filter((p) => s.includes(p.status)).length;
    const delivered = count("Delivered");
    const failed = count("Failed Delivery", "Return to Hub");
    return {
      total: r.length,
      delivered,
      transit: count("In Transit", "Rescheduled"),
      failed,
      rate: delivered + failed ? Math.round((delivered / (delivered + failed)) * 100) : 0,
    };
  }, [reportResult]);

  const reportPageRows = reportResult ? reportResult.rows : [];

  const counts = useMemo(() => {
    const result = {
      "In Transit": 0,
      Delivered: 0,
      "Failed / Return to Hub": 0,
    };

    parcels.forEach((parcel) => {
      if (parcel.status === "In Transit" || parcel.status === "Rescheduled") {
        result["In Transit"] += 1;
      } else if (parcel.status === "Delivered") {
        result.Delivered += 1;
      } else if (
        parcel.status === "Failed Delivery" ||
        parcel.status === "Return to Hub" ||
        String(parcel.status || "").startsWith("Return to Hub") ||
        parcel.returnToHub
      ) {
        result["Failed / Return to Hub"] += 1;
      }
    });

    return result;
  }, [parcels]);

  const rows = useMemo(() => {
    const query = search.toLowerCase().trim();

    const filtered = parcels.filter(
      (parcel) =>
        (status === "All Status" ||
          parcel.status === status ||
          (status === "Failed Delivery" && (parcel.status === "Failed Delivery" || parcel.status === "Return to Hub" || String(parcel.status || "").startsWith("Return to Hub") || parcel.returnToHub)) ||
          (status === "Failed / Return to Hub" && (parcel.status === "Failed Delivery" || parcel.status === "Return to Hub" || String(parcel.status || "").startsWith("Return to Hub") || parcel.returnToHub)) ||
          (status === "In Transit" && (parcel.status === "In Transit" || parcel.status === "Rescheduled"))) &&
        (!query ||
          [
            parcel.id,
            parcel.transactionNumber,
            parcel.seller,
            parcel.recipient,
            parcel.address,
            parcel.rider,
          ].some((value) =>
            String(value || "").toLowerCase().includes(query)
          ))
    );

    const direction = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const first = a[sort.key] ?? "";
      const second = b[sort.key] ?? "";

      if (first > second) return direction;
      if (first < second) return -direction;
      return 0;
    });
  }, [parcels, search, status, sort]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reset = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? {
            key,
            dir: current.dir === "asc" ? "desc" : "asc",
          }
        : { key, dir: "asc" }
    );
  };

  const cards = [
    {
      label: "In Transit",
      icon: "truck",
      tone: "orange",
    },
    {
      label: "Delivered",
      icon: "package-check",
      tone: "green",
    },
    {
      label: "Failed / Return to Hub",
      icon: "undo-2",
      tone: "red",
    },
  ];

  const SortTh = ({ k, children }) => (
    <th
      className={`${th} !text-white/90 cursor-pointer select-none hover:!text-[#fb923c]`}
      onClick={() => toggleSort(k)}
    >
      {children}
      <Icon
        name={sort.key === k ? (sort.dir === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down"}
        className={`ml-1.5 h-3 w-3 ${sort.key === k ? "text-brand" : "opacity-40"}`}
      />
    </th>
  );

  const setRQ = (k) => (e) => setReportQuery((s) => ({ ...s, [k]: e.target.value }));

  return (
    <>
      <Topbar
        title="Parcel Records"
        subtitle="Monitor parcel movement, delivery activities, and generate detailed reports."
      >
        <button
          type="button"
          onClick={toggleReport}
          aria-expanded={reportOpen}
          className={reportOpen ? btnGhost : btnPrimary}
        >
          <Icon name={reportOpen ? "x" : "file-text"} />{" "}
          {reportOpen ? "Hide Report" : "Generate Report"}
        </button>
      </Topbar>

      {/* INTEGRATED REPORT SECTION */}
      {reportOpen && reportResult && reportSummary && (
        <section className={`${panel} mb-6 border-brand/30 p-6 max-[600px]:p-4`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#f1f1f1] pb-4 dark:border-night-line">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-night-head">
                  <Icon name="file-text" />
                </span>
                <h2 className="text-[18px] font-bold">{reportResult.id}</h2>
              </div>
              <p className="mt-1 text-[13px] text-[#888]">{describeReport(reportResult.query)}</p>
              <p className="hidden print:block text-[13px] text-[#999]">
                Generated {new Date().toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                onClick={() => {
                  downloadCsv(reportResult.id, reportResult.rows);
                  toast("CSV downloaded.");
                }}
                className={btnGhost}
              >
                <Icon name="file-spreadsheet" className="text-[#29945a]" /> Export CSV
              </button>
              <button onClick={() => window.print()} className={btnPrimary}>
                <Icon name="file-text" /> Save as PDF
              </button>
              <button
                type="button"
                onClick={toggleReport}
                aria-label="Close report"
                title="Close report"
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#777] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head"
              >
                <Icon name="x" />
              </button>
            </div>
          </div>

          {/* Report Filters */}
          <div className="mb-6 rounded-xl bg-[#fafafa] p-4 print:hidden dark:bg-night-head">
            <h3 className="mb-3 text-[13px] font-bold text-[#555] dark:text-[#d1c9c2]">
              <Icon name="sliders-horizontal" className="mr-1.5 text-brand" /> Report Filters
            </h3>
            <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
              <div>
                <label className={labelCls} htmlFor="r-status">Status</label>
                <FilterSelect
                  id="r-status"
                  value={reportQuery.status}
                  onChange={setRQ("status")}
                  ariaLabel="Report status filter"
                  icon="filter"
                  active={reportQuery.status !== "All"}
                  className="w-full"
                >
                  {["All", "In Transit", "Delivered", "Failed / Return to Hub"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-seller">Seller</label>
                <FilterSelect
                  id="r-seller"
                  value={reportQuery.seller}
                  onChange={setRQ("seller")}
                  ariaLabel="Report seller filter"
                  icon="store"
                  active={reportQuery.seller !== "All"}
                  className="w-full"
                >
                  <option>All</option>
                  {sellersList.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-rider">Rider</label>
                <FilterSelect
                  id="r-rider"
                  value={reportQuery.rider}
                  onChange={setRQ("rider")}
                  ariaLabel="Report rider filter"
                  icon="bike"
                  active={reportQuery.rider !== "All"}
                  className="w-full"
                >
                  <option>All</option>
                  {ridersList.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-from">From</label>
                <DatePickerInput
                  id="r-from"
                  value={reportQuery.from}
                  onChange={setRQ("from")}
                  placeholder="Start date"
                  ariaLabel="From date"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="r-to">To</label>
                <DatePickerInput
                  id="r-to"
                  value={reportQuery.to}
                  onChange={setRQ("to")}
                  placeholder="End date"
                  ariaLabel="To date"
                  align="right"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={generateReport} className={btnPrimary}>
                <Icon name="refresh-cw" /> Update & Save Report
              </button>
              <button onClick={resetReport} className={btnGhost}>
                Reset Filters
              </button>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="mb-5 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
            {[
              ["Total parcels", reportSummary.total, "text-[#0f172a] dark:text-[#f1eeeb]", "border-[#cbd5e1] border-t-[3px] border-t-[#64748b] dark:border-slate-700 dark:border-t-[#64748b]"],
              ["Delivered", reportSummary.delivered, "text-[#16a34a] dark:text-[#4ade80]", "border-[#bbf7d0] border-t-[3px] border-t-[#16a34a] dark:border-[#166534]/70 dark:border-t-[#16a34a]"],
              ["In transit / Rescheduled", reportSummary.transit, "text-[#3b82f6] dark:text-[#60a5fa]", "border-[#bfdbfe] border-t-[3px] border-t-[#3b82f6] dark:border-[#1e40af]/70 dark:border-t-[#3b82f6]"],
              ["Return to Hub / Failed", reportSummary.failed, "text-[#dc2626] dark:text-[#f87171]", "border-[#fecaca] border-t-[3px] border-t-[#dc2626] dark:border-[#991b1b]/70 dark:border-t-[#dc2626]"],
              ["Success rate", `${reportSummary.rate}%`, "text-[#16a34a] dark:text-[#4ade80]", "border-[#bbf7d0] border-t-[3px] border-t-[#16a34a] dark:border-[#166534]/70 dark:border-t-[#16a34a]"],
            ].map(([l, v, cls, borderCls]) => (
              <div key={l} className={`rounded-xl border bg-white p-4 dark:bg-night-head ${borderCls}`}>
                <small className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{l}</small>
                <strong className={`mt-1 block text-[24px] leading-tight ${cls}`}>{v}</strong>
              </div>
            ))}
          </div>

          {/* Report Rows Table */}
          {reportResult.rows.length === 0 ? (
            <EmptyState
              icon="file-x"
              title="No parcels match these report filters"
              text="Change the filters above and update the report."
            />
          ) : (
            <>
              <div className={`${tableScrollCompact} print:hidden`}>
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className={stickyThead}>
                    <tr>
                      {["Tracking ID", "Seller", "Recipient", "Address", "Rider", "Date", "Status"].map((h) => (
                        <th key={h} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportPageRows.map((p) => (
                      <tr key={p.id} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={td}>
                          <Link to={`/parcels/${encodeURIComponent(p.parcelId || p.id)}`} className="font-bold text-brand hover:underline">
                            {p.id}
                          </Link>
                        </td>
                        <td className={td}>{p.seller}</td>
                        <td className={td}>{p.recipient}</td>
                        <td className={`${td} max-w-[200px]`}><span className="line-clamp-1">{p.address || "—"}</span></td>
                        <td className={td}>{p.rider}</td>
                        <td className={`${td} whitespace-nowrap`}>{p.dateLabel}</td>
                        <td className={td}><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Print Table */}
              <table className="hidden print:table w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {["Tracking ID", "Seller", "Recipient", "Address", "Rider", "Date", "Status"].map((h) => (
                      <th key={h} className="border-b border-[#ccc] px-2 py-1.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportResult.rows.map((p) => (
                    <tr key={p.id}>
                      <td className="border-b border-[#eee] px-2 py-1">{p.id}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.seller}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.recipient}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.address || "—"}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.rider}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.dateLabel}</td>
                      <td className="border-b border-[#eee] px-2 py-1">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Recent Saved Reports */}
          {history.length > 0 && (
            <div className="mt-6 border-t border-[#eee] pt-5 print:hidden dark:border-night-line">
              <h3 className="mb-3 text-[15px] font-bold">
                <Icon name="history" className="mr-1.5 text-brand" /> Recent Saved Reports
              </h3>
              <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead className={stickyThead}>
                    <tr>
                      {["Report ID", "Filters", "Parcels", "Generated", ""].map((h, i) => (
                        <th key={i} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 5).map((r) => (
                      <tr key={r.id} className="text-[#666] dark:text-[#d1c9c2]">
                        <td className={td}><strong className="text-[#333] dark:text-[#f1eeeb]">{r.id}</strong></td>
                        <td className={td}>{r.filters}</td>
                        <td className={td}>{r.rows}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          {new Date(r.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.by}
                        </td>
                        <td className={`${td} text-right`}>
                          <button
                            className="text-[13px] font-semibold text-brand hover:underline"
                            onClick={() => {
                              downloadCsv(r.id, filterReportRows(reportSource, r.query));
                              toast("CSV downloaded.");
                            }}
                          >
                            <Icon name="download" className="mr-1" /> CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* MOBILE LALAMOVE-STYLE HORIZONTAL FILTER BAR (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Filter parcels by status"
        className={`sticky top-14 z-30 -mx-3.5 -mt-3.5 mb-3 max-[380px]:-mx-2.5 grid grid-cols-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95 ${reportOpen ? "print:hidden" : ""}`}
      >
        {[
          {
            key: "All",
            label: "All",
            count: parcels.length,
            activeText: "text-[#0f172a] dark:text-white",
            hoverText: "hover:text-[#0f172a] dark:hover:text-white",
            activeBar: "bg-[#64748b]",
            activeBadge: "bg-slate-200/80 text-[#0f172a] dark:bg-slate-600/40 dark:text-white",
          },
          {
            key: "In Transit",
            label: "In Transit",
            count: counts["In Transit"],
            activeText: "text-[#c84227] dark:text-[#fb923c]",
            hoverText: "hover:text-[#c84227] dark:hover:text-[#fb923c]",
            activeBar: "bg-[#c84227]",
            activeBadge: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]",
          },
          {
            key: "Delivered",
            label: "Delivered",
            count: counts["Delivered"],
            activeText: "text-[#16a34a] dark:text-[#4ade80]",
            hoverText: "hover:text-[#16a34a] dark:hover:text-[#4ade80]",
            activeBar: "bg-[#16a34a]",
            activeBadge: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
          },
          {
            key: "Failed / Return to Hub",
            label: "Failed",
            count: counts["Failed / Return to Hub"],
            activeText: "text-[#dc2626] dark:text-[#f87171]",
            hoverText: "hover:text-[#dc2626] dark:hover:text-[#f87171]",
            activeBar: "bg-[#dc2626]",
            activeBadge: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
          },
        ].map((tab) => {
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`relative flex items-center justify-center gap-1 px-1 py-3.5 text-[11.5px] max-[360px]:text-[10.5px] leading-tight transition ${tab.activeText} ${
                active ? "font-extrabold" : "font-bold opacity-85 hover:opacity-100"
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab.activeBadge}`}
              >
                {loading ? "—" : tab.count}
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

      {/* MOBILE COMPACT GENERATE REPORT BUTTON (upper-right, below filter bar, above records container) */}
      <div className="mb-3 flex justify-end min-[821px]:hidden print:hidden">
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
          <Icon name={reportOpen ? "x" : "file-text"} className="text-[13px]" />
          <span>{reportOpen ? "Hide Report" : "Generate Report"}</span>
        </button>
      </div>

      {/* DESKTOP SUMMARY CARDS (min-[821px] — 100% unchanged) */}
      <div className={`hidden min-[821px]:block ${reportOpen ? "print:hidden" : ""}`}>
        <StatGrid cols={3}>
          {cards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                setStatus(status === card.label ? "All" : card.label);
                setPage(1);
              }}
              className="text-left w-full h-full cursor-pointer rounded-2xl focus:outline-none"
            >
              <StatCard
                label={card.label}
                value={loading ? "—" : counts[card.label]}
                icon={card.icon}
                tone={card.tone}
                interactive
                active={status === card.label}
              />
            </button>
          ))}
        </StatGrid>
      </div>

      {/* PARCEL RECORDS LIST */}
      <section className={`rounded-2xl border border-[#e5e8ee] bg-white shadow-sm dark:border-night-line dark:bg-night-panel p-[26px] max-[600px]:p-4 ${reportOpen ? "print:hidden" : ""}`}>
        <div className="mb-[18px] max-[820px]:hidden">
          <h2 className="text-[19px] font-bold mb-[5px]">
            Parcel Records
          </h2>
          <p className="text-xs text-[#999]">
            Search, filter and open a parcel to see its tracking timeline, reschedule history, and proof of delivery.
          </p>
        </div>

        {isStaleOffline && <CachedDataNotice updatedAt={cachedAt} />}

        {error && !offlineEmpty && (
          <div className="mb-4">
            <LoadErrorState compact title="Unable to load parcels" message={error} onRetry={reloadParcels} />
          </div>
        )}

        <SearchFilterBar
          className="mb-[18px]"
          hasActiveFilters={Boolean(search.trim() || status !== "All Status")}
          onReset={() => {
            setSearch("");
            setStatus("All Status");
            setPage(1);
          }}
        >
          <SearchInput
            value={search}
            onChange={reset(setSearch)}
            placeholder="Search parcel ID, transaction no., seller, recipient or rider..."
            ariaLabel="Search parcels"
          />
          <FilterSelect
            value={status}
            onChange={reset(setStatus)}
            ariaLabel="Filter by status"
            icon="filter"
            active={status !== "All Status"}
            className="min-w-[195px]"
          >
            <option>All Status</option>
            <option>In Transit</option>
            <option>Delivered</option>
            <option>Failed / Return to Hub</option>
          </FilterSelect>
        </SearchFilterBar>

        {/* Desktop & Tablet Table View */}
        <div className={`hidden min-[701px]:block ${tableScroll} !border-[#e5e8ee] dark:!border-night-line`}>
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0f172a] text-white dark:bg-[#d9482b]">
              <tr>
                <SortTh k="id">Tracking ID</SortTh>
                <SortTh k="seller">Seller</SortTh>
                <SortTh k="recipient">Recipient</SortTh>
                <SortTh k="rider">Rider</SortTh>
                <SortTh k="ts">Date</SortTh>
                <th className={`${th} !text-white/90`}>Status</th>
                <th className={`${th} !text-white/90 text-center`}>Action</th>
              </tr>
            </thead>

            {loading ? (
              <TableSkeleton rows={PAGE_SIZE} cols={7} />
            ) : (
              <tbody>
                {pageRows.map((parcel) => (
                  <tr
                    key={parcel.parcelId ?? parcel.id}
                    onClick={() =>
                      navigate(`/parcels/${encodeURIComponent(parcel.parcelId)}`)
                    }
                    className={`cursor-pointer ${tableRow}`}
                  >
                    <td className={td}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          to={`/parcels/${encodeURIComponent(parcel.parcelId)}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-bold text-brand hover:underline"
                        >
                          {parcel.id}
                        </Link>
                        {parcel.isCod && <CodBadge />}
                      </div>
                    </td>

                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={parcel.initials}
                          tone={parcel.tone}
                        />
                        <div>
                          <strong className="block text-[14px] text-[#333] dark:text-[#f1eeeb]">
                            {parcel.seller}
                          </strong>
                          <span className="block text-[11px] text-[#aaa]">
                            {parcel.shop}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className={td}>{parcel.recipient}</td>
                    <td className={td}>{parcel.rider}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {parcel.dateLabel}
                    </td>
                    <td className={td}>
                      <StatusBadge
                        status={parcel.status}
                        icon={statusIcons[parcel.status]}
                      />
                      {parcel.deliveryHold && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#b45309]">
                          <Icon name="hand" className="mr-1" />
                          Delivery Hold{parcel.deliveryHoldReason ? ` (${parcel.deliveryHoldReason})` : ""}
                        </span>
                      )}
                      {parcel.rescheduled && !parcel.returnToHub && parcel.scheduledFor && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#c98200]">
                          Day {parcel.rescheduleCount || 1}/3 · {formatDay(parcel.scheduledFor)}
                        </span>
                      )}
                      {parcel.returnToHub && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#d94747]">
                          {parcel.returnCoordinated ? "Return Coordinated" : "Attempt Limit Reached"}
                        </span>
                      )}
                    </td>

                    <td className={`${td} text-center`}>
                      <Link
                        to={`/parcels/${encodeURIComponent(parcel.parcelId)}`}
                        onClick={(event) => event.stopPropagation()}
                        title="View full parcel details"
                        aria-label={`View full details for ${parcel.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand-softer text-brand transition hover:bg-brand hover:text-white dark:border-night-line dark:bg-night-head"
                      >
                        <Icon name="eye" className="text-[13.5px]" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading && offlineEmpty && (
            <div className="p-4">
              <OfflineState compact title="Parcel records unavailable offline" text="Reconnect to load parcel records from the hub." onRetry={reloadParcels} />
            </div>
          )}

          {!loading && !offlineEmpty && !error && rows.length === 0 && (
            <EmptyState
              title="No parcels found"
              text="Try a different search or filter."
            />
          )}
        </div>

        {/* Mobile Card View */}
        <div className="min-[701px]:hidden space-y-3">
          {loading && <ParcelCardListSkeleton count={4} label="Loading parcels" />}
          {!loading && offlineEmpty && (
            <OfflineState compact title="Parcel records unavailable offline" text="Reconnect to load parcel records from the hub." onRetry={reloadParcels} />
          )}
          {!loading && !offlineEmpty && !error && rows.length === 0 && (
            <EmptyState title="No parcels found" text="Try a different search or filter." />
          )}
          {!loading &&
            pageRows.map((parcel) => (
              <article
                key={parcel.parcelId ?? parcel.id}
                onClick={() => navigate(`/parcels/${encodeURIComponent(parcel.parcelId)}`)}
                className="cursor-pointer rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 transition active:scale-[0.99] dark:border-night-line dark:bg-night-head"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        to={`/parcels/${encodeURIComponent(parcel.parcelId)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[15px] font-bold text-brand hover:underline"
                      >
                        {parcel.id}
                      </Link>
                      {parcel.isCod && <CodBadge />}
                    </div>
                    {parcel.transactionNumber !== "—" && (
                      <span className="block text-[11px] text-[#999]">Txn #{parcel.transactionNumber}</span>
                    )}
                  </div>
                  <StatusBadge status={parcel.status} icon={statusIcons[parcel.status]} />
                </div>

                {parcel.rescheduled && !parcel.returnToHub && parcel.scheduledFor && (
                  <p className="mt-2 rounded-lg bg-[#fff8eb] px-2.5 py-1 text-[12px] font-semibold text-[#c98200]">
                    <Icon name="calendar-days" className="mr-1" />
                    Rescheduled · {formatDay(parcel.scheduledFor)}
                  </p>
                )}
                {parcel.returnToHub && (
                  <p className="mt-2 rounded-lg bg-[#fff0f0] px-2.5 py-1 text-[12px] font-semibold text-[#d94747]">
                    <Icon name="undo-2" className="mr-1" />
                    Return to Hub · {parcel.returnCoordinated ? "Return Coordinated" : "Attempt Limit Reached"}
                  </p>
                )}

                <div className="mt-3 space-y-1.5 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                  <p className="flex items-center gap-2">
                    <Icon name="store" className="h-4 w-4 text-[#999]" />
                    <span>Seller: <strong className="text-[#333] dark:text-[#f1eeeb]">{parcel.seller}</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Icon name="user-round" className="h-4 w-4 text-[#999]" />
                    <span>Recipient: <strong className="text-[#333] dark:text-[#f1eeeb]">{parcel.recipient}</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Icon name="bike" className="h-4 w-4 text-[#999]" />
                    <span>Rider: <strong>{parcel.rider}</strong></span>
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eee] pt-2.5 text-[12px] dark:border-night-line">
                  <span className="text-[#999]">{parcel.dateLabel}</span>
                  <span className="font-semibold text-brand">
                    View details <Icon name="chevron-right" className="ml-1 text-[10px]" />
                  </span>
                </div>
              </article>
            ))}
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </section>
    </>
  );
}
