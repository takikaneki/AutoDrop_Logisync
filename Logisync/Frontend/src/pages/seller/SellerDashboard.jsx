import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EmptyState, CodBadge } from "../../components/ui.jsx";
import { LoadingRow, Notice, PanelLink, PanelTitle, StatCard, StatGrid } from "../../components/portal.jsx";
import { panel, td, th } from "../../components/styles.js";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import DashboardShortcuts from "../../components/dashboard/DashboardShortcuts.jsx";
import { listParcels } from "../../services/parcelService.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { toast } from "../../store/toast.js";

export default function SellerDashboard() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshParcels = () => {
    listParcels()
      .then(setParcels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshParcels();
  }, []);

  const count = (...s) => parcels.filter((p) => s.includes(p.status)).length;
  const needAction = parcels.filter((p) => ["REUPLOAD_REQUESTED", "REJECTED", "RETURN_TO_HUB"].includes(p.status));

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

      {/* ACTION NEEDED */}
      <section className="mb-7 max-[820px]:mb-4">
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
          <>
            <div className="hidden min-[701px]:block overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
              <table className="w-full min-w-[680px] border-collapse">
                <thead className="bg-[#fafafa] dark:bg-night-head">
                  <tr>
                    {["Transaction no.", "Receiver", "Contents", "Status", "Updated", ""].map((h) => <th key={h} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parcels.slice(0, 5).map((p) => (
                    <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                      <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span>{p.transaction_number || p.parcel_id}</span>
                          {(p.is_cod || p.payment_method === "COD") && <CodBadge />}
                        </span>
                      </td>
                      <td className={td}>{p.receiver_name}</td>
                      <td className={td}>{p.contents || "—"}</td>
                      <td className={td}>
                        <StatusBadge status={p.status} />
                        {p.rescheduled && !p.returnToHub && p.status !== "DELIVERED" && p.scheduledFor && (
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
            <div className="min-[701px]:hidden space-y-2.5">
              {parcels.slice(0, 5).map((p) => (
                <div
                  key={p.parcel_id}
                  className="rounded-xl border border-[#edf0f4] bg-[#fcfcfd] p-3.5 dark:border-night-line dark:bg-night-head"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link to={link(p)} className="block truncate text-[14px] font-bold text-brand hover:underline">
                          {p.transaction_number || p.parcel_id}
                        </Link>
                        {(p.is_cod || p.payment_method === "COD") && <CodBadge />}
                      </div>
                      <span className="block truncate text-[13px] font-medium text-[#333] dark:text-[#f1eeeb]">{p.receiver_name}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#f1f3f7] pt-2 text-[12px] text-[#888] dark:border-night-line">
                    <span className="truncate">{p.contents || "Parcel"} · {formatDate(p.updated_at)}</span>
                    <Link to={link(p)} className="shrink-0 font-semibold text-brand hover:underline">View →</Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mt-7 max-[600px]:mt-4"><RecentActivity to="/seller/activity" /></div>
    </>
  );
}
