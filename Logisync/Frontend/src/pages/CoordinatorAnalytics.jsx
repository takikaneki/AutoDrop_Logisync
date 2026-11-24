import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listParcels } from "../services/parcelService.js";
import { useNetworkResource } from "../hooks/useNetworkResource.js";
import {
  CachedDataNotice,
  ChartCardSkeleton,
  LoadErrorState,
  OfflineState,
  SkeletonBlock,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";

const VERIFIED_STATUSES = new Set(["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED"]);

export default function CoordinatorAnalytics() {
  const navigate = useNavigate();
  const {
    data: parcels,
    loading,
    error,
    offlineEmpty,
    isStaleOffline,
    cachedAt,
    reload,
  } = useNetworkResource(
    "coordinator-analytics-parcels",
    async () => {
      const list = await listParcels();
      return (Array.isArray(list) ? list : []).filter((p) => p && p.parcel_id !== "PX123456");
    },
    { initialData: [] }
  );

  useEffect(() => {
    document.title = "Analytics · LogiSync";
  }, []);

  const stats = useMemo(() => {
    const total = parcels.length;
    const verified = parcels.filter((p) => VERIFIED_STATUSES.has(p.status)).length;
    const notVerified = Math.max(0, total - verified);
    const verifiedPct = total ? Math.round((verified / total) * 100) : 0;
    const notVerifiedPct = total ? 100 - verifiedPct : 0;
    return { total, verified, notVerified, verifiedPct, notVerifiedPct };
  }, [parcels]);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.verifiedPct / 100) * circumference;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/profile");
    }
  };

  return (
    <div className="min-h-[calc(100dvh-124px)] w-full bg-[#f7f8fb] pb-8 dark:bg-night-bg">
      {/* Sticky Header: Back Arrow Left + Centered Title */}
      <div className="sticky top-14 z-30 flex h-[52px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md dark:border-night-line dark:bg-night-panel/95">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0f172a] transition active:scale-95 hover:bg-slate-100 dark:text-white dark:hover:bg-night-head"
        >
          <Icon name="arrow-left" className="text-[17px]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[16.5px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
          Analytics
        </h1>
        <span className="h-10 w-10 shrink-0" aria-hidden="true" />
      </div>

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {isStaleOffline && <CachedDataNotice updatedAt={cachedAt} className="mb-0" />}
        {offlineEmpty ? (
          <OfflineState title="Analytics unavailable offline" text="Reconnect to the internet to load live verification analytics." onRetry={reload} />
        ) : error && !parcels.length ? (
          <LoadErrorState title="Unable to load analytics" message={error} onRetry={reload} />
        ) : (
        <>
        {/* Verification Rate Donut Card */}
        <section
          aria-label="Verification Rate"
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-extrabold text-[#0f172a] dark:text-white">
              Verification Rate
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              {isStaleOffline ? "Cached" : "Live"}
            </span>
          </div>

          {loading ? (
            <ChartCardSkeleton variant="donut" heightClass="h-[200px]" />
          ) : (
          <div className="mt-5 flex flex-wrap items-center justify-around gap-5">
            {/* Circular Donut Progress */}
            <div className="relative flex h-[148px] w-[148px] shrink-0 items-center justify-center">
              <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  strokeWidth="16"
                  className="stroke-slate-200 dark:stroke-night-head"
                />
                <circle
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <strong className="text-[30px] font-extrabold leading-none tracking-tight text-[#0f172a] dark:text-white">
                  {`${stats.verifiedPct}%`}
                </strong>
                <span className="mt-1 text-[11px] font-semibold text-slate-400">
                  Verified
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="min-w-[120px] space-y-3.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-brand" />
                <div>
                  <span className="block text-[13px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                    Verified
                  </span>
                  <strong className="block text-[16px] font-extrabold text-[#0f172a] dark:text-white">
                    {`${stats.verifiedPct}%`}
                  </strong>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-slate-300 dark:bg-night-line" />
                <div>
                  <span className="block text-[13px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                    Not Verified
                  </span>
                  <strong className="block text-[16px] font-extrabold text-[#0f172a] dark:text-white">
                    {`${stats.notVerifiedPct}%`}
                  </strong>
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        {/* Verification Statistics Breakdown */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
          <div className="border-b border-slate-100 px-4 py-3.5 dark:border-night-line">
            <h2 className="text-[15px] font-extrabold text-[#0f172a] dark:text-white">
              Verification Statistics
            </h2>
          </div>

          <div className="divide-y divide-slate-100 px-4 dark:divide-night-line">
            <div className="flex items-center gap-3.5 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-night-head">
                <Icon name="package" className="text-[15px]" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                  Total Verifications
                </span>
                {loading ? (
                  <SkeletonBlock className="mt-1 h-5 w-16" />
                ) : (
                  <strong className="block text-[18px] font-extrabold text-[#0f172a] dark:text-white">
                    {stats.total.toLocaleString()}
                  </strong>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3.5 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Icon name="circle-check" className="text-[15px]" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                  Verified
                </span>
                {loading ? (
                  <SkeletonBlock className="mt-1 h-5 w-16" />
                ) : (
                  <strong className="block text-[18px] font-extrabold text-[#0f172a] dark:text-white">
                    {stats.verified.toLocaleString()}
                  </strong>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3.5 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-night-head dark:text-[#b8b0a8]">
                <Icon name="clock" className="text-[15px]" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                  Not Verified
                </span>
                {loading ? (
                  <SkeletonBlock className="mt-1 h-5 w-16" />
                ) : (
                  <strong className="block text-[18px] font-extrabold text-[#0f172a] dark:text-white">
                    {stats.notVerified.toLocaleString()}
                  </strong>
                )}
              </div>
            </div>
          </div>
        </section>
        </>
        )}
      </div>
    </div>
  );
}
