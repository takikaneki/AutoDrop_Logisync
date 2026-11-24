import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { EmptyState, TableSkeleton } from "../../components/ui.jsx";
import {
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
  ParcelCardListSkeleton,
} from "../../components/Skeletons.jsx";
import {
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
  panel,
  stickyThead,
  tableScrollCompact,
  td,
  textareaCls,
  th,
} from "../../components/styles.js";
import useBase from "../../hooks/useBase.js";
import { getUser } from "../../api.js";
import { createEmergencyReport, fetchEmergencyReports } from "../../services/emergencyService.js";
import { compressImage } from "../../utils/image.js";
import {
  isOnline,
  readViewCache,
  useNetworkStatus,
  useReconnectRefresh,
  writeViewCache,
} from "../../utils/network.js";
import { toast } from "../../store/toast.js";
import Icon from "../../components/Icon.jsx";

const ROLE_CONFIG = {
  rider: {
    roleLabel: "Rider",
    subtitle:
      "Immediately alert hub coordinators about road accidents, medical emergencies, safety threats, or urgent delivery incidents.",
    locationPlaceholder: "e.g., Aguinaldo Hwy near Trece Martires Public Market, Cavite",
    subjectPlaceholder: "e.g., Motorcycle accident along Aguinaldo Hwy",
    categories: [
      "Road Accident / Collision",
      "Medical Emergency",
      "Vehicle Breakdown",
      "Safety Threat / Harassment",
      "Severe Weather / Flood / Road Blocked",
      "Lost / Stolen / Damaged Parcel Emergency",
      "Other Emergency",
    ],
  },
  seller: {
    roleLabel: "Seller",
    subtitle:
      "Immediately alert hub coordinators about safety incidents, facility hazards, security breaches, or critical operational emergencies.",
    locationPlaceholder: "e.g., Blk 4 Lot 12 Brgy. San Agustin, Warehouse / Pickup Point",
    subjectPlaceholder: "e.g., Flooding at pickup warehouse entrance",
    categories: [
      "Safety Incident / Injury",
      "Fire / Facility Hazard",
      "Missing / Stolen Parcel Batch",
      "Security / Unauthorized Access",
      "Severe Weather / Pickup Disruption",
      "Critical System / Operations Outage",
      "Other Emergency",
    ],
  },
};

const STATUS_META = {
  NEW: {
    label: "New / Unreviewed",
    cls: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    cls: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/20 dark:text-[#60a5fa]",
  },
  RESOLVED: {
    label: "Resolved",
    cls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
  },
};

function makeSubmissionId(userId) {
  return `emr_${userId || "u"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

const EMPTY_FORM = {
  category: "",
  subject: "",
  location: "",
  description: "",
  photo_data_url: "",
};

export default function ReportEmergency() {
  const role = useBase().slice(1) === "seller" ? "seller" : "rider";
  const cfg = ROLE_CONFIG[role];
  const user = getUser();
  const cacheKey = `my-emergency-reports-${role}-${user?.user_id || "u"}`;
  const initialCache = useMemo(() => readViewCache(cacheKey), [cacheKey]);
  const { online } = useNetworkStatus();

  const [reports, setReports] = useState(() =>
    Array.isArray(initialCache?.data) ? initialCache.data : []
  );
  const [hasData, setHasData] = useState(() => Boolean(initialCache?.data));
  const [cachedAt, setCachedAt] = useState(() => initialCache?.updatedAt || null);
  const [loadingList, setLoadingList] = useState(() => isOnline() && !initialCache?.data);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [photoName, setPhotoName] = useState("");
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [openCode, setOpenCode] = useState(null);

  const fileInputRef = useRef(null);
  const submissionIdRef = useRef(makeSubmissionId(user?.user_id));

  const loadReports = useCallback(async () => {
    if (!isOnline()) {
      setLoadingList(false);
      return;
    }
    setLoadError("");
    try {
      const { reports: list } = await fetchEmergencyReports();
      setReports(list);
      setHasData(true);
      setCachedAt(Date.now());
      writeViewCache(cacheKey, list);
    } catch (err) {
      if (isOnline()) {
        setLoadError(err?.message || "Unable to load your emergency reports.");
      }
    } finally {
      setLoadingList(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useReconnectRefresh(loadReports);

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError("");
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Please attach a valid image file (JPG, PNG, or WebP).");
      return;
    }
    setCompressingPhoto(true);
    setError("");
    try {
      const compressed = await compressImage(file, 960, 0.72);
      setForm((prev) => ({ ...prev, photo_data_url: compressed }));
      setPhotoName(file.name);
    } catch (err) {
      setError(err?.message || "Could not process the selected photo.");
    } finally {
      setCompressingPhoto(false);
    }
  };

  const clearPhoto = () => {
    setForm((prev) => ({ ...prev, photo_data_url: "" }));
    setPhotoName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!online) {
      setError("You are currently offline. Please reconnect to submit an emergency report, or call emergency services directly.");
      return;
    }
    if (!form.category) return setError("Please select an emergency category.");
    if (!form.subject.trim()) return setError("Please enter a short subject or title.");
    if (!form.location.trim()) return setError("Please enter the location or relevant address.");
    if (!form.description.trim()) return setError("Please describe the emergency.");

    setError("");
    setSubmitting(true);
    try {
      const res = await createEmergencyReport({
        category: form.category,
        subject: form.subject.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        photo_data_url: form.photo_data_url || null,
        client_submission_id: submissionIdRef.current,
      });

      const saved = res?.report;
      if (saved) {
        setConfirmation(saved);
        setReports((prev) => {
          const exists = prev.some((r) => r.report_code === saved.report_code);
          const next = exists
            ? prev.map((r) => (r.report_code === saved.report_code ? saved : r))
            : [saved, ...prev];
          writeViewCache(cacheKey, next);
          return next;
        });
        setHasData(true);
        setOpenCode(saved.report_code);
      }

      setForm(EMPTY_FORM);
      clearPhoto();
      submissionIdRef.current = makeSubmissionId(user?.user_id);
      toast(`Emergency report ${saved?.report_code || ""} submitted. Coordinators have been alerted.`);
    } catch (err) {
      setError(err?.message || "Failed to submit emergency report. Please try again.");
      toast(err?.message || "Failed to submit emergency report.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedReport = useMemo(
    () => (openCode ? reports.find((r) => r.report_code === openCode) : null),
    [openCode, reports]
  );

  return (
    <>
      <Topbar title="Report Emergency" subtitle={cfg.subtitle} />

      {/* High-Priority Emergency Banner */}
      <div className="mb-5 flex items-start gap-3.5 rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 text-[#991b1b] shadow-xs dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dc2626] text-white shadow-xs">
          <Icon name="triangle-alert" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[14px] font-extrabold tracking-tight text-[#991b1b] dark:text-red-100">
              High-Priority Emergency Reporting
            </strong>
            <span className="rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              Immediate Alert
            </span>
          </div>
          <p className="mt-1">
            Submitting this form sends an immediate high-priority alert to active hub Coordinators. For life-threatening emergencies, please contact local emergency services (911) first.
          </p>
        </div>
      </div>

      {/* Confirmation Banner after submission */}
      {confirmation && (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-[#166534] shadow-xs dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
                <Icon name="check" className="h-4 w-4" />
              </span>
              <div className="text-[13px] leading-relaxed">
                <strong className="block text-[14.5px] font-extrabold">
                  Emergency Report Submitted — {confirmation.report_code}
                </strong>
                <p className="mt-0.5">
                  Your report (<strong>{confirmation.category}</strong>: {confirmation.subject}) was recorded at{" "}
                  {formatDateTime(confirmation.created_at)} and Coordinators have been alerted immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              aria-label="Dismiss confirmation"
              className="rounded-lg p-1 text-[#166534]/70 hover:bg-black/5 dark:text-emerald-200/70"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Submission Form */}
      <section className={`${panel} mb-6 p-[26px] max-[600px]:p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
            <Icon name="triangle-alert" className="text-[#dc2626]" />
            <span>Submit Emergency Report</span>
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11.5px] font-semibold text-slate-600 dark:bg-night-head dark:text-[#d1c9c2]">
            Reporting as: <strong>{user?.name || cfg.roleLabel}</strong> ({cfg.roleLabel})
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
            <div>
              <label className={labelCls} htmlFor="emr-category">
                Emergency Category <span className="text-[#dc2626]">*</span>
              </label>
              <select
                id="emr-category"
                value={form.category}
                onChange={setField("category")}
                className={inputCls}
                required
              >
                <option value="">Select emergency category…</option>
                {cfg.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="emr-subject">
                Subject / Short Title <span className="text-[#dc2626]">*</span>
              </label>
              <input
                id="emr-subject"
                type="text"
                value={form.subject}
                onChange={setField("subject")}
                maxLength={200}
                placeholder={cfg.subjectPlaceholder}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="emr-location">
              Location or Relevant Address <span className="text-[#dc2626]">*</span>
            </label>
            <div className="relative">
              <Icon
                name="map-pin"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#dc2626]"
              />
              <input
                id="emr-location"
                type="text"
                value={form.location}
                onChange={setField("location")}
                maxLength={300}
                placeholder={cfg.locationPlaceholder}
                className={`${inputCls} pl-9`}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="emr-description">
              Description of the Emergency <span className="text-[#dc2626]">*</span>
            </label>
            <textarea
              id="emr-description"
              rows={4}
              value={form.description}
              onChange={setField("description")}
              maxLength={3000}
              placeholder="Provide clear details of what happened, immediate risks, affected parcels (if any), and assistance needed."
              className={textareaCls}
              required
            />
          </div>

          {/* Optional Photo Attachment */}
          <div>
            <label className={labelCls} htmlFor="emr-photo">
              Photo Attachment <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                id="emr-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressingPhoto || submitting}
                className={btnGhost}
              >
                <Icon name="camera" />
                <span>
                  {compressingPhoto
                    ? "Processing photo…"
                    : form.photo_data_url
                      ? "Change Photo"
                      : "Attach Photo"}
                </span>
              </button>
              {photoName && (
                <span className="max-w-[240px] truncate text-[12.5px] font-medium text-slate-600 dark:text-[#d1c9c2]">
                  {photoName}
                </span>
              )}
              {form.photo_data_url && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="text-[12.5px] font-semibold text-[#dc2626] hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>
            {form.photo_data_url && (
              <div className="mt-3 inline-block overflow-hidden rounded-xl border border-[#e5e8ee] bg-slate-50 p-1.5 dark:border-night-line dark:bg-night-head">
                <img
                  src={form.photo_data_url}
                  alt="Emergency attachment preview"
                  className="max-h-44 rounded-lg object-contain"
                />
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-1.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[13px] font-semibold text-[#dc2626] dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              <Icon name="circle-alert" className="shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || compressingPhoto}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#b91c1c] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name={submitting ? "loader-2" : "send"} spin={submitting} />
              <span>{submitting ? "Sending Emergency Alert…" : "Submit Emergency Report"}</span>
            </button>
            <span className="text-[12px] text-slate-500 dark:text-[#9c948c]">
              Coordinators are notified immediately upon submission.
            </span>
          </div>
        </form>
      </section>

      {/* My Submitted Emergency Reports */}
      <section className={`${panel} p-[26px] max-[600px]:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
            <Icon name="history" className="text-brand" />
            <span>My Emergency Reports</span>
          </h2>
          <button
            type="button"
            onClick={loadReports}
            disabled={!online || loadingList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-night-line dark:text-[#d1c9c2]"
          >
            <Icon name="refresh-cw" className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {!online && hasData && <CachedDataNotice updatedAt={cachedAt} />}
        {loadError && online && (
          <div className="mb-4">
            <LoadErrorState compact title="Unable to load reports" message={loadError} onRetry={loadReports} />
          </div>
        )}

        {loadingList && online && reports.length === 0 ? (
          <>
            <div className={`hidden min-[720px]:block ${tableScrollCompact}`}>
              <table className="w-full min-w-[680px] border-collapse">
                <thead className={stickyThead}>
                  <tr>
                    {["Report ID", "Category", "Subject", "Submitted", "Status", ""].map((h, i) => (
                      <th key={i} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <TableSkeleton rows={4} cols={6} />
              </table>
            </div>
            <div className="min-[720px]:hidden">
              <ParcelCardListSkeleton count={3} label="Loading your emergency reports" />
            </div>
          </>
        ) : !online && !hasData ? (
          <OfflineState
            compact
            title="Emergency reports unavailable offline"
            text="Reconnect to view your submitted emergency reports and coordinator updates."
            onRetry={loadReports}
          />
        ) : reports.length === 0 ? (
          <EmptyState
            icon="shield-check"
            title="No emergency reports submitted"
            text="Any emergency reports you submit will appear here with real-time coordinator status updates."
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className={`hidden min-[720px]:block ${tableScrollCompact}`}>
              <table className="w-full min-w-[700px] border-collapse">
                <thead className={stickyThead}>
                  <tr>
                    {["Report ID", "Category", "Subject", "Submitted", "Status", ""].map((h, i) => (
                      <th key={i} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const st = STATUS_META[r.status] || STATUS_META.NEW;
                    const expanded = openCode === r.report_code;
                    return (
                      <tr
                        key={r.report_code}
                        className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                      >
                        <td className={`${td} font-extrabold text-[#dc2626] whitespace-nowrap`}>
                          {r.report_code}
                        </td>
                        <td className={td}>
                          <span className="inline-block rounded-md bg-[#fef2f2] px-2 py-0.5 text-[11.5px] font-semibold text-[#b91c1c] dark:bg-red-500/15 dark:text-red-300">
                            {r.category}
                          </span>
                        </td>
                        <td className={`${td} max-w-[260px]`}>
                          <span className="line-clamp-2 font-semibold text-[#1f2937] dark:text-[#f1eeeb]">
                            {r.subject}
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
                        <td className={`${td} text-right`}>
                          <button
                            type="button"
                            onClick={() => setOpenCode(expanded ? null : r.report_code)}
                            className="text-[13px] font-bold text-brand hover:underline"
                          >
                            {expanded ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 min-[720px]:hidden">
              {reports.map((r) => {
                const st = STATUS_META[r.status] || STATUS_META.NEW;
                const expanded = openCode === r.report_code;
                return (
                  <div
                    key={r.report_code}
                    className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-3.5 dark:border-night-line dark:bg-night-head"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[12px] font-extrabold text-[#dc2626]">{r.report_code}</span>
                        <strong className="block truncate text-[14px] text-[#27364f] dark:text-[#f1eeeb]">
                          {r.subject}
                        </strong>
                        <span className="text-[11.5px] text-[#888]">
                          {r.category} · {formatDateTime(r.created_at)}
                        </span>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-[#f1f3f7] pt-2 text-[12px] dark:border-night-line">
                      <span className="truncate text-[#64748b] dark:text-[#b8b0a8]">
                        <Icon name="map-pin" className="mr-1 text-[#dc2626]" />
                        {r.location}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenCode(expanded ? null : r.report_code)}
                        className="ml-2 shrink-0 font-bold text-brand hover:underline"
                      >
                        {expanded ? "Hide" : "View updates →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Expanded Report Details & Coordinator History */}
        {selectedReport && (
          <div className="mt-5 rounded-2xl border border-[#fecaca] bg-[#fffaf9] p-5 text-[13.5px] dark:border-red-900/40 dark:bg-night-head">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#fee2e2] pb-3 dark:border-night-line">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-extrabold text-[#dc2626]">
                    {selectedReport.report_code}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      (STATUS_META[selectedReport.status] || STATUS_META.NEW).cls
                    }`}
                  >
                    {(STATUS_META[selectedReport.status] || STATUS_META.NEW).label}
                  </span>
                  <span className="text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                    {selectedReport.category}
                  </span>
                </div>
                <h3 className="mt-1 text-[16px] font-bold text-[#1e293b] dark:text-white">
                  {selectedReport.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenCode(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:text-white"
                aria-label="Close details"
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2 text-[13px] text-[#334155] dark:text-[#e2e8f0]">
                <Icon name="map-pin" className="mt-0.5 shrink-0 text-[#dc2626]" />
                <span>
                  <strong>Location:</strong> {selectedReport.location}
                </span>
              </div>

              <p className="whitespace-pre-line rounded-xl border border-slate-200/70 bg-white p-3.5 text-[#334155] dark:border-night-line dark:bg-night-panel dark:text-[#e2e8f0]">
                {selectedReport.description}
              </p>

              {selectedReport.photo_data_url && (
                <div>
                  <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500">
                    Attached Photo
                  </span>
                  <img
                    src={selectedReport.photo_data_url}
                    alt={`Attachment for ${selectedReport.report_code}`}
                    className="max-h-64 rounded-xl border border-slate-200 object-contain dark:border-night-line"
                  />
                </div>
              )}

              <div className="pt-1">
                <h4 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#b8b0a8]">
                  Status &amp; Coordinator Updates
                </h4>
                {Array.isArray(selectedReport.history) && selectedReport.history.length > 0 ? (
                  <ol className="space-y-2 border-l-2 border-brand/30 pl-3.5">
                    {selectedReport.history.map((entry, idx) => (
                      <li
                        key={`${entry.at || idx}-${idx}`}
                        className="rounded-xl bg-white px-3.5 py-2.5 shadow-2xs dark:bg-night-panel"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500 dark:text-[#9c948c]">
                          <strong className="text-[#1e293b] dark:text-[#f1eeeb]">
                            {entry.action || "Update"} · {entry.actor_name || entry.actor_role || "System"}
                          </strong>
                          <span>{formatDateTime(entry.at)}</span>
                        </div>
                        {entry.note && (
                          <p className="mt-1 text-[13px] text-[#475569] dark:text-[#d1c9c2]">
                            {entry.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] text-slate-500">Awaiting coordinator review.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
