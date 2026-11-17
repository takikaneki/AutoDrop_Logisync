import { Link } from "react-router-dom";

export default function DashboardRightRail({
  tasksTitle = "Action Queue",
  seeAllTo = "#",
  tasks = [],
  emptyText = "You're all caught up! No pending actions.",
  summary = {
    label: "Completion Rate",
    value: "0%",
    sublabel: "Overall parcel progress",
    bars: [],
  },
}) {
  const maxBar = Math.max(1, ...(summary.bars || []).map((b) => Number(b.value) || 0));

  return (
    <aside className="flex flex-col gap-4">
      {/* Top Right: Tasks / Action Queue Card */}
      <div className="flex flex-1 flex-col rounded-2xl border border-[#e5e8ee] bg-white p-5 shadow-sm dark:border-night-line dark:bg-night-panel">
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
            {tasksTitle}
          </h2>
          <Link
            to={seeAllTo}
            className="text-[12.5px] font-semibold text-[#ee4d2d] hover:underline"
          >
            See all →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#e5e8ee] px-4 py-8 text-center dark:border-night-line">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <i className="fa-solid fa-check" />
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
                      <i className={`fa-solid ${item.icon || "fa-box"}`} />
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

      {/* Bottom Right: SPX Orange Mini-Bar Summary Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#ee4d2d] to-[#f97316] p-5 text-white shadow-[0_14px_30px_-12px_rgba(238,77,45,0.5)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-orange-100">
            {summary.label}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
            Live
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <strong className="text-[36px] font-extrabold leading-none tracking-tight">
            {summary.value}
          </strong>
          {summary.sublabel && (
            <span className="text-[12px] text-orange-100">{summary.sublabel}</span>
          )}
        </div>

        {summary.bars && summary.bars.length > 0 && (
          <div className="mt-5 flex h-[74px] items-end gap-2">
            {summary.bars.map((b) => {
              const pct = Math.max(16, Math.round(((Number(b.value) || 0) / maxBar) * 100));
              return (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                  <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-white/20">
                    <div
                      className="w-full rounded-lg bg-white/90 transition-all duration-500"
                      style={{ height: `${pct}%` }}
                      title={`${b.label}: ${b.value}`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-orange-100">{b.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

