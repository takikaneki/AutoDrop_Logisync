import Topbar from "../../components/Topbar.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import { PanelLink } from "../../components/portal.jsx";
import BentoKpiRow from "../../components/dashboard/BentoKpiRow.jsx";
import PortalHeroBanner from "../../components/dashboard/PortalHeroBanner.jsx";
import DashboardRightRail from "../../components/dashboard/DashboardRightRail.jsx";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import { CachedDataNotice, OfflineState } from "../../components/Skeletons.jsx";
import { useRiderScans } from "../../store/riderScans.js";
import { riderCounts } from "../../utils/stats.js";
import {
  syncRiderDeliveriesWithServer,
  useAssignedParcels,
  useMyDeliveries,
  useRiderDeliverySyncState,
} from "../../store/riderDeliveries.js";
import { useNetworkStatus } from "../../utils/network.js";

// Dashboard ng rider:
// - Desktop / Laptop (min-[821px]): Bento KPI -> Hero Banner -> Right Rail -> Recent Scans -> Recent Activity (unchanged)
// - Mobile (max-[820px]): Welcome Rider Banner -> KPI Cards below it
export default function RiderDashboard() {
  const scans = useRiderScans();
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();
  const syncState = useRiderDeliverySyncState();
  const { online } = useNetworkStatus();

  const hasLocalData = assigned.length > 0 || mine.length > 0 || scans.length > 0;
  const loading = online && syncState.syncing && !hasLocalData;
  const offlineEmpty = !online && !hasLocalData && !syncState.syncedOnce;
  const showCachedNotice = !online && hasLocalData;

  const stats = riderCounts(assigned, mine);

  const deliveryRate = stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}%` : "0%";

  const nextDeliveries = assigned.slice(0, 5).map((p) => ({
    id: p.parcel_id,
    title: p.parcel_id,
    subtitle: `${p.receiver || "Customer"} · ${p.address || "Assigned route"}`,
    meta: "Scan QR",
    icon: "qr-code",
    tone: "warn",
    to: `/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`,
  }));

  const riderBars = [
    { label: "Assign", value: assigned.length },
    { label: "Route", value: stats.toDeliver },
    { label: "Done", value: stats.delivered },
    { label: "Fail", value: stats.failed },
  ];

  const rescheduledCount = stats.rescheduled;

  const kpiCards = [
    {
      label: "Total Parcels",
      value: stats.total,
      tone: "dark",
      to: "/rider/deliveries",
      badge: "All Assigned",
      icon: "package",
      subtext: `${stats.failed} failed delivery`,
    },
    {
      label: "To Be Delivered",
      value: stats.toDeliver,
      tone: "orange",
      to: "/rider/deliveries",
      badge: "Active Route",
      icon: "truck",
      subtext: "Ready for doorstep handoff",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      tone: "green",
      to: "/rider/deliveries?tab=delivered",
      badge: "Completed",
      icon: "package-check",
      subtext: "Successfully handed off",
    },
  ];

  const pipelineSteps = [
    { label: "To Deliver", count: stats.toDeliver, icon: "truck", tone: "orange", to: "/rider/deliveries" },
    { label: "Delivered", count: stats.delivered, icon: "package-check", tone: "green", to: "/rider/deliveries?tab=delivered" },
    { label: "Rescheduled", count: rescheduledCount, icon: "calendar-days", tone: "yellow", to: "/rider/deliveries?tab=rescheduled" },
    { label: "Failed", count: stats.failed, icon: "triangle-alert", tone: "red", to: "/rider/deliveries?tab=failed" },
  ];

  return (
    <>
      {showCachedNotice && <CachedDataNotice updatedAt={syncState.lastSyncedAt} />}

      {/* =====================================================================
          RIDER MOBILE HOME (max-[820px] ONLY):
          1. Welcome Rider Banner
          2. KPI Summary Cards directly below the banner
      ===================================================================== */}
      <div className="flex flex-col gap-4 min-[821px]:hidden">
        <PortalHeroBanner role="rider" loading={loading} pipeline={pipelineSteps} />
        {offlineEmpty ? (
          <OfflineState compact title="Route summary unavailable offline" text="Reconnect to sync your assigned deliveries." onRetry={() => syncRiderDeliveriesWithServer()} />
        ) : (
          <BentoKpiRow loading={loading} cards={kpiCards} />
        )}
      </div>

      {/* =====================================================================
          DESKTOP / LAPTOP RIDER DASHBOARD (min-[821px] — 100% UNCHANGED)
      ===================================================================== */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Dashboard" />

        {/* BENTO OVERVIEW GRID (No Maps) */}
        <section className="mb-7 max-[600px]:mb-4 grid grid-cols-[1.85fr_1fr] items-stretch gap-5 max-[1150px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            {offlineEmpty ? (
              <OfflineState compact title="Route summary unavailable offline" text="Reconnect to sync your assigned deliveries." onRetry={() => syncRiderDeliveriesWithServer()} />
            ) : (
              <BentoKpiRow loading={loading} cards={kpiCards} />
            )}

            <PortalHeroBanner role="rider" loading={loading} pipeline={pipelineSteps} />
          </div>

          <DashboardRightRail
            loading={loading}
            tasksTitle="Next Deliveries"
            seeAllTo="/rider/deliveries"
            tasks={nextDeliveries}
            emptyText={
              offlineEmpty
                ? "Assigned deliveries will appear once you're back online."
                : "No assigned parcels waiting to be scanned right now."
            }
            summary={{
              label: "Delivery Rate",
              value: offlineEmpty ? "—" : deliveryRate,
              sublabel: offlineEmpty ? "Offline" : `${stats.delivered} of ${stats.total} completed`,
              bars: riderBars,
            }}
          />
        </section>

        <div className="mb-7 max-[600px]:mb-4"><RecentScans scans={scans} action={<PanelLink to="/rider/scan">Scan</PanelLink>} /></div>

        <RecentActivity to="/rider/activity" />
      </div>
    </>
  );
}
