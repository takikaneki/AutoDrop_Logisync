import Icon from "./Icon.jsx";
import { formatCachedTime } from "../utils/network.js";
import { btnPrimary, panel } from "./styles.js";

/**
 * Base Facebook / Instagram-inspired shimmer skeleton block.
 */
export function SkeletonBlock({ className = "", darkSurface = false, style }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`${darkSurface ? "logisync-skeleton-dark-surface" : "logisync-skeleton"} rounded-lg ${className}`}
    />
  );
}

/**
 * Accessible live region wrapper for skeleton sections.
 */
export function SkeletonRegion({ label = "Loading content", className = "", children }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * 3-card Bento KPI row skeleton (matches BentoKpiRow.jsx across Coordinator, Seller, Rider).
 */
export function BentoKpiSkeleton({ count = 3 }) {
  return (
    <SkeletonRegion label="Loading dashboard metrics" className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-1 max-[600px]:gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col justify-between rounded-2xl border border-[#e5e8ee] bg-white p-5 max-[600px]:p-4 shadow-xs dark:border-night-line dark:bg-night-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <SkeletonBlock className="h-9 w-20 rounded-xl max-[600px]:h-7 max-[600px]:w-16" />
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
          </div>
          <div className="mt-5 max-[600px]:mt-3.5 space-y-2">
            <SkeletonBlock className="h-5 w-24 rounded-full" />
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-40 max-w-full" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * StatCard grid skeleton (matches StatGrid + StatCard in portal.jsx).
 */
export function StatCardGridSkeleton({ cols = 4, count }) {
  const total = count || cols;
  return (
    <SkeletonRegion label="Loading summary statistics" className="stat-wrap mb-7 max-[600px]:mb-5">
      <div className={`stat-grid ${cols === 3 ? "stat-grid-3" : ""}`}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`${panel} flex h-full min-h-[120px] max-[820px]:min-h-[96px] max-[480px]:min-h-[82px] items-center gap-4 max-[820px]:gap-3 max-[480px]:gap-2.5 !px-6 !py-5 max-[1280px]:!px-4 max-[1280px]:!py-4 max-[480px]:!px-3 max-[480px]:!py-3`}
          >
            <SkeletonBlock className="h-[56px] w-[56px] max-[1280px]:h-[48px] max-[1280px]:w-[48px] max-[480px]:h-[38px] max-[480px]:w-[38px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-24 max-w-[80%]" />
              <SkeletonBlock className="h-7 w-14 rounded-lg max-[480px]:h-5" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * Right-rail Action Queue + Mini-Bar Summary Card skeleton (matches DashboardRightRail.jsx).
 */
export function DashboardRightRailSkeleton({ hideSummaryOnMobile = false }) {
  return (
    <SkeletonRegion label="Loading action queue and summary" className="flex flex-col gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#e5e8ee] bg-white shadow-sm dark:border-night-line dark:bg-night-panel">
        <div className="flex items-center justify-between gap-2 bg-[#0f172a] px-5 py-3.5">
          <SkeletonBlock darkSurface className="h-5 w-28" />
          <SkeletonBlock darkSurface className="h-3.5 w-14" />
        </div>
        <div className="space-y-3 p-5 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-32 max-w-[75%]" />
                  <SkeletonBlock className="h-3 w-44 max-w-[95%]" />
                </div>
              </div>
              <SkeletonBlock className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a] p-5 text-white ${
          hideSummaryOnMobile ? "hidden min-[821px]:block" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <SkeletonBlock darkSurface className="h-3.5 w-28" />
          <SkeletonBlock darkSurface className="h-5 w-12 rounded-full" />
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <SkeletonBlock darkSurface className="h-9 w-20 rounded-xl" />
          <SkeletonBlock darkSurface className="h-3.5 w-28" />
        </div>
        <div className="mt-5 flex h-[74px] items-end gap-2">
          {[42, 74, 58, 86, 64].map((h, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <SkeletonBlock darkSurface className="w-full rounded-lg" style={{ height: `${h}%` }} />
              <SkeletonBlock darkSurface className="h-2.5 w-8" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * Chart-shaped skeleton block for Bar or Donut analytics charts.
 */
export function ChartCardSkeleton({ variant = "bar", heightClass = "h-[380px] max-[820px]:h-[260px]", darkSurface = false }) {
  if (variant === "donut") {
    return (
      <SkeletonRegion
        label="Loading chart data"
        className={`flex ${heightClass} w-full flex-col items-center justify-center gap-6 px-4`}
      >
        <div className="relative flex h-[176px] w-[176px] max-[600px]:h-[144px] max-[600px]:w-[144px] items-center justify-center">
          <div
            aria-hidden="true"
            className="logisync-skeleton h-full w-full rounded-full"
          />
          <div
            aria-hidden="true"
            className="absolute h-[106px] w-[106px] max-[600px]:h-[84px] max-[600px]:w-[84px] rounded-full bg-white dark:bg-night-panel"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonBlock className="h-3 w-3 rounded-full" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }

  const bars = [44, 72, 58, 88, 65, 50, 78];
  return (
    <SkeletonRegion
      label="Loading analytics chart"
      className={`flex ${heightClass} w-full flex-col justify-end gap-4 px-2 pt-6 pb-2`}
    >
      <div className="flex flex-1 items-end gap-3 sm:gap-5 px-2">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <SkeletonBlock
              darkSurface={darkSurface}
              className="w-full max-w-[46px] rounded-t-lg rounded-b-sm"
              style={{ height: `${h}%` }}
            />
            <SkeletonBlock darkSurface={darkSurface} className="h-2.5 w-8 max-w-full" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-5 pt-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <SkeletonBlock darkSurface={darkSurface} className="h-2.5 w-2.5 rounded-full" />
            <SkeletonBlock darkSurface={darkSurface} className="h-3 w-14" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * Mobile/card list skeleton for parcel records, deliveries, complaints, users, and RTH items.
 */
export function ParcelCardListSkeleton({ count = 4, label = "Loading records" }) {
  return (
    <SkeletonRegion label={label} className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[#edf0f4] bg-white p-4 dark:border-night-line dark:bg-night-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-36 max-w-[70%]" />
              <SkeletonBlock className="h-3.5 w-28 max-w-[55%]" />
            </div>
            <SkeletonBlock className="h-6 w-20 shrink-0 rounded-full" />
          </div>
          <div className="mt-3 space-y-1.5 border-t border-[#f1f3f7] pt-3 dark:border-night-line">
            <SkeletonBlock className="h-3 w-4/5" />
            <div className="flex items-center justify-between gap-2 pt-1">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3.5 w-16" />
            </div>
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * Notifications list skeleton: small circular icon placeholder + two text lines (per spec).
 */
export function NotificationListSkeleton({ count = 5, compact = false, label = "Loading notifications" }) {
  return (
    <SkeletonRegion label={label} className="divide-y divide-[#edf0f4] dark:divide-night-line">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-start gap-3.5 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-3.5 w-44 max-w-[72%]" />
              <SkeletonBlock className="h-3 w-12 shrink-0" />
            </div>
            <SkeletonBlock className="h-3 w-5/6 max-w-[92%]" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * Activity / Audit feed list skeleton.
 */
export function ActivityListSkeleton({ count = 5, label = "Loading activity" }) {
  return (
    <SkeletonRegion label={label} className="divide-y divide-[#f1f1f1] dark:divide-night-line">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3.5 py-3.5">
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <SkeletonBlock className="h-3.5 w-60 max-w-[82%]" />
            <SkeletonBlock className="h-3 w-40 max-w-[60%]" />
          </div>
          <SkeletonBlock className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * Messaging / Chat skeleton: contact list + alternating chat bubbles (matches ChatView.jsx).
 */
export function ChatSkeleton({ directMode = false, surface = "bg-white border-slate-200 dark:bg-night-panel dark:border-night-line" }) {
  return (
    <SkeletonRegion
      label="Loading messages"
      className={`grid w-full min-w-0 max-w-full grid-cols-1 h-[calc(100vh-170px)] min-h-[520px] max-[820px]:h-[calc(100dvh-160px)] max-[820px]:min-h-[420px] overflow-hidden rounded-2xl border ${
        directMode ? "" : "md:grid-cols-[300px_1fr]"
      } ${surface}`}
    >
      {!directMode && (
        <aside className="flex min-h-0 flex-col border-slate-200 dark:border-slate-700 md:border-r">
          <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-700">
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
          <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <SkeletonBlock className="h-3.5 w-24" />
                    <SkeletonBlock className="h-2.5 w-10" />
                  </div>
                  <SkeletonBlock className="h-3 w-36 max-w-[90%]" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <section className={`${directMode ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
          </div>
          <SkeletonBlock className="h-8 w-16 rounded-lg" />
        </div>

        <div className="flex-1 space-y-4 p-4">
          <div className="flex flex-col items-start gap-1.5">
            <SkeletonBlock className="h-12 w-60 max-w-[78%] rounded-2xl rounded-tl-sm" />
            <SkeletonBlock className="h-2.5 w-16" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SkeletonBlock className="h-10 w-48 max-w-[70%] rounded-2xl rounded-tr-sm" />
            <SkeletonBlock className="h-2.5 w-14" />
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <SkeletonBlock className="h-16 w-72 max-w-[82%] rounded-2xl rounded-tl-sm" />
            <SkeletonBlock className="h-2.5 w-16" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SkeletonBlock className="h-12 w-56 max-w-[74%] rounded-2xl rounded-tr-sm" />
            <SkeletonBlock className="h-2.5 w-14" />
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <SkeletonBlock className="h-10 flex-1 rounded-lg" />
          <SkeletonBlock className="h-10 w-20 rounded-lg" />
        </div>
      </section>
    </SkeletonRegion>
  );
}

/**
 * Profile header skeleton: circular avatar + text lines + badge pill.
 */
export function ProfileHeaderSkeleton() {
  return (
    <SkeletonRegion label="Loading profile" className="relative z-10 flex flex-col items-center text-center py-2">
      <SkeletonBlock className="h-[88px] w-[88px] rounded-full" />
      <SkeletonBlock className="mt-4 h-6 w-40 rounded-lg" />
      <SkeletonBlock className="mt-2 h-4 w-28" />
      <SkeletonBlock className="mt-2.5 h-6 w-36 rounded-full" />
      <SkeletonBlock className="mt-4 h-9 w-32 rounded-full" />
    </SkeletonRegion>
  );
}

/**
 * Shipment / Parcel detail view skeleton (matches ParcelDetails.jsx & ScanUpload.jsx).
 */
export function ShipmentDetailSkeleton() {
  return (
    <SkeletonRegion label="Loading shipment details" className="mx-auto max-w-5xl space-y-5">
      <div className={`${panel} p-6 max-[600px]:p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f4] pb-4 dark:border-night-line">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-48" />
            <SkeletonBlock className="h-3.5 w-32" />
          </div>
          <SkeletonBlock className="h-8 w-28 rounded-full" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-4 w-44 max-w-[90%]" />
            </div>
          ))}
        </div>
      </div>

      <div className={`${panel} p-6 max-[600px]:p-4`}>
        <SkeletonBlock className="mb-4 h-5 w-40" />
        <SkeletonBlock className="h-[220px] w-full rounded-xl" />
      </div>
    </SkeletonRegion>
  );
}

/**
 * Form input-shaped skeleton blocks (for forms waiting on initial data).
 */
export function FormFieldsSkeleton({ rows = 4, label = "Loading form" }) {
  return (
    <SkeletonRegion label={label} className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonBlock className="h-3.5 w-28" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * Compact inline badge/banner shown when displaying cached data while offline.
 */
export function CachedDataNotice({ updatedAt, className = "mb-4" }) {
  const timeStr = formatCachedTime(updatedAt);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-[12.5px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <Icon name="wifi-off" className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
      <span>
        Showing cached data{timeStr ? ` (last updated ${timeStr})` : ""}. Information may be outdated until you&apos;re back online.
      </span>
    </div>
  );
}

/**
 * Offline state shown instead of an endless skeleton when offline and no cached data is available.
 */
export function OfflineState({
  title = "You're offline",
  text = "This content isn't available offline yet. Reconnect to the internet and it will refresh automatically.",
  onRetry,
  compact = false,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-night-line dark:bg-night-head/40 ${
        compact ? "py-8" : "min-h-[260px] py-12"
      }`}
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/90 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        <Icon name="wifi-off" className="h-6 w-6" />
      </span>
      <strong className="text-[15px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">{title}</strong>
      <p className="mt-1 max-w-sm text-[13px] text-[#64748b] dark:text-[#b8b0a8]">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`${btnPrimary} mt-4 !py-2 !px-4 !text-[13px]`}
        >
          <Icon name="refresh-cw" className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

/**
 * Error state with Retry button for non-offline request failures.
 */
export function LoadErrorState({
  title = "Unable to load data",
  message = "Something went wrong while loading this section.",
  onRetry,
  compact = false,
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-2xl border border-red-200/90 bg-red-50/70 px-5 text-center dark:border-red-900/40 dark:bg-red-950/20 ${
        compact ? "py-7" : "min-h-[220px] py-10"
      }`}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
        <Icon name="circle-alert" className="h-5 w-5" />
      </span>
      <strong className="text-[15px] font-bold text-[#991b1b] dark:text-red-200">{title}</strong>
      <p className="mt-1 max-w-md text-[13px] text-[#b91c1c] dark:text-red-300/90">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`${btnPrimary} mt-4 !py-2 !px-4 !text-[13px]`}
        >
          <Icon name="refresh-cw" className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
