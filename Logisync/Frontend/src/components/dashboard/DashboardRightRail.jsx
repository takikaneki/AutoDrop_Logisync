import { Link } from "react-router-dom";
import Icon from "../Icon.jsx";
import { DashboardRightRailSkeleton } from "../Skeletons.jsx";

export default function DashboardRightRail({
  variant = "slate",
  tasksTitle = "Action Queue",
  seeAllTo = "#",
  tasks = [],
  loading = false,
  emptyText = "You're all caught up! No pending actions.",
  hideSummaryOnMobile = false,
  summary = {
    label: "Completion Rate",
    value: "0%",
    sublabel: "Overall parcel progress",
    bars: [],
  },
}) {
  if (loading) {
    return <DashboardRightRailSkeleton hideSummaryOnMobile={hideSummaryOnMobile} />;
  }
  const maxBar = Math.max(1, ...(summary.bars || []).map((b) => Number(b.value) || 0));
  const isSlate = variant === "slate";

  return (
    <aside className="flex flex-col gap-4">
      {/* Top Right: Tasks / Action Queue Card */}
      <div className={`flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#e5e8ee] bg-white shadow-sm dark:border-night-line dark:bg-night-panel ${isSlate ? "" : "p-5"}`}>
        <div className={isSlate ? "flex items-center justify-between gap-2 bg-[#0f172a] px-5 py-3.5" : "mb-3.5 flex items-center justify-between gap-2"}>
          <h2 className={`text-[17px] font-extrabold ${isSlate ? "text-white" : "text-[#1e293b] dark:text-[#f1eeeb]"}`}>
            {tasksTitle}
          </h2>
          <Link
            to={seeAllTo}
            className={`text-[12.5px] font-semibold hover:underline ${isSlate ? "text-[#fb923c]" : "text-[#ee4d2d]"}`}
          >
            See all →
          </Link>
        </div>

        <div className={isSlate ? "flex flex-1 flex-col p-5 pt-3.5" : "flex flex-1 flex-col"}>

        {tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#e5e8ee] px-4 py-8 text-center dark:border-night-line">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Icon name="check" />
            </span>
            <p className="text-[13px] text-[#64748b] dark:text-[#b8b0a8]">{emptyText}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#edf0f4] dark:divide-night-line">
            {tasks.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to || seeAllTo}
                  className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-[#fffaf7] -mx-2 px-2 rounded-xl dark:hover:bg-night-head"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] ${
                        item.tone === "danger"
                          ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                          : item.tone === "warn"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                          : "bg-[#fff0e5] text-[#ee4d2d] dark:bg-brand/20 dark:text-[#ffb98a]"
                      }`}
                    >
                      <Icon name={item.icon || "package"} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[13.5px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                        {item.title}
                      </strong>
                      <span className="block truncate text-[11.5px] text-[#64748b] dark:text-[#b8b0a8]">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                  {item.meta && (
                    <span className="shrink-0 text-right text-[11px] font-semibold text-[#94a3b8] dark:text-[#a89f96]">
                      {item.meta}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {/* Bottom Right: Mini-Bar Summary Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 text-white ${
          hideSummaryOnMobile ? "hidden min-[821px]:block " : ""
        }${
          isSlate
            ? "bg-[#0f172a] border border-[#1e293b] shadow-[0_14px_30px_-14px_rgba(15,23,42,0.55)]"
            : "bg-[#ee4d2d] shadow-[0_14px_30px_-12px_rgba(238,77,45,0.5)]"
        }`}
      >
        <div className="relative flex items-center justify-between gap-2">
          <span className={`text-[12.5px] font-bold uppercase tracking-wider ${isSlate ? "text-slate-300" : "text-orange-100"}`}>
            {summary.label}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isSlate ? "bg-white/10 text-emerald-400" : "bg-white/20 text-white"}`}>
            Live
          </span>
        </div>

        <div className="relative mt-2 flex items-baseline gap-2">
          <strong className="text-[36px] font-extrabold leading-none tracking-tight">
            {summary.value}
          </strong>
          {summary.sublabel && (
            <span className={`text-[12px] ${isSlate ? "text-slate-400" : "text-orange-100"}`}>{summary.sublabel}</span>
          )}
        </div>

        {summary.bars && summary.bars.length > 0 && (
          <div className="relative mt-5 flex h-[74px] items-end gap-2">
            {summary.bars.map((b) => {
              const pct = Math.max(16, Math.round(((Number(b.value) || 0) / maxBar) * 100));
              return (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                  <div className={`relative flex w-full flex-1 items-end overflow-hidden rounded-lg ${isSlate ? "bg-white/10" : "bg-white/20"}`}>
                    <div
                      className={`w-full rounded-lg transition-all duration-500 ${isSlate ? "bg-gradient-to-t from-[#ee4d2d] to-[#fb923c]" : "bg-white/90"}`}
                      style={{ height: `${pct}%` }}
                      title={`${b.label}: ${b.value}`}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold ${isSlate ? "text-slate-300" : "text-orange-100"}`}>{b.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

