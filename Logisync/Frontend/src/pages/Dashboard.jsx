import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Topbar from "../components/Topbar.jsx";
import { StatusBadge } from "../components/ui.jsx";
import { StatCard, StatGrid } from "../components/portal.jsx";
import DashboardShortcuts from "../components/dashboard/DashboardShortcuts.jsx";
import RecentActivity from "../components/audit/RecentActivity.jsx";
import { inputCls } from "../components/styles.js";
import { listParcels } from "../services/parcelService.js";
import { parcelStats } from "../utils/stats.js";
import { buildParcelSeries, statusTotals } from "../utils/analytics.js";
import { getParcelStatus } from "../utils/parcelStatus.js";
import { formatDate } from "../utils/format.js";

const panel = "bg-white border border-[#e5e8ee] rounded-2xl p-[30px] min-w-0 dark:bg-night-panel dark:border-night-line max-[600px]:p-4";
const COLORS = { Delivered: "#16a34a", Pending: "#f97316", Flagged: "#d94747" };
const PERIODS = [["day", "By Day"], ["week", "By Week"], ["month", "By Month"]];
const TITLES = { day: "Parcels per day (Mon–Sun)", week: "Parcels per week", month: "Parcels per month" };
const tick = { fontSize: 13, fill: "#8a8a8a" };

export default function Dashboard() {
  const [real, setReal] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 820px)").matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 820px)");
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    listParcels()
      .then((list) => setReal((Array.isArray(list) ? list : []).filter((p) => p && p.parcel_id !== "PX123456")))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);
  const stats = parcelStats(real);
  const v = (n) => (loadingStats ? "…" : n);
  const countStatus = (s) => real.filter((p) => p.status === s).length;

  const [period, setPeriod] = useState("day");
  const [weekOffset, setWeekOffset] = useState(0);
  const changePeriod = (p) => { setPeriod(p); setWeekOffset(0); };

  const series = useMemo(() => buildParcelSeries(real, period, weekOffset), [real, period, weekOffset]);
  const pie = useMemo(() => statusTotals(real), [real]);

  const recentRows = useMemo(() => {
    return real.slice(0, 6).map((p) => ({
      id: p.transaction_number || p.parcel_id,
      parcelId: p.parcel_id,
      seller: p.seller_name || p.seller || "Seller",
      status: p.returnToHub ? "Return to Hub" : p.rescheduled ? "Rescheduled" : getParcelStatus(p),
      verification:
        p.verification_status ||
        (p.status === "REJECTED" ? "Flagged" : ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED", "RETURN_TO_HUB"].includes(p.status) ? "Verified" : "Pending"),
      date: formatDate(p.created_at),
    }));
  }, [real]);

  return (
    <>
      <Topbar title="Dashboard" />

      {/* 1. SUMMARY CARDS */}
      <DashboardShortcuts role="coordinator" />
      <StatGrid>
        <StatCard label="Total Parcels" value={v(stats.total)} icon="fa-box" tone="orange" to="/parcels" />
        <StatCard label="Needs Verification" value={v(stats.flagged)} icon="fa-hourglass-half" tone="blue" to="/verification?status=VIDEO_SUBMITTED" />
        <StatCard label="Verified Parcels" value={v(stats.pending)} icon="fa-circle-check" tone="green" to="/verification?status=VERIFIED" />
        <StatCard label="Failed / Return to Hub" value={v(real.filter((p) => p.returnToHub || p.status === "RETURN_TO_HUB" || p.status === "DELIVERY_FAILED").length || stats.delivered)} icon="fa-warehouse" tone="red" to="/parcels?status=Failed%20Delivery" />
      </StatGrid>

      {/* 2. VERIFICATION + RECENT PARCELS */}
      <section className="mb-7 max-[600px]:mb-4 grid grid-cols-[1fr_2fr] items-stretch gap-6 max-[600px]:gap-4 max-[1200px]:grid-cols-1">
        <div className={`${panel} flex flex-col`}>
          <div className="mb-5 max-[600px]:mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-[19px] max-[600px]:text-[17px] font-bold"><i className="fa-regular fa-bell mr-2 text-orange-500" />Verification Needed</h2>
            <Link to="/verification" className="whitespace-nowrap text-sm text-orange-500">View All →</Link>
          </div>
          <div className="mb-4 max-[600px]:mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#fff4ed] p-5 max-[600px]:p-4 dark:bg-[#3b3531]">
            <div className="flex h-[56px] w-[56px] max-[600px]:h-[44px] max-[600px]:w-[44px] items-center justify-center rounded-full bg-[#fff0e5] text-[24px] max-[600px]:text-[19px] text-orange-500"><i className="fa-solid fa-box" /></div>
            <div>
              <h2 className="text-[32px] max-[600px]:text-[24px] font-bold leading-tight text-orange-500">
                {v(countStatus("VIDEO_SUBMITTED"))} <small className="text-base max-[600px]:text-sm font-normal text-[#26344d] dark:text-[#f1eeeb]">parcels</small>
              </h2>
              <p className="mt-1 max-[600px]:mt-0.5 text-sm max-[600px]:text-xs text-[#64748b]">need verification.</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            {[
              ["fa-triangle-exclamation", "Flagged / Return to Hub", stats.flagged],
              ["fa-circle-play", "Awaiting Seller Video", countStatus("WAITING_FOR_VIDEO")],
            ].map(([icon, label, n]) => (
              <div key={label} className="flex flex-1 items-center justify-between border-b border-[#edf0f4] py-4 max-[600px]:py-3 text-[16px] max-[600px]:text-[14px] text-[#52627a] last:border-b-0 dark:border-night-line dark:text-[#d1c9c2]">
                <span><i className={`fa-solid ${icon} w-6`} /> {label}</span>
                <strong className="text-lg max-[600px]:text-base text-orange-500">{v(n)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT PARCELS */}
        <div className={`${panel} min-h-[420px] max-[820px]:min-h-0 overflow-hidden`}>
          <div className="mb-5 max-[600px]:mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-[19px] max-[600px]:text-[17px] font-bold"><i className="fa-solid fa-box mr-2 text-orange-500" />Recent Parcels</h2>
            <Link to="/parcels" className="whitespace-nowrap text-sm text-orange-500 hover:underline">View All →</Link>
          </div>
          <div className="hidden min-[701px]:block overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f9] text-left text-sm text-[#65748b] dark:bg-night-head dark:text-[#ddd7d2]">
                  {["Tracking ID", "Seller", "Status", "Verification", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3.5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRows.map((p) => {
                  const cell = "px-4 py-3.5 border-b border-[#edf0f4] dark:border-night-line";
                  return (
                    <tr key={p.id} className="text-sm text-[#52627a] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                      <td className={`${cell} whitespace-nowrap font-semibold text-[#27364f] dark:text-[#f1eeeb]`}>
                        {p.parcelId ? <Link to={`/parcels/${encodeURIComponent(p.parcelId)}`} className="text-brand hover:underline">{p.id}</Link> : p.id}
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>{p.seller}</td>
                      <td className={cell}><StatusBadge status={p.status} /></td>
                      <td className={cell}><StatusBadge status={p.verification} /></td>
                      <td className={`${cell} whitespace-nowrap`}>{p.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="min-[701px]:hidden space-y-2.5">
            {recentRows.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[#edf0f4] bg-[#fcfcfd] p-3.5 dark:border-night-line dark:bg-night-head"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {p.parcelId ? (
                      <Link to={`/parcels/${encodeURIComponent(p.parcelId)}`} className="block truncate text-[14px] font-bold text-brand hover:underline">
                        {p.id}
                      </Link>
                    ) : (
                      <strong className="block truncate text-[14px] text-[#27364f] dark:text-[#f1eeeb]">{p.id}</strong>
                    )}
                    <span className="text-[12px] text-[#888]">{p.seller} · {p.date}</span>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#f1f3f7] pt-2 text-[12px] text-[#777] dark:border-night-line">
                  <span>Verification</span>
                  <StatusBadge status={p.verification} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. ANALYTICS */}
      <h2 className="mb-4 max-[600px]:mb-3 text-[19px] max-[600px]:text-[17px] font-bold"><i className="fa-solid fa-chart-line mr-2 text-orange-500" />Analytics</h2>

      <section className="mb-6 max-[600px]:mb-4 grid grid-cols-[2.2fr_1fr] items-stretch gap-6 max-[600px]:gap-4 max-[1200px]:grid-cols-1">
        <div className={panel}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[17px] max-[600px]:text-[15.5px] font-bold">{TITLES[period]}</h3>
            <div className="flex items-center gap-2">
              <select value={period} onChange={(e) => changePeriod(e.target.value)} className={`${inputCls} !w-[130px]`} aria-label="Time period">
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-[#8a8a8a]">
            {period === "day" && (
              <button type="button" onClick={() => setWeekOffset((n) => n - 1)} aria-label="Previous week" className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] hover:border-orange-500 hover:text-orange-500 dark:border-night-line"><i className="fa-solid fa-chevron-left text-[11px]" /></button>
            )}
            <span>{series.range} · {loadingStats ? "…" : series.total} parcels</span>
            {period === "day" && (
              <>
                <button type="button" onClick={() => setWeekOffset((n) => Math.min(0, n + 1))} disabled={weekOffset === 0} aria-label="Next week" className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] hover:border-orange-500 hover:text-orange-500 disabled:opacity-40 disabled:hover:border-[#e5e5e5] disabled:hover:text-inherit dark:border-night-line"><i className="fa-solid fa-chevron-right text-[11px]" /></button>
                {weekOffset !== 0 && <button type="button" onClick={() => setWeekOffset(0)} className="text-orange-500 hover:underline">This week</button>}
              </>
            )}
          </div>
          <div className="h-[380px] max-[820px]:h-[260px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={series.rows}
                margin={
                  isMobile
                    ? { top: 10, right: 6, left: -24, bottom: 4 }
                    : { top: 5, right: 10, left: -12, bottom: 0 }
                }
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#e4e8ef" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tick={isMobile ? { fontSize: 11, fill: "#8a8a8a" } : tick}
                  tickMargin={isMobile ? 6 : 4}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={isMobile ? { fontSize: 11, fill: "#8a8a8a" } : tick}
                  width={isMobile ? 42 : 56}
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: "rgba(249,115,22,.08)" }} labelFormatter={(_, items) => items?.[0]?.payload?.full} />
                <Legend
                  iconType="circle"
                  iconSize={isMobile ? 9 : 12}
                  verticalAlign="bottom"
                  height={34}
                  wrapperStyle={
                    isMobile
                      ? { fontSize: 12, paddingTop: 10, lineHeight: "18px" }
                      : { fontSize: 13, paddingTop: 8 }
                  }
                />
                <Bar dataKey="Delivered" stackId="a" fill={COLORS.Delivered} maxBarSize={isMobile ? 28 : 48} />
                <Bar dataKey="Pending" stackId="a" fill={COLORS.Pending} maxBarSize={isMobile ? 28 : 48} />
                <Bar dataKey="Flagged" stackId="a" fill={COLORS.Flagged} radius={[5, 5, 0, 0]} maxBarSize={isMobile ? 28 : 48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panel}>
          <h3 className="mb-5 max-[600px]:mb-2 text-[17px] max-[600px]:text-[15.5px] font-bold">Status breakdown</h3>
          <div className="h-[380px] max-[820px]:h-[275px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                <Pie
                  data={pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={isMobile ? 50 : 70}
                  outerRadius={isMobile ? 80 : 112}
                  paddingAngle={2}
                >
                  {pie.map((s) => <Cell key={s.name} fill={COLORS[s.name]} />)}
                </Pie>
                <Tooltip />
                <Legend
                  iconType="circle"
                  iconSize={isMobile ? 9 : 12}
                  verticalAlign="bottom"
                  align="center"
                  height={36}
                  wrapperStyle={
                    isMobile
                      ? { fontSize: 12, paddingTop: 12, lineHeight: "18px" }
                      : { fontSize: 13, paddingTop: 10 }
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 4. RECENT ACTIVITY */}
      <div className="mt-6 max-[600px]:mt-4"><RecentActivity to="/audit" /></div>
    </>
  );
}
