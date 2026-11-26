import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { EmptyState, Modal, TableSkeleton } from "../components/ui.jsx";
import {
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
  panel,
  stickyThead,
  tableScroll,
  td,
  textareaCls,
  th,
} from "../components/styles.js";
import {
  fetchEmergencyReports,
  getEmergencyReport,
  updateEmergencyReport,
} from "../services/emergencyService.js";
import { syncCoordinatorNotificationsFromServer } from "../store/notifications.js";
import { toast } from "../store/toast.js";
import {
  isOnline,
  readViewCache,
  useNetworkStatus,
  useReconnectRefresh,
  writeViewCache,
} from "../utils/network.js";
import {
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
  ParcelCardListSkeleton,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";
import { FilterSelect, SearchFilterBar, SearchInput } from "../components/SearchFilterBar.jsx";

const STATUS_META = {
  NEW: {
    label: "New / Unreviewed",
    short: "New",
    cls: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    short: "Acknowledged",
    cls: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    short: "In Progress",
    cls: "bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/20 dark:text-[#60a5fa]",
  },
  RESOLVED: {
    label: "Resolved",
    short: "Resolved",
    cls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
  },
};

function formatDateTime(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchesFilter(report, filterKey) {
  if (filterKey === "ALL") return true;
  if (filterKey === "NEW") return report.status === "NEW";
  if (filterKey === "ACKNOWLEDGED") {
    return report.status === "ACKNOWLEDGED" || report.status === "IN_PROGRESS";
  }
  if (filterKey === "RESOLVED") return report.status === "RESOLVED";
  return report.status === filterKey;
}

export default function EmergencyReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { online } = useNetworkStatus();
  const initialCached = useMemo(() => readViewCache("coordinator-emergency-reports"), []);
  const [reports, setReports] = useState(() =>
    Array.isArray(initialCached?.data) ? initialCached.data : []
  );
  const [hasData, setHasData] = useState(() => Boolean(initialCached?.data));
  const [cachedAt, setCachedAt] = useState(() => initialCached?.updatedAt || null);
  const [loading, setLoading] = useState(() => isOnline() && !initialCached?.data);
  const [loadError, setLoadError] = useState("");

  const [filterKey, setFilterKey] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [nextStatus, setNextStatus] = useState("ACKNOWLEDGED");
  const [coordNote, setCoordNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!isOnline()) {
      setLoading(false);
      return;
    }
    setLoadError("");
    try {
      const { reports: list } = await fetchEmergencyReports();
      setReports(list);
      setHasData(true);
      setCachedAt(Date.now());
      writeViewCache("coordinator-emergency-reports", list);
    } catch (err) {
      if (isOnline()) {
        setLoadError(err?.message || "Failed to load emergency reports.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 20000);
    return () => clearInterval(timer);
  }, [loadData]);

  useReconnectRefresh(loadData);

  const openReportModal = useCallback((report) => {
    if (!report) return;
    setSelectedReport(report);
    setNextStatus(report.status === "NEW" ? "ACKNOWLEDGED" : report.status);
    setCoordNote("");
  }, []);

  // Support direct deep link from Web Push / Bell notification: /emergency-reports?report=EMR-0001
  const deepLinkCode = searchParams.get("report");
  useEffect(() => {
    if (!deepLinkCode) return;
    const match = reports.find(
      (r) => String(r.report_code || "").toUpperCase() === String(deepLinkCode).toUpperCase()
    );
    if (match) {
      openReportModal(match);
      return;
    }
    if (!isOnline()) return;
    let active = true;
    getEmergencyReport(deepLinkCode)
      .then((fetched) => {
        if (!active || !fetched) return;
        setReports((prev) => {
          const exists = prev.some((r) => r.report_code === fetched.report_code);
          return exists ? prev : [fetched, ...prev];
        });
        openReportModal(fetched);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deepLinkCode, reports, openReportModal]);

  const closeModal = () => {
    setSelectedReport(null);
    setCoordNote("");
    if (searchParams.has("report")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("report");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const counts = useMemo(
    () => ({
      ALL: reports.length,
      NEW: reports.filter((r) => r.status === "NEW").length,
      ACKNOWLEDGED: reports.filter(
        (r) => r.status === "ACKNOWLEDGED" || r.status === "IN_PROGRESS"
      ).length,
      RESOLVED: reports.filter((r) => r.status === "RESOLVED").length,
    }),
    [reports]
  );

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  useEffect(() => setPage(1), [filterKey, roleFilter, search]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (!matchesFilter(r, filterKey)) return false;
      if (roleFilter !== "ALL" && String(r.reporter_role || "").toLowerCase() !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return [
        r.report_code,
        r.reporter_name,
        r.reporter_identifier,
        r.reporter_role,
        r.category,
        r.subject,
        r.location,
        r.description,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [reports, filterKey, roleFilter, search]);

  const pagedReports = filteredReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const applyUpdate = async ({ statusOverride, noteOverride } = {}) => {
    if (!selectedReport || saving) return;
    const statusToSend = statusOverride || nextStatus;
    const noteToSend = noteOverride !== undefined ? noteOverride : coordNote.trim();

    if (statusToSend === selectedReport.status && !noteToSend) {
      toast("Select a new status or enter a coordinator note first.", "info");
      return;
    }

    setSaving(true);
    try {
      const res = await updateEmergencyReport(selectedReport.report_code, {
        status: statusToSend,
        note: noteToSend,
      });
      const updated = res?.report;
      if (updated) {
        setReports((prev) => {
          const nextList = prev.map((item) =>
            item.report_id === updated.report_id ? updated : item
          );
          writeViewCache("coordinator-emergency-reports", nextList);
          return nextList;
        });
        setSelectedReport(updated);
        setNextStatus(updated.status);
        setCoordNote("");
        window.dispatchEvent(new CustomEvent("logisync:emergency-updated"));
        syncCoordinatorNotificationsFromServer();
      }
      toast(res?.message || `Updated ${selectedReport.report_code}.`);
    } catch (err) {
      toast(err?.message || "Failed to update emergency report.", "error");
    } finally {
      setSaving(false);
    }
  };

  const offlineEmpty = !online && !hasData;
  const showCachedNotice = !online && hasData;

  return (
    <>
      <Topbar
        title="Emergency Reports"
        subtitle="High-priority incident alerts submitted by Sellers and Riders requiring immediate coordinator review."
      />

      {/* Mobile Horizontal Filter Tabs (3 filters — tap active tab to show all) */}
      <div
        role="tablist"
        aria-label="Filter emergency reports by status"
        className="-mx-3.5 -mt-3.5 mb-4 grid grid-cols-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95 max-[380px]:-mx-2.5"
      >
        {[
          {
            key: "NEW",
            label: "New",
            count: counts.NEW,
            textCls: "text-[#dc2626] dark:text-[#f87171]",
            badgeCls: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
            barCls: "bg-[#dc2626]",
          },
          {
            key: "ACKNOWLEDGED",
            label: "Acknowledged",
            count: counts.ACKNOWLEDGED,
            textCls: "text-[#c84227] dark:text-[#fb923c]",
            badgeCls: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]",
            barCls: "bg-[#c84227]",
          },
          {
            key: "RESOLVED",
            label: "Resolved",
            count: counts.RESOLVED,
            textCls: "text-[#16a34a] dark:text-[#4ade80]",
            badgeCls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
            barCls: "bg-[#16a34a]",
          },
        ].map((tab) => {
          const active = filterKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilterKey(active ? "ALL" : tab.key)}
              className={`relative flex items-center justify-center gap-1.5 px-2 py-3.5 text-[12px] leading-tight transition max-[360px]:text-[11px] ${tab.textCls} ${
                active ? "font-extrabold" : "font-bold opacity-85 hover:opacity-100"
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab.badgeCls}`}
              >
                {tab.count}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-[2.5px] rounded-full ${tab.barCls}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Summary Cards (3 cards — click active card to show all) */}
      <section className="mb-6 hidden grid-cols-3 gap-5 min-[821px]:grid">
        {[
          {
            key: "NEW",
            label: "New / Unreviewed",
            count: counts.NEW,
            badgeCls: STATUS_META.NEW.cls,
            borderCls: "!border-[#fecaca] !border-t-[3px] !border-t-[#dc2626] dark:!border-[#991b1b]/70 dark:!border-t-[#dc2626]",
          },
          {
            key: "ACKNOWLEDGED",
            label: "Acknowledged",
            count: counts.ACKNOWLEDGED,
            badgeCls: STATUS_META.ACKNOWLEDGED.cls,
            borderCls: "!border-[#fed7aa] !border-t-[3px] !border-t-[#c84227] dark:!border-[#9a3412]/70 dark:!border-t-[#c84227]",
          },
          {
            key: "RESOLVED",
            label: "Resolved",
            count: counts.RESOLVED,
            badgeCls: STATUS_META.RESOLVED.cls,
            borderCls: "!border-[#bbf7d0] !border-t-[3px] !border-t-[#16a34a] dark:!border-[#166534]/70 dark:!border-t-[#16a34a]",
          },
        ].map((card) => {
          const active = filterKey === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilterKey(active ? "ALL" : card.key)}
              className={`${panel} ${card.borderCls} flex min-w-0 flex-col items-start justify-between p-6 text-left transition hover:shadow-md active:scale-[0.99] ${
                active ? "!border-brand ring-2 ring-brand/40 shadow-sm" : ""
              }`}
            >
              <span
                className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold leading-none ${card.badgeCls}`}
              >
                {card.label}
              </span>
              <strong className="mt-4 block text-[32px] font-extrabold leading-none tracking-tight text-[#0f172a] dark:text-white">
                {card.count}
              </strong>
            </button>
          );
        })}
      </section>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        {/* Filter Bar */}
        <SearchFilterBar
          hasActiveFilters={Boolean(search.trim() || filterKey !== "ALL" || roleFilter !== "ALL")}
          onReset={() => {
            setSearch("");
            setFilterKey("ALL");
            setRoleFilter("ALL");
          }}
        >
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, reporter, category, subject, or location..."
            ariaLabel="Search emergency reports"
          />
          <FilterSelect
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            ariaLabel="Filter by status"
            icon="filter"
            active={filterKey !== "ALL"}
            className="min-w-[185px]"
          >
            <option value="ALL">All Reports ({counts.ALL})</option>
            <option value="NEW">New / Unreviewed ({counts.NEW})</option>
            <option value="ACKNOWLEDGED">Acknowledged ({counts.ACKNOWLEDGED})</option>
            <option value="RESOLVED">Resolved ({counts.RESOLVED})</option>
          </FilterSelect>
          <FilterSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            ariaLabel="Filter by reporter role"
            icon="users"
            active={roleFilter !== "ALL"}
            className="min-w-[145px]"
          >
            <option value="ALL">All Roles</option>
            <option value="rider">Riders</option>
            <option value="seller">Sellers</option>
          </FilterSelect>
          <button
            type="button"
            onClick={loadData}
            disabled={!online || loading}
            className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200/95 bg-white px-3.5 text-[13px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-slate-700/80 dark:bg-[#111c30] dark:text-slate-200 dark:hover:border-brand dark:hover:text-brand max-[640px]:w-full"
          >
            <Icon name="refresh-cw" className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </SearchFilterBar>

        {showCachedNotice && <CachedDataNotice updatedAt={cachedAt} />}
        {loadError && !offlineEmpty && (
          <div className="mb-4">
            <LoadErrorState
              compact
              title="Unable to load emergency reports"
              message={loadError}
              onRetry={loadData}
            />
          </div>
        )}

        {/* Desktop Table */}
        <div className={`hidden min-[768px]:block ${tableScroll}`}>
          <table className="w-full min-w-[920px] border-collapse">
            <thead className={stickyThead}>
              <tr>
                {[
                  "Report ID",
                  "Submitted By",
                  "Category",
                  "Subject & Location",
                  "Submitted",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th key={i} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : (
              <tbody>
                {pagedReports.map((r) => {
                  const st = STATUS_META[r.status] || STATUS_META.NEW;
                  const isNew = r.status === "NEW";
                  return (
                    <tr
                      key={r.report_code}
                      className={`text-[#666] transition hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head ${
                        isNew ? "bg-[#fff5f5]/70 dark:bg-red-950/15" : ""
                      }`}
                    >
                      <td className={`${td} whitespace-nowrap font-extrabold text-[#dc2626]`}>
                        <div className="flex items-center gap-2">
                          {isNew && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full bg-[#dc2626] animate-pulse"
                              title="New unreviewed emergency"
                            />
                          )}
                          <span>{r.report_code}</span>
                        </div>
                      </td>
                      <td className={td}>
                        <strong className="block text-[13.5px] text-[#1e293b] dark:text-[#f1eeeb]">
                          {r.reporter_name}
                        </strong>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-[#888]">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold uppercase text-slate-600 dark:bg-night-line dark:text-[#d1c9c2]">
                            {r.reporter_role}
                          </span>
                          {r.reporter_identifier && (
                            <span className="font-mono">{r.reporter_identifier}</span>
                          )}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="inline-block rounded-md bg-[#fef2f2] px-2.5 py-1 text-[11.5px] font-bold text-[#b91c1c] dark:bg-red-500/15 dark:text-red-300">
                          {r.category}
                        </span>
                      </td>
                      <td className={`${td} max-w-[320px]`}>
                        <strong className="line-clamp-1 text-[13.5px] text-[#1f2937] dark:text-[#f1eeeb]">
                          {r.subject}
                        </strong>
                        <span className="mt-0.5 line-clamp-1 block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                          <Icon name="map-pin" className="mr-1 text-[#dc2626]" />
                          {r.location}
                        </span>
                      </td>
                      <td className={`${td} whitespace-nowrap text-[12.5px]`}>
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className={td}>
                        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <button
                          type="button"
                          onClick={() => openReportModal(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#fef2f2] px-3 py-1.5 text-[12.5px] font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-[#dc2626] dark:hover:text-white"
                        >
                          <span>Review</span>
                          <Icon name="arrow-right" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {!loading && offlineEmpty && (
            <div className="p-4">
              <OfflineState
                compact
                title="Emergency reports unavailable offline"
                text="Reconnect to review incoming emergency alerts."
                onRetry={loadData}
              />
            </div>
          )}
          {!loading && !offlineEmpty && !loadError && filteredReports.length === 0 && (
            <EmptyState
              icon="shield-check"
              title="No emergency reports found"
              text="No emergency reports match your active filters."
            />
          )}
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3.5 min-[768px]:hidden">
          {loading ? (
            <ParcelCardListSkeleton count={4} label="Loading emergency reports" />
          ) : offlineEmpty ? (
            <OfflineState
              compact
              title="Emergency reports unavailable offline"
              text="Reconnect to review incoming emergency alerts."
              onRetry={loadData}
            />
          ) : filteredReports.length === 0 ? (
            <EmptyState
              icon="shield-check"
              title="No emergency reports found"
              text="No emergency reports match your active filters."
            />
          ) : (
            pagedReports.map((r) => {
              const st = STATUS_META[r.status] || STATUS_META.NEW;
              const isNew = r.status === "NEW";
              return (
                <div
                  key={r.report_code}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-night-head ${
                    isNew
                      ? "border-[#fca5a5] dark:border-red-800/70"
                      : "border-[#edf0f4] dark:border-night-line"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#f4f6f8] pb-2.5 dark:border-night-line">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-extrabold text-[#dc2626]">
                        {r.report_code}
                      </span>
                      {isNew && (
                        <span className="rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                          Emergency
                        </span>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                      {st.short}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <h3 className="text-[15px] font-bold leading-snug text-[#1f2937] dark:text-[#f1eeeb]">
                      {r.subject}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6b7280] dark:text-[#9ca3af]">
                      <strong className="text-[#374151] dark:text-[#e5e7eb]">{r.reporter_name}</strong>
                      <span>·</span>
                      <span className="capitalize font-semibold">{r.reporter_role}</span>
                      <span>·</span>
                      <span className="rounded-md bg-[#fef2f2] px-2 py-0.5 text-[11px] font-bold text-[#b91c1c] dark:bg-red-500/15 dark:text-red-300">
                        {r.category}
                      </span>
                    </div>
                    <p className="mt-2 text-[12.5px] text-[#475569] dark:text-[#d1c9c2]">
                      <Icon name="map-pin" className="mr-1 text-[#dc2626]" />
                      {r.location}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] text-[#6b7280] dark:text-[#9ca3af]">
                      {r.description}
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-[#f4f6f8] pt-3 text-[12px] dark:border-night-line">
                    <span className="text-[#94a3b8]">{formatDateTime(r.created_at)}</span>
                    <button
                      type="button"
                      onClick={() => openReportModal(r)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#dc2626] px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-[#b91c1c]"
                    >
                      <span>Review Report</span>
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredReports.length} onPage={setPage} />
      </section>

      {/* Emergency Report Review Modal */}
      <Modal
        open={Boolean(selectedReport)}
        onClose={closeModal}
        z="z-[3500]"
        className="max-h-[92vh] w-full max-w-[660px] overflow-y-auto p-7 max-[600px]:p-5 dark:bg-night-panel"
      >
        {selectedReport && (
          <>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] hover:text-[#1e293b] dark:bg-night-line dark:text-[#d1c9c2]"
            >
              <Icon name="x" />
            </button>

            <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#dc2626] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-white">
                <Icon name="triangle-alert" className="h-3 w-3" />
                <span>Emergency</span>
              </span>
              <strong className="font-mono text-[14px] text-[#dc2626]">
                {selectedReport.report_code}
              </strong>
              <span
                className={`rounded-full px-3 py-0.5 text-[11.5px] font-bold ${
                  (STATUS_META[selectedReport.status] || STATUS_META.NEW).cls
                }`}
              >
                {(STATUS_META[selectedReport.status] || STATUS_META.NEW).label}
              </span>
            </div>

            <h3 className="pr-8 text-[19px] font-extrabold text-[#1f2937] dark:text-[#f1eeeb]">
              {selectedReport.subject}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-500 dark:text-[#b8b0a8]">
              <span>
                <strong className="text-[#1f2937] dark:text-[#f1eeeb]">
                  {selectedReport.reporter_name}
                </strong>{" "}
                (<span className="capitalize">{selectedReport.reporter_role}</span>
                {selectedReport.reporter_identifier ? ` · ${selectedReport.reporter_identifier}` : ""})
              </span>
              <span>·</span>
              <span className="font-semibold text-[#b91c1c] dark:text-red-300">
                {selectedReport.category}
              </span>
              <span>·</span>
              <span>{formatDateTime(selectedReport.created_at)}</span>
            </div>

            {/* Location & Description */}
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13.5px] text-[#7f1d1d] dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                <Icon name="map-pin" className="mt-0.5 shrink-0 text-[#dc2626]" />
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#dc2626] dark:text-red-300">
                    Reported Location / Address
                  </span>
                  <strong className="font-semibold">{selectedReport.location}</strong>
                </div>
              </div>

              <div className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 text-[14px] leading-relaxed whitespace-pre-wrap text-[#1e293b] dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]">
                {selectedReport.description}
              </div>

              {selectedReport.photo_data_url && (
                <div>
                  <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#b8b0a8]">
                    Photo Attachment
                  </span>
                  <img
                    src={selectedReport.photo_data_url}
                    alt={`Emergency photo for ${selectedReport.report_code}`}
                    className="max-h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-night-line dark:bg-night-head"
                  />
                </div>
              )}
            </div>

            {/* Coordinator Response Controls */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-night-line dark:bg-night-head/70">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[14px] font-bold text-[#1e293b] dark:text-white">
                  Coordinator Response
                </h4>
                {selectedReport.status === "NEW" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      applyUpdate({
                        statusOverride: "ACKNOWLEDGED",
                        noteOverride:
                          coordNote.trim() || "Emergency report received and acknowledged by Coordinator.",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#c84227] px-3.5 py-1.5 text-[12.5px] font-bold text-white shadow-xs transition hover:bg-[#c2410c] disabled:opacity-60"
                  >
                    <Icon name="check-check" className="h-3.5 w-3.5" />
                    <span>Acknowledge Receipt</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelCls} htmlFor="emr-status-select">
                    Update Status
                  </label>
                  <select
                    id="emr-status-select"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className={inputCls}
                  >
                    <option value="NEW">New / Unreviewed</option>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls} htmlFor="emr-coord-note">
                    Coordinator Notes / Action Taken
                  </label>
                  <textarea
                    id="emr-coord-note"
                    rows={2}
                    value={coordNote}
                    onChange={(e) => setCoordNote(e.target.value)}
                    className={textareaCls}
                    placeholder="Record actions taken, dispatch instructions, or resolution details..."
                  />
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => applyUpdate()}
                  className={btnPrimary}
                >
                  <Icon name={saving ? "loader-2" : "save"} spin={saving} />
                  <span>{saving ? "Saving…" : "Save Update"}</span>
                </button>
                {selectedReport.status !== "RESOLVED" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      applyUpdate({
                        statusOverride: "RESOLVED",
                        noteOverride:
                          coordNote.trim() || "Emergency incident resolved by Coordinator.",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-xs transition hover:bg-[#15803d] disabled:opacity-60"
                  >
                    <Icon name="circle-check" />
                    <span>Mark as Resolved</span>
                  </button>
                )}
              </div>
            </div>

            {/* Report History Timeline */}
            <div className="mt-5">
              <h4 className="mb-2.5 text-[14px] font-bold text-[#1e293b] dark:text-white">
                Report History
              </h4>
              {Array.isArray(selectedReport.history) && selectedReport.history.length > 0 ? (
                <ol className="space-y-2 border-l-2 border-slate-200 pl-3.5 dark:border-night-line">
                  {selectedReport.history.map((entry, idx) => (
                    <li
                      key={`${entry.at || idx}-${idx}`}
                      className="rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] dark:bg-night-head"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500 dark:text-[#9c948c]">
                        <strong className="text-[#1f2937] dark:text-[#f1eeeb]">
                          {entry.action || "Update"} · {entry.actor_name || "Coordinator"}
                        </strong>
                        <span>{formatDateTime(entry.at)}</span>
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-[#334155] dark:text-[#d1c9c2]">{entry.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-slate-500">No history entries yet.</p>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
