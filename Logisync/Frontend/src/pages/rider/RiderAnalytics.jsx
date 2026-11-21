import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { riderCounts } from "../../utils/stats.js";
import {
  syncRiderDeliveriesWithServer,
  useAssignedParcels,
  useMyDeliveries,
} from "../../store/riderDeliveries.js";

export default function RiderAnalytics() {
  const navigate = useNavigate();
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();

  useEffect(() => {
    document.title = "Analytics · LogiSync";
    syncRiderDeliveriesWithServer();
  }, []);

  const stats = riderCounts(assigned, mine);
  const deliveryRate = stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}%` : "0%";
  const rescheduledCount = mine.filter(
    (d) => d.rescheduled && !d.returnToHub && d.stage !== "delivered"
  ).length;

  const bars = [
    { label: "Assign", value: assigned.length },
    { label: "Route", value: stats.toDeliver },
    { label: "Done", value: stats.delivered },
    { label: "Fail", value: stats.failed },
  ];
  const maxBar = Math.max(1, ...bars.map((b) => Number(b.value) || 0));

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/rider/profile");
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
          <i className="fa-solid fa-arrow-left text-[17px]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[16.5px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
          Analytics
        </h1>
        <span className="h-10 w-10 shrink-0" aria-hidden="true" />
      </div>

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {/* Rider Delivery Rate Card (same live analytics card from desktop view) */}
        <section
          aria-label="Delivery Rate"
          className="relative overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a] p-5 text-white shadow-[0_14px_30px_-14px_rgba(15,23,42,0.55)]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(238,77,45,0.42),transparent_65%)]"
            aria-hidden="true"
          />

          <div className="relative flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-slate-300">
              Delivery Rate
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
              Live
            </span>
          </div>

          <div className="relative mt-2.5 flex flex-wrap items-baseline gap-2.5">
            <strong className="text-[40px] font-extrabold leading-none tracking-tight">
              {deliveryRate}
            </strong>
            <span className="text-[13px] text-slate-400">
              {stats.delivered} of {stats.total} completed
            </span>
          </div>

          {/* 4-Bar Visual Breakdown matching Desktop Right Rail */}
          <div className="relative mt-6 flex h-[110px] items-end gap-3">
            {bars.map((b) => {
              const pct = Math.max(16, Math.round(((Number(b.value) || 0) / maxBar) * 100));
              return (
                <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] font-bold text-slate-200">{b.value}</span>
                  <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-white/10">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-[#ee4d2d] to-[#fb923c] transition-all duration-500"
                      style={{ height: `${pct}%` }}
                      title={`${b.label}: ${b.value}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300">{b.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Detailed Delivery Breakdown */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-night-line">
            <h2 className="text-[14px] font-extrabold text-[#0f172a] dark:text-white">
              Delivery Summary
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-4 text-[14px] dark:divide-night-line">
            {[
              { label: "Total Parcels", value: stats.total, icon: "fa-box", tone: "text-[#0f172a] dark:text-white", to: "/rider/deliveries" },
              { label: "To Be Delivered", value: stats.toDeliver, icon: "fa-truck-fast", tone: "text-brand", to: "/rider/deliveries" },
              { label: "Delivered", value: stats.delivered, icon: "fa-circle-check", tone: "text-emerald-600 dark:text-emerald-400", to: "/rider/deliveries?tab=delivered" },
              { label: "Rescheduled", value: rescheduledCount, icon: "fa-calendar-day", tone: "text-amber-600 dark:text-amber-400", to: "/rider/deliveries" },
              { label: "Failed / Return to Hub", value: stats.failed, icon: "fa-triangle-exclamation", tone: "text-red-600 dark:text-red-400", to: "/rider/deliveries?tab=failed" },
            ].map((row) => (
              <Link
                key={row.label}
                to={row.to}
                className="flex items-center justify-between gap-3 py-3.5 transition hover:opacity-80"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-night-head dark:text-[#d1c9c2]">
                    <i className={`fa-solid ${row.icon} text-[13px]`} />
                  </span>
                  <span className="truncate font-semibold text-slate-700 dark:text-[#e2ddd8]">
                    {row.label}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <strong className={`text-[15px] font-extrabold ${row.tone}`}>{row.value}</strong>
                  <i className="fa-solid fa-chevron-right text-[11px] text-slate-400" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
