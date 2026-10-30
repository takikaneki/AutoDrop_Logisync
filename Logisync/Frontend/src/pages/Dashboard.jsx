import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Topbar from "../components/Topbar.jsx";
import { StatusBadge } from "../components/ui.jsx";
import { recentParcels } from "../data/mock.js";
import { StatCard, StatGrid } from "../components/portal.jsx";
import DashboardShortcuts from "../components/dashboard/DashboardShortcuts.jsx";
import RecentActivity from "../components/audit/RecentActivity.jsx";
import { inputCls } from "../components/styles.js";
import { listParcels } from "../services/parcelService.js";
import { parcelStats } from "../utils/stats.js";
import { buildParcelSeries, statusTotals } from "../utils/analytics.js";

const panel = "bg-white border border-[#e5e8ee] rounded-2xl p-[30px] min-w-0 dark:bg-night-panel dark:border-night-line max-[600px]:p-5";
const COLORS = { Delivered: "#16a34a", Pending: "#f97316", Flagged: "#d94747" };
const PERIODS = [["day", "By Day"], ["week", "By Week"], ["month", "By Month"]];
const TITLES = { day: "Parcels per day (Mon–Sun)", week: "Parcels per week", month: "Parcels per month" };
const tick = { fontSize: 13, fill: "#8a8a8a" };

// Pagkakasunod: 1) Summary cards  2) Verification + Recent Parcels  3) Analytics  4) Recent activity (nasa pinakababa)
export default function Dashboard() {
  // ---- 1. Summary cards: totoong bilang mula sa backend (GET /api/parcels = lahat ng parcel)
  const [real, setReal] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  useEffect(() => {
    listParcels().then(setReal).catch(() => {}).finally(() => setLoadingStats(false));
  }, []);
  const stats = parcelStats(real);
  const v = (n) => (loadingStats ? "…" : n);
  const countStatus = (s) => real.filter((p) => p.status === s).length;

  // ---- 2. Analytics: totoong parcels din (parehong data ng summary cards)
  const [period, setPeriod] = useState("day");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = linggong ito (para sa By Day)
  const changePeriod = (p) => { setPeriod(p); setWeekOffset(0); };

  const series = useMemo(() => buildParcelSeries(real, period, weekOffset), [real, period, weekOffset]);
  const pie = useMemo(() => statusTotals(real), [real]);

  return (
    <>
      <Topbar title="Dashboard" />

      {/* 1. SUMMARY CARDS (shortcuts sa itaas-kanan) */}
      <DashboardShortcuts role="coordinator" />
      <StatGrid>
        <StatCard label="Total Parcels" value={v(stats.total)} icon="fa-box" tone="orange" to="/parcels" />
        <StatCard label="Needs Verification" value={v(stats.flagged)} icon="fa-hourglass-half" tone="blue" to="/verification?status=VIDEO_SUBMITTED" />
        <StatCard label="Verified Parcels" value={v(stats.pending)} icon="fa-circle-check" tone="green" to="/verification?status=VERIFIED" />
        <StatCard label="Failed Deliveries" value={v(stats.delivered)} icon="fa-triangle-exclamation" tone="red" to="/parcels?status=Failed%20Delivery" />
      </StatGrid>

      {/* 2. VERIFICATION + RECENT PARCELS */}
      <section className="mb-7 grid grid-cols-[1fr_2fr] items-stretch gap-6 max-[1200px]:grid-cols-1">
        {/* VERIFICATION NEEDED (totoong bilang mula sa backend) */}
        <div className={`${panel} flex flex-col`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[19px] font-bold"><i className="fa-regular fa-bell mr-2 text-orange-500" />Verification Needed</h2>
            <Link to="/verification" className="whitespace-nowrap text-sm text-orange-500">View All →</Link>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#fff4ed] p-5 dark:bg-[#3b3531]">
            <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#fff0e5] text-[24px] text-orange-500"><i className="fa-solid fa-box" /></div>
            <div>
              <h2 className="text-[32px] font-bold leading-tight text-orange-500">
                {v(countStatus("VIDEO_SUBMITTED"))} <small className="text-base font-normal text-[#26344d] dark:text-[#f1eeeb]">parcels</small>
              </h2>
              <p className="mt-1 text-sm text-[#64748b]">need verification.</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            {[
              ["fa-triangle-exclamation", "Flagged for Review", stats.flagged],
              ["fa-circle-play", "Awaiting Seller Video", countStatus("WAITING_FOR_VIDEO")],
            ].map(([icon, label, n]) => (
              <div key={label} className="flex flex-1 items-center justify-between border-b border-[#edf0f4] py-4 text-[16px] text-[#52627a] last:border-b-0 dark:border-night-line dark:text-[#d1c9c2]">
                <span><i className={`fa-solid ${icon} w-6`} /> {label}</span>
                <strong className="text-lg text-orange-500">{v(n)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT PARCELS */}
        <div className={`${panel} min-h-[420px] overflow-hidden`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[19px] font-bold"><i className="fa-solid fa-box mr-2 text-orange-500" />Recent Parcels</h2>
            <Link to="/parcels" className="whitespace-nowrap text-sm text-orange-500 hover:underline">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f9] text-left text-sm text-[#65748b] dark:bg-night-head dark:text-[#ddd7d2]">
                  {["Tracking ID", "Seller", "Status", "Verification", "Date"].map((h) => (
                    <th key={h} className="px-5 py-4 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentParcels.slice(0, 6).map((p) => {
                  const cell = "px-5 py-4 border-b border-[#edf0f4] dark:border-night-line";
                  return (
                    <tr key={p.id} className="text-sm text-[#52627a] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                      <td className={`${cell} whitespace-nowrap font-semibold text-[#27364f] dark:text-[#f1eeeb]`}>{p.id}</td>
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
        </div>
      </section>

      {/* 3. ANALYTICS */}
      <h2 className="mb-4 text-[19px] font-bold"><i className="fa-solid fa-chart-line mr-2 text-orange-500" />Analytics</h2>

      <section className="mb-6 grid grid-cols-[2.2fr_1fr] items-stretch gap-6 max-[1200px]:grid-cols-1">
        <div className={panel}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[17px] font-bold">{TITLES[period]}</h3>
            <div className="flex items-center gap-2">
              <select value={period} onChange={(e) => changePeriod(e.target.value)} className={`${inputCls} !w-[130px]`} aria-label="Time period">
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4 flex items-center gap-2 text-[13px] text-[#8a8a8a]">
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
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e4e8ef" vertical={false} />
                <XAxis dataKey="label" tickLine={false} tick={tick} interval={0} />
                <YAxis tickLine={false} axisLine={false} tick={tick} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(249,115,22,.08)" }} labelFormatter={(_, items) => items?.[0]?.payload?.full} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Delivered" stackId="a" fill={COLORS.Delivered} />
                <Bar dataKey="Pending" stackId="a" fill={COLORS.Pending} />
                <Bar dataKey="Flagged" stackId="a" fill={COLORS.Flagged} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panel}>
          <h3 className="mb-5 text-[17px] font-bold">Status breakdown</h3>
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={78} outerRadius={125} paddingAngle={2}>
                  {pie.map((s) => <Cell key={s.name} fill={COLORS[s.name]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 4. RECENT ACTIVITY (pinakababa) */}
      <div className="mt-6"><RecentActivity to="/audit" /></div>
    </>
  );
}
