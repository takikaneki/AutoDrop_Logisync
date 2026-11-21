import Topbar from "../../components/Topbar.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import { PanelLink } from "../../components/portal.jsx";
import BentoKpiRow from "../../components/dashboard/BentoKpiRow.jsx";
import PortalHeroBanner from "../../components/dashboard/PortalHeroBanner.jsx";
import DashboardRightRail from "../../components/dashboard/DashboardRightRail.jsx";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import { useRiderScans } from "../../store/riderScans.js";
import { riderCounts } from "../../utils/stats.js";
import { useAssignedParcels, useMyDeliveries } from "../../store/riderDeliveries.js";

// Dashboard ng rider:
// - Desktop / Laptop (min-[821px]): Bento KPI -> Hero Banner -> Right Rail -> Recent Scans -> Recent Activity (unchanged)
// - Mobile (max-[820px]): Welcome Rider Banner -> KPI Cards below it (Delivery Rate moved under Profile > Analytics)
export default function RiderDashboard() {
  const scans = useRiderScans();
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();

  const stats = riderCounts(assigned, mine);

  const deliveryRate = stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}%` : "0%";

  const nextDeliveries = assigned.slice(0, 5).map((p) => ({
    id: p.parcel_id,
    title: p.parcel_id,
    subtitle: `${p.receiver || "Customer"} · ${p.address || "Assigned route"}`,
    meta: "Scan QR",
    icon: "fa-qrcode",
    tone: "warn",
    to: `/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`,
  }));

  const riderBars = [
    { label: "Assign", value: assigned.length },
    { label: "Route", value: stats.toDeliver },
    { label: "Done", value: stats.delivered },
    { label: "Fail", value: stats.failed },
  ];

  const rescheduledCount = mine.filter(
    (d) => d.rescheduled && !d.returnToHub && d.stage !== "delivered"
  ).length;

  const kpiCards = [
    {
      label: "Total Parcels",
      value: stats.total,
      tone: "dark",
      to: "/rider/deliveries",
      badge: "All Assigned",
      icon: "fa-box",
      subtext: `${stats.failed} failed delivery`,
    },
    {
      label: "To Be Delivered",
      value: stats.toDeliver,
      tone: "light",
      to: "/rider/deliveries",
      badge: "Active Route",
      icon: "fa-truck-fast",
      subtext: "Ready for doorstep handoff",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      tone: "orange",
      to: "/rider/deliveries?tab=delivered",
      badge: "Completed",
      icon: "fa-circle-check",
      subtext: "Successfully handed off",
    },
  ];

  const pipelineSteps = [
    { label: "To Deliver", count: stats.toDeliver, icon: "fa-truck-fast", to: "/rider/deliveries" },
    { label: "Delivered", count: stats.delivered, icon: "fa-circle-check", to: "/rider/deliveries?tab=delivered" },
    { label: "Rescheduled", count: rescheduledCount, icon: "fa-calendar-day", to: "/rider/deliveries" },
    { label: "Failed", count: stats.failed, icon: "fa-triangle-exclamation", to: "/rider/deliveries?tab=failed" },
  ];

  return (
    <>
      {/* =====================================================================
          RIDER MOBILE HOME (max-[820px] ONLY):
          1. Welcome Rider Banner
          2. KPI Summary Cards directly below the banner
      ===================================================================== */}
      <div className="flex flex-col gap-4 min-[821px]:hidden">
        <PortalHeroBanner role="rider" pipeline={pipelineSteps} />
        <BentoKpiRow cards={kpiCards} />
      </div>

      {/* =====================================================================
          DESKTOP / LAPTOP RIDER DASHBOARD (min-[821px] — 100% UNCHANGED)
      ===================================================================== */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Dashboard" />

        {/* BENTO OVERVIEW GRID (No Maps) */}
        <section className="mb-7 max-[600px]:mb-4 grid grid-cols-[1.85fr_1fr] items-stretch gap-5 max-[1150px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            <BentoKpiRow cards={kpiCards} />

            <PortalHeroBanner role="rider" pipeline={pipelineSteps} />
          </div>

          <DashboardRightRail
            tasksTitle="Next Deliveries"
            seeAllTo="/rider/deliveries"
            tasks={nextDeliveries}
            emptyText="No assigned parcels waiting to be scanned right now."
            summary={{
              label: "Delivery Rate",
              value: deliveryRate,
              sublabel: `${stats.delivered} of ${stats.total} completed`,
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
