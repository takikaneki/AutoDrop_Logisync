import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { StatCard, StatGrid } from "../components/portal.jsx";
import Pagination from "../components/Pagination.jsx";
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
  tableCard,
  tableHead,
  tableRow,
  tableWrap,
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

const statusIcons = {
  "In Transit": "fa-truck",
  Rescheduled: "fa-calendar-day",
  Delivered: "fa-check",
  "Return to Hub": "fa-warehouse",
  "Failed Delivery": "fa-triangle-exclamation",
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  "In Transit",
  "Rescheduled",
  "Delivered",
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
  if (parcel.returnToHub) {
    resolvedStatus = "Return to Hub";
  } else if (parcel.rescheduled && resolvedStatus !== "Delivered") {
    resolvedStatus = "Rescheduled";
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
      (q.status === "All" || p.status === q.status) &&
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

  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    let active = true;

    async function loadParcels() {
      try {
        setLoading(true);
        setError("");

        const data = await api("/parcels");

        if (!Array.isArray(data.parcels)) {
          throw new Error("Invalid parcel data returned by the server.");
        }

        syncCustomersFromParcels(data.parcels);
        const mappedParcels = data.parcels.map(mapParcel);

        if (active) {
          setParcels(mappedParcels);
          setPage(1);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load parcels.");
          setParcels([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadParcels();
    listUsers().then(setDbUsers).catch(() => {});

    return () => {
      active = false;
    };
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

  const reportPageRows = reportResult
    ? reportResult.rows.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE)
    : [];

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
      } else if (parcel.status === "Failed Delivery" || parcel.status === "Return to Hub") {
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
          (status === "Failed Delivery" && (parcel.status === "Failed Delivery" || parcel.status === "Return to Hub")) ||
          (status === "Failed / Return to Hub" && (parcel.status === "Failed Delivery" || parcel.status === "Return to Hub")) ||
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

  const pageRows = rows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

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
      icon: "fa-truck",
      tone: "orange",
    },
    {
      label: "Delivered",
      icon: "fa-circle-check",
      tone: "green",
    },
    {
      label: "Failed / Return to Hub",
      icon: "fa-warehouse",
      tone: "red",
    },
  ];

  const SortTh = ({ k, children }) => (
    <th
      className={`${th} cursor-pointer select-none hover:text-brand`}
      onClick={() => toggleSort(k)}
    >
      {children}
      <i
        className={`fa-solid ml-1.5 text-[10px] ${
          sort.key === k
            ? sort.dir === "asc"
              ? "fa-arrow-up text-brand"
              : "fa-arrow-down text-brand"
            : "fa-sort opacity-40"
        }`}
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
          <i className={`fa-solid ${reportOpen ? "fa-xmark" : "fa-file-lines"}`} />{" "}
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
                  <i className="fa-solid fa-file-lines" />
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
                <i className="fa-solid fa-file-csv text-[#29945a]" /> Export CSV
              </button>
              <button onClick={() => window.print()} className={btnPrimary}>
                <i className="fa-solid fa-file-pdf" /> Save as PDF
              </button>
              <button
                type="button"
                onClick={toggleReport}
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
            <h3 className="mb-3 text-[13px] font-bold text-[#555] dark:text-[#d1c9c2]">
              <i className="fa-solid fa-sliders mr-1.5 text-brand" /> Report Filters
            </h3>
            <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
              <div>
                <label className={labelCls} htmlFor="r-status">Status</label>
                <select id="r-status" value={reportQuery.status} onChange={setRQ("status")} className={inputCls}>
                  {["All", "In Transit", "Rescheduled", "Delivered", "Return to Hub", "Failed Delivery"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-seller">Seller</label>
                <select id="r-seller" value={reportQuery.seller} onChange={setRQ("seller")} className={inputCls}>
                  <option>All</option>
                  {sellersList.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-rider">Rider</label>
                <select id="r-rider" value={reportQuery.rider} onChange={setRQ("rider")} className={inputCls}>
                  <option>All</option>
                  {ridersList.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="r-from">From</label>
                <input id="r-from" type="date" value={reportQuery.from} onChange={setRQ("from")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="r-to">To</label>
                <input id="r-to" type="date" value={reportQuery.to} onChange={setRQ("to")} className={inputCls} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={generateReport} className={btnPrimary}>
                <i className="fa-solid fa-rotate" /> Update & Save Report
              </button>
              <button onClick={resetReport} className={btnGhost}>
                Reset Filters
              </button>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="mb-5 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
            {[
              ["Total parcels", reportSummary.total, "text-[#27364f] dark:text-[#f1eeeb]"],
              ["Delivered", reportSummary.delivered, "text-[#29945a]"],
              ["In transit / Rescheduled", reportSummary.transit, "text-[#e9651c]"],
              ["Return to Hub / Failed", reportSummary.failed, "text-[#7c3aed]"],
              ["Success rate", `${reportSummary.rate}%`, "text-brand"],
            ].map(([l, v, cls]) => (
              <div key={l} className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#888]">{l}</small>
                <strong className={`mt-1 block text-[24px] leading-tight ${cls}`}>{v}</strong>
              </div>
            ))}
          </div>

          {/* Report Rows Table */}
          {reportResult.rows.length === 0 ? (
            <EmptyState
              icon="fa-file-circle-xmark"
              title="No parcels match these report filters"
              text="Change the filters above and update the report."
            />
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line print:hidden">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head">
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
              <div className="print:hidden">
                <Pagination page={reportPage} pageSize={PAGE_SIZE} total={reportResult.rows.length} onPage={setReportPage} />
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
                <i className="fa-solid fa-clock-rotate-left mr-1.5 text-brand" /> Recent Saved Reports
              </h3>
              <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead className="bg-[#fafafa] dark:bg-night-head">
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
                            <i className="fa-solid fa-download mr-1" /> CSV
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

      {/* SUMMARY CARDS */}
      <div className={reportOpen ? "print:hidden" : ""}>
        <StatGrid cols={3}>
          {cards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                setStatus(card.label);
                setPage(1);
              }}
              className="text-left w-full h-full cursor-pointer focus:outline-none"
            >
              <StatCard
                label={card.label}
                value={loading ? "—" : counts[card.label]}
                icon={card.icon}
                tone={card.tone}
              />
            </button>
          ))}
        </StatGrid>
      </div>

      {/* PARCEL RECORDS LIST */}
      <section className={`${tableCard} p-[26px] max-[600px]:p-4 ${reportOpen ? "print:hidden" : ""}`}>
        <div className="mb-[18px]">
          <h2 className="text-[19px] font-bold mb-[5px]">
            Parcel Records
          </h2>
          <p className="text-xs text-[#999]">
            Search, filter and open a parcel to see its tracking timeline, reschedule history, and proof of delivery.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 font-semibold underline"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid grid-cols-[1fr_190px] gap-3 mb-[18px] max-[900px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input
              value={search}
              onChange={reset(setSearch)}
              placeholder="Search parcel ID, transaction no., seller, recipient or rider..."
              className={`${inputCls} pl-9`}
            />
          </div>

          <select
            value={status}
            onChange={reset(setStatus)}
            className={inputCls}
            aria-label="Filter by status"
          >
            <option>All Status</option>
            <option>In Transit</option>
            <option>Rescheduled</option>
            <option>Delivered</option>
            <option>Failed / Return to Hub</option>
            <option>Return to Hub</option>
            <option>Failed Delivery</option>
          </select>
        </div>

        {/* Desktop & Tablet Table View */}
        <div className={`hidden min-[701px]:block ${tableWrap}`}>
          <table className="w-full min-w-[820px] border-collapse">
            <thead className={tableHead}>
              <tr>
                <SortTh k="id">Tracking ID</SortTh>
                <SortTh k="seller">Seller</SortTh>
                <SortTh k="recipient">Recipient</SortTh>
                <SortTh k="rider">Rider</SortTh>
                <SortTh k="ts">Date</SortTh>
                <th className={th}>Status</th>
              </tr>
            </thead>

            {loading ? (
              <TableSkeleton rows={PAGE_SIZE} cols={6} />
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
                          <i className="fa-solid fa-hand mr-1" />
                          Delivery Hold{parcel.deliveryHoldReason ? ` (${parcel.deliveryHoldReason})` : ""}
                        </span>
                      )}
                      {parcel.rescheduled && !parcel.returnToHub && parcel.scheduledFor && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#c98200]">
                          Day {parcel.rescheduleCount || 1}/3 · {formatDay(parcel.scheduledFor)}
                        </span>
                      )}
                      {parcel.returnToHub && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#7c3aed]">
                          {parcel.returnCoordinated ? "Return Coordinated" : "3-Day Limit Reached"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading && !error && rows.length === 0 && (
            <EmptyState
              title="No parcels found"
              text="Try a different search or filter."
            />
          )}
        </div>

        {/* Mobile Card View */}
        <div className="min-[701px]:hidden space-y-3">
          {loading && <p className="py-10 text-center text-[14px] text-[#999]">Loading parcels…</p>}
          {!loading && !error && rows.length === 0 && (
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
                    <i className="fa-solid fa-calendar-day mr-1" />
                    Rescheduled (Day {parcel.rescheduleCount || 1}/3) · {formatDay(parcel.scheduledFor)}
                  </p>
                )}
                {parcel.returnToHub && (
                  <p className="mt-2 rounded-lg bg-[#f2ecff] px-2.5 py-1 text-[12px] font-semibold text-[#7c3aed]">
                    <i className="fa-solid fa-warehouse mr-1" />
                    Return to Hub · {parcel.returnCoordinated ? "Return Coordinated" : "3-Day Limit Reached"}
                  </p>
                )}

                <div className="mt-3 space-y-1.5 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                  <p className="flex items-center gap-2">
                    <i className="fa-solid fa-store w-4 text-center text-[#999]" />
                    <span>Seller: <strong className="text-[#333] dark:text-[#f1eeeb]">{parcel.seller}</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <i className="fa-regular fa-user w-4 text-center text-[#999]" />
                    <span>Recipient: <strong className="text-[#333] dark:text-[#f1eeeb]">{parcel.recipient}</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <i className="fa-solid fa-motorcycle w-4 text-center text-[#999]" />
                    <span>Rider: <strong>{parcel.rider}</strong></span>
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eee] pt-2.5 text-[12px] dark:border-night-line">
                  <span className="text-[#999]">{parcel.dateLabel}</span>
                  <span className="font-semibold text-brand">
                    View details <i className="fa-solid fa-chevron-right ml-1 text-[10px]" />
                  </span>
                </div>
              </article>
            ))}
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPage={setPage}
        />
      </section>
    </>
  );
}
