import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { LoadingRow, Notice, PanelLink, PanelTitle, StatCard, StatGrid } from "../../components/portal.jsx";
import { panel, td, th } from "../../components/styles.js";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import DashboardShortcuts from "../../components/dashboard/DashboardShortcuts.jsx";
import { listParcels } from "../../services/parcelService.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { statusInfo } from "../../utils/parcelStatus.js";

const CHART = [
  ["WAITING_FOR_VIDEO", "#e99a00"],
  ["REUPLOAD_REQUESTED", "#f97316"],
  ["VIDEO_SUBMITTED", "#4285c5"],
  ["VERIFIED", "#16a34a"],
  ["RESCHEDULED", "#d97706"],
  ["RETURN_TO_HUB", "#7c3aed"],
  ["REJECTED", "#ef4444"],
];

const MOBILE_AXIS_LINES = {
  "waiting for video": ["Waiting", "for Video"],
  "needs video": ["Needs", "Video"],
  "reupload requested": ["Reupload", "Req."],
  "under verification": ["Under", "Verify"],
  verified: ["Verified", ""],
  rescheduled: ["Resched.", ""],
  "return to hub": ["Return", "to Hub"],
  rejected: ["Rejected", ""],
};

function MobileStatusTick({ x, y, payload }) {
  const raw = String(payload?.value || "").trim();
  const [line1, line2] = MOBILE_AXIS_LINES[raw.toLowerCase()] || [raw, ""];
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={600}>
        <tspan x={0} dy="13">{line1}</tspan>
        {line2 && <tspan x={0} dy="12">{line2}</tspan>}
      </text>
    </g>
  );
}

export default function SellerDashboard() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 800px)");
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
      .then(setParcels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const count = (...s) => parcels.filter((p) => s.includes(p.status)).length;
  const needAction = parcels.filter((p) => ["REUPLOAD_REQUESTED", "REJECTED", "RETURN_TO_HUB"].includes(p.status));
  const chartData = useMemo(
    () =>
      CHART.map(([s, color]) => ({ name: statusInfo(s).label, value: count(s), color })).filter(
        (d) =>
          d.value > 0 ||
          ["Needs Video", "Waiting for video", "Under Verification", "Under verification", "Verified", "Return to Hub"].includes(d.name)
      ),
    [parcels] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const v = (n) => (loading ? "…" : n);
  const link = (p) => `/seller/scan?txn=${encodeURIComponent(p.transaction_number || p.parcel_id)}`;

  return (
    <>
      <Topbar title="Dashboard" />

      {error && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice>}

      {/* SUMMARY CARDS */}
      <DashboardShortcuts role="seller" />
      <StatGrid>
        <StatCard label="Total Parcels" value={v(parcels.length)} icon="fa-box" tone="orange" to="/seller/parcels" />
        <StatCard label="Needs Video" value={v(count("WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"))} icon="fa-video" tone="yellow" to="/seller/parcels?status=NEEDS_VIDEO" />
        <StatCard label="Under Verification" value={v(count("VIDEO_SUBMITTED"))} icon="fa-hourglass-half" tone="blue" to="/seller/parcels?status=UNDER_VERIFICATION" />
        <StatCard label="Verified / In Delivery" value={v(count("VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED"))} icon="fa-circle-check" tone="green" to="/seller/parcels?status=VERIFIED" />
      </StatGrid>

      {/* STATUS CHART + ACTION NEEDED */}
      <section className="mb-7 max-[800px]:mb-4 grid grid-cols-[2fr_1fr] items-stretch gap-6 max-[800px]:gap-4 max-[1200px]:grid-cols-1">
        <div className={`${panel} flex min-w-0 flex-col p-[30px] max-[800px]:p-4`}>
          <PanelTitle icon="fa-chart-column">Parcels by Status</PanelTitle>
          {parcels.length === 0 ? (
            <EmptyState title={loading ? "Loading…" : "No data yet"} text={loading ? "" : "Register a parcel to see your status breakdown."} />
          ) : (
            <>
              <div className="min-h-[280px] max-[800px]:mt-1 max-[800px]:mx-auto max-[800px]:min-h-0 max-[800px]:h-[235px] w-full flex-1 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={
                      isMobile
                        ? { top: 12, right: 12, left: 0, bottom: 8 }
                        : { top: 10, right: 10, left: -20, bottom: 0 }
                    }
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="#e4e8ef" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: "#dfe5ed" }}
                      fontSize={12}
                      interval={0}
                      height={isMobile ? 42 : 30}
                      padding={isMobile ? { left: 8, right: 8 } : undefined}
                      tick={isMobile ? <MobileStatusTick /> : undefined}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={isMobile ? 11 : 14}
                      width={isMobile ? 28 : 60}
                      tickMargin={isMobile ? 4 : 6}
                      allowDecimals={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(249,115,22,.08)" }} />
                    <Bar
                      dataKey="value"
                      name="Parcels"
                      radius={isMobile ? [6, 6, 0, 0] : [7, 7, 0, 0]}
                      maxBarSize={isMobile ? 32 : 52}
                    >
                      {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[#f1f3f7] pt-3 text-[12px] text-[#64748b] min-[801px]:hidden dark:border-night-line dark:text-[#d1c9c2]">
                {chartData.map((d) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: d.color }}
                      aria-hidden="true"
                    />
                    <span>{d.name}:</span>
                    <strong className="font-semibold text-[#27364f] dark:text-[#f1eeeb]">{d.value}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`${panel} flex min-w-0 flex-col p-[30px] max-[600px]:p-4`}>
          <PanelTitle icon="fa-bell">Action Needed</PanelTitle>
          <div className="mb-4 max-[600px]:mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#fff4ed] p-5 max-[600px]:p-4 dark:bg-night-head">
            <div className="flex h-[56px] w-[56px] max-[600px]:h-[44px] max-[600px]:w-[44px] items-center justify-center rounded-full bg-[#fff0e5] text-[24px] max-[600px]:text-[19px] text-orange-500">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div>
              <h2 className="text-[32px] max-[600px]:text-[24px] font-bold leading-tight text-orange-500">
                {v(needAction.length)} <small className="text-base max-[600px]:text-sm font-normal text-[#26344d] dark:text-[#f1eeeb]">parcels</small>
              </h2>
              <p className="text-sm max-[600px]:text-xs text-[#64748b]">need your attention (reupload, rejected, or Return to Hub).</p>
            </div>
          </div>

          {needAction.length === 0 ? (
            <p className="py-6 max-[600px]:py-4 text-center text-[14px] text-[#999]">{loading ? "" : "Nothing to fix. You're all set."}</p>
          ) : (
            <ul className="flex-1">
              {needAction.slice(0, 5).map((p) => (
                <li key={p.parcel_id} className="flex items-center justify-between gap-3 border-b border-[#edf0f4] py-3 text-[14px] last:border-b-0 dark:border-night-line">
                  <Link to={link(p)} className="truncate font-semibold text-brand hover:underline">{p.transaction_number || p.parcel_id}</Link>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* RECENT PARCELS */}
      <section className={`${panel} overflow-hidden p-[30px] max-[600px]:p-4`}>
        <PanelTitle icon="fa-box" action={<PanelLink to="/seller/parcels">View All</PanelLink>}>Recent Parcels</PanelTitle>

        {loading ? (
          <LoadingRow />
        ) : parcels.length === 0 ? (
          <EmptyState title="No parcels yet" text="Register your first parcel to get started." />
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="bg-[#fafafa] dark:bg-night-head">
                <tr>
                  {["Transaction no.", "Receiver", "Contents", "Status", "Updated", ""].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parcels.slice(0, 5).map((p) => (
                  <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{p.transaction_number || p.parcel_id}</td>
                    <td className={td}>{p.receiver_name}</td>
                    <td className={td}>{p.contents || "—"}</td>
                    <td className={td}>
                      <StatusBadge status={p.status} />
                      {p.rescheduled && !p.returnToHub && p.scheduledFor && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#c98200]">
                          Day {p.rescheduleCount || 1}/3 · {formatDay(p.scheduledFor)}
                        </span>
                      )}
                      {p.returnToHub && (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[#7c3aed]">
                          {p.returnCoordinated ? "Return to Seller Coordinated" : "3-Day Limit Reached"}
                        </span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(p.updated_at)}</td>
                    <td className={`${td} text-right`}>
                      <Link to={link(p)} className="font-semibold text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-7 max-[600px]:mt-4"><RecentActivity to="/seller/activity" /></div>
    </>
  );
}
