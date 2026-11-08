import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EmptyState, CodBadge } from "../../components/ui.jsx";
import { LoadingRow, Notice, PanelLink, PanelTitle, StatCard, StatGrid } from "../../components/portal.jsx";
import { panel, td, th } from "../../components/styles.js";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import DashboardShortcuts from "../../components/dashboard/DashboardShortcuts.jsx";
import { listParcels, confirmReturnedParcel } from "../../services/parcelService.js";
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

  const handleSellerConfirmReceipt = async (parcelId) => {
    try {
      await confirmReturnedParcel(parcelId);
      toast("Receipt of returned parcel confirmed.");
      refreshParcels();
    } catch (err) {
      toast(err.message || "Failed to confirm receipt.", "error");
    }
  };

  const count = (...s) => parcels.filter((p) => s.includes(p.status)).length;
  const needAction = parcels.filter((p) => ["REUPLOAD_REQUESTED", "REJECTED", "RETURN_TO_HUB"].includes(p.status));
  const rtsParcels = parcels.filter(
    (p) =>
      p.returnToHub ||
      p.status === "RETURN_TO_HUB" ||
      p.status === "RETURNED" ||
      Boolean(p.rts_status)
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

      {/* RETURNED PARCELS (RTS) TRACKING */}
      <section className="mb-7 max-[820px]:mb-4">
        <div className={`${panel} p-[30px] max-[600px]:p-4`}>
          <PanelTitle icon="fa-boxes-packing">
            Returned Parcels Tracking (Return to Sender)
          </PanelTitle>
          <p className="mb-4 text-xs text-[#777] dark:text-[#b8b0a8]">
            Monitor returned parcels across the 4 RTS stages: Return to Hub, Hub Arrival Verification, RTS In Transit, and Returned to Seller.
          </p>

          <div className="grid grid-cols-3 gap-3 max-[768px]:grid-cols-1 mb-5">
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-800/40 dark:bg-purple-900/20">
              <small className="block text-xs font-semibold text-purple-700 dark:text-purple-300">
                <i className="fa-solid fa-warehouse mr-1.5" /> For Return (Hub)
              </small>
              <strong className="mt-1 block text-2xl font-bold text-purple-900 dark:text-purple-100">
                {v(rtsParcels.filter((p) => !p.rts_status || p.rts_status === "RETURN_TO_HUB" || p.rts_status === "HUB_VERIFIED").length)}
              </strong>
              <span className="text-[11px] text-purple-600/80">Pending/verified at hub</span>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-800/40 dark:bg-orange-900/20">
              <small className="block text-xs font-semibold text-orange-700 dark:text-orange-300">
                <i className="fa-solid fa-truck-fast mr-1.5" /> RTS – In Transit
              </small>
              <strong className="mt-1 block text-2xl font-bold text-orange-900 dark:text-orange-100">
                {v(rtsParcels.filter((p) => p.rts_status === "RTS_IN_TRANSIT").length)}
              </strong>
              <span className="text-[11px] text-orange-600/80">On delivery back to you</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
              <small className="block text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <i className="fa-solid fa-circle-check mr-1.5" /> Returned to Seller
              </small>
              <strong className="mt-1 block text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {v(rtsParcels.filter((p) => p.rts_status === "RETURNED_TO_SELLER" || p.status === "RETURNED").length)}
              </strong>
              <span className="text-[11px] text-emerald-600/80">Received &amp; completed</span>
            </div>
          </div>

          {rtsParcels.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#999]">{loading ? "" : "No returned parcels at this time."}</p>
          ) : (
            <div className="space-y-3">
              {rtsParcels.slice(0, 5).map((p) => {
                const isCod = p.is_cod || p.payment_method === "COD";
                const canConfirm = p.rts_status === "RTS_IN_TRANSIT";
                return (
                  <div key={p.parcel_id} className="rounded-xl border border-[#edf0f4] p-4 flex flex-wrap items-center justify-between gap-3 dark:border-night-line">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={link(p)} className="font-bold text-brand hover:underline">
                          {p.transaction_number || p.parcel_id}
                        </Link>
                        {isCod && <CodBadge />}
                        <StatusBadge status={p.rts_status === "RETURNED_TO_SELLER" || p.status === "RETURNED" ? "Returned to Seller" : p.rts_status === "RTS_IN_TRANSIT" ? "RTS – In Transit" : p.rts_status === "HUB_VERIFIED" ? "Hub Verified" : "Return to Hub"} />
                      </div>
                      <p className="text-xs text-[#777] mt-1 dark:text-[#b8b0a8]">
                        Customer: <strong>{p.receiver_name}</strong> · Reason: {p.last_failure || "Return to Hub"}
                      </p>
                    </div>

                    <div>
                      {canConfirm ? (
                        <button
                          type="button"
                          onClick={() => handleSellerConfirmReceipt(p.parcel_id)}
                          className="rounded-lg bg-[#29945a] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#217a49]"
                        >
                          <i className="fa-solid fa-box-open mr-1.5" /> Confirm Receipt
                        </button>
                      ) : (
                        <Link to={link(p)} className="text-xs font-semibold text-brand hover:underline">
                          Track Details →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
