import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EmptyState, CodBadge } from "../../components/ui.jsx";
import { LoadingRow, Notice, PanelLink, PanelTitle } from "../../components/portal.jsx";
import { panel, td, th } from "../../components/styles.js";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import BentoKpiRow from "../../components/dashboard/BentoKpiRow.jsx";
import PortalHeroBanner from "../../components/dashboard/PortalHeroBanner.jsx";
import DashboardRightRail from "../../components/dashboard/DashboardRightRail.jsx";
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
  const verifiedOrInDelivery = count("VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED");
  const dispatchRate = parcels.length ? `${Math.round((verifiedOrInDelivery / parcels.length) * 100)}%` : "0%";

  const actionTasks = needAction.slice(0, 5).map((p) => {
    const isReturn = p.status === "RETURN_TO_HUB" || Boolean(p.returnToHub);
    return {
      id: p.parcel_id,
      title: p.transaction_number || p.parcel_id,
      subtitle: `${p.receiver_name || "Customer"} · ${isReturn ? "Return to Hub" : "Needs Video"}`,
      meta: formatDay(p.created_at),
      icon: isReturn ? "fa-box-archive" : "fa-video",
      tone: isReturn ? "danger" : "warn",
      to: link(p),
    };
  });

  const sellerBars = [
    { label: "Wait", value: count("WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED") },
    { label: "Review", value: count("VIDEO_SUBMITTED") },
    { label: "Verif", value: count("VERIFIED") },
    { label: "Out", value: count("OUT_FOR_DELIVERY", "RESCHEDULED") },
    { label: "Done", value: count("DELIVERED") },
  ];

  return (
    <>
      <Topbar title="Dashboard" />

      {error && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice>}

      {/* BENTO OVERVIEW GRID (No Maps) */}
      <section className="mb-7 max-[820px]:mb-4 grid grid-cols-[1.85fr_1fr] items-stretch gap-5 max-[1150px]:grid-cols-1">
        <div className="flex flex-col gap-4">
          <BentoKpiRow
            cards={[
              {
                label: "Total Parcels",
                value: v(parcels.length),
                tone: "dark",
                to: "/seller/parcels",
                badge: "All Orders",
                icon: "fa-box",
                subtext: `${v(returnToHubParcels.length)} return to hub`,
              },
              {
                label: "Needs Video",
                value: v(count("WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED")),
                tone: "light",
                to: "/seller/parcels?status=NEEDS_VIDEO",
                badge: "Action Required",
                icon: "fa-video",
                subtext: `${v(count("VIDEO_SUBMITTED"))} under verification`,
              },
              {
                label: "Verified / In Delivery",
                value: v(verifiedOrInDelivery),
                tone: "orange",
                to: "/seller/parcels?status=VERIFIED",
                badge: "Cleared",
                icon: "fa-circle-check",
                subtext: "Approved for SPX dispatch",
              },
            ]}
          />

          <PortalHeroBanner
            role="seller"
            pipeline={[
              { label: "Needs Video", count: v(needsVideoParcels.length), icon: "fa-video", to: "/seller/parcels?status=NEEDS_VIDEO" },
              { label: "Under Review", count: v(count("VIDEO_SUBMITTED")), icon: "fa-hourglass-half", to: "/seller/parcels?status=UNDER_VERIFICATION" },
              { label: "Verified", count: v(count("VERIFIED")), icon: "fa-circle-check", to: "/seller/parcels?status=VERIFIED" },
              { label: "Delivered", count: v(count("DELIVERED")), icon: "fa-truck-fast", to: "/seller/parcels" },
            ]}
          />
        </div>

        <DashboardRightRail
          tasksTitle="Action Needed"
          seeAllTo="/seller/parcels?status=NEEDS_VIDEO"
          tasks={actionTasks}
          emptyText={loading ? "Checking parcels…" : "No seller action is currently required. You're all set."}
          summary={{
            label: "Dispatch Rate",
            value: loading ? "…" : dispatchRate,
            sublabel: `${v(verifiedOrInDelivery)} of ${v(parcels.length)} cleared`,
            bars: sellerBars,
          }}
        />
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
