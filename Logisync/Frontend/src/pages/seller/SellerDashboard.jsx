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
  const needsVideoParcels = parcels.filter(
    (p) =>
      p.status !== "DELIVERED" &&
      !p.returnToHub &&
      p.status !== "RETURN_TO_HUB" &&
      ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"].includes(p.status)
  );
  const returnToHubParcels = parcels.filter(
    (p) => p.status !== "DELIVERED" && (p.status === "RETURN_TO_HUB" || Boolean(p.returnToHub))
  );
  const needAction = [...needsVideoParcels, ...returnToHubParcels];

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
        <div className={`${panel} flex min-w-0 flex-col border-[#f5d5be] p-[28px] max-[600px]:p-4 dark:border-night-line`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                <i className="fa-solid fa-bell text-brand" />
                Action Needed
              </h2>
              <p className="mt-0.5 text-[13px] text-[#64748b] dark:text-[#b8b0a8]">
                Parcels requiring seller attention
              </p>
            </div>
            <span className="rounded-full bg-[#fff0e5] px-3 py-1 text-[12px] font-bold text-[#c2410c] dark:bg-brand/20 dark:text-[#ffb98a]">
              {v(needAction.length)} {needAction.length === 1 ? "parcel" : "parcels"}
            </span>
          </div>

          {/* Two Priority Categories Only: Needs Video & Return to Hub */}
          <div className="space-y-2.5">
            <Link
              to="/seller/parcels?status=NEEDS_VIDEO"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0f4] bg-[#fffaf7] px-4 py-3.5 transition hover:border-brand/50 hover:bg-[#fff4ed] dark:border-night-line dark:bg-night-head dark:hover:border-brand/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-video" />
                </span>
                <div className="min-w-0">
                  <strong className="block text-[14.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Needs Video
                  </strong>
                  <span className="block truncate text-[12px] text-[#777] dark:text-[#b8b0a8]">
                    Upload packing video proof for verification
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#fff0e5] px-3 py-1 text-[12px] font-bold text-[#c2410c] dark:bg-brand/20 dark:text-[#ffb98a]">
                {v(needsVideoParcels.length)} {needsVideoParcels.length === 1 ? "parcel" : "parcels"}
              </span>
            </Link>

            <Link
              to="/seller/parcels?status=RETURN_TO_HUB"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0f4] bg-[#fffaf7] px-4 py-3.5 transition hover:border-brand/50 hover:bg-[#fff4ed] dark:border-night-line dark:bg-night-head dark:hover:border-brand/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-box-archive" />
                </span>
                <div className="min-w-0">
                  <strong className="block text-[14.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Return to Hub
                  </strong>
                  <span className="block truncate text-[12px] text-[#777] dark:text-[#b8b0a8]">
                    Returned parcels requiring seller attention
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#fff0e5] px-3 py-1 text-[12px] font-bold text-[#c2410c] dark:bg-brand/20 dark:text-[#ffb98a]">
                {v(returnToHubParcels.length)} {returnToHubParcels.length === 1 ? "parcel" : "parcels"}
              </span>
            </Link>
          </div>

          {needAction.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#e5e8ee] py-5 text-center text-[13.5px] text-[#888] dark:border-night-line dark:text-[#b8b0a8]">
              {loading ? "Checking parcels…" : "No seller action is currently required. You're all set."}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[#edf0f4] rounded-xl border border-[#edf0f4] dark:divide-night-line dark:border-night-line">
              {needAction.slice(0, 5).map((p) => (
                <li key={p.parcel_id}>
                  <Link
                    to={link(p)}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] transition hover:bg-[#fffaf7] dark:hover:bg-night-head"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-brand">
                        {p.transaction_number || p.parcel_id}
                      </span>
                      <span className="block truncate text-[12px] text-[#777] dark:text-[#b8b0a8]">
                        {p.receiver_name || "Customer"} {p.contents ? `· ${p.contents}` : ""}
                      </span>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[12px] text-[#888] dark:text-[#b8b0a8]">
            Only parcels requiring seller action appear here.
          </p>
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
