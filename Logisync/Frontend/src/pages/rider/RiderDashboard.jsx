import { useNavigate } from "react-router-dom";
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
// - Desktop / Laptop (min-[821px]): Bento KPI -> Recent Scans -> Recent Activity (unchanged)
// - Mobile (max-[820px]): Scanner-Centered Home screen
export default function RiderDashboard() {
  const navigate = useNavigate();
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

  return (
    <>
      {/* =====================================================================
          RIDER MOBILE HOME — SCANNER-CENTERED DESIGN (max-[820px] ONLY)
      ===================================================================== */}
      <section
        aria-label="Rider QR Scanner Home"
        className="relative flex min-h-[calc(100dvh-120px)] w-full flex-col justify-between overflow-hidden bg-white dark:bg-[#0f172a] min-[821px]:hidden"
      >
        {/* Subtle decorative background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/[0.06] blur-3xl dark:bg-brand/[0.12]"
        />

        {/* Center Scanner Hero */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-6 pb-8 text-center">
          <button
            type="button"
            onClick={() => navigate("/rider/scan?auto=1")}
            aria-label="Scan QR Code — open parcel QR camera scanner"
            className="group relative flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            {/* Outer subtle peach / orange halo ring */}
            <span className="flex items-center justify-center rounded-full bg-[#ffedd5]/65 p-4 transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95 dark:bg-[#ee4d2d]/15">
              {/* Inner warm peach ring */}
              <span className="flex items-center justify-center rounded-full bg-[#fed7aa]/75 p-3.5 dark:bg-[#ee4d2d]/25">
                {/* Dark navy circular scanner core */}
                <span className="flex h-[176px] w-[176px] min-[390px]:h-[196px] min-[390px]:w-[196px] items-center justify-center rounded-full bg-[#0f172a] text-white shadow-[0_20px_48px_rgba(15,23,42,0.32)] ring-2 ring-[#1e293b] transition-colors group-hover:bg-[#162238] dark:bg-[#1e293b] dark:ring-brand/40">
                  <svg
                    viewBox="0 0 88 88"
                    className="h-[84px] w-[84px] min-[390px]:h-[92px] min-[390px]:w-[92px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {/* 4 Corner Viewfinder Brackets */}
                    <path d="M16 32V22a6 6 0 0 1 6-6h10" />
                    <path d="M56 16h10a6 6 0 0 1 6 6v10" />
                    <path d="M72 56v10a6 6 0 0 1-6 6H56" />
                    <path d="M32 72H22a6 6 0 0 1-6-6V56" />
                    {/* Center Horizontal Scan Line */}
                    <line x1="20" y1="44" x2="68" y2="44" />
                  </svg>
                </span>
              </span>
            </span>
          </button>

          <h1 className="mt-7 text-[23px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            Scan QR Code
          </h1>
          <p className="mt-2 max-w-[250px] text-[14px] leading-relaxed text-slate-500 dark:text-slate-300">
            Scan parcel QR to update delivery status.
          </p>
        </div>

        {/* Bottom Orange & Navy Brand Wave Decoration */}
        <div className="pointer-events-none relative w-full shrink-0 leading-none" aria-hidden="true">
          <svg
            viewBox="0 0 390 120"
            preserveAspectRatio="none"
            className="block h-[96px] min-[390px]:h-[112px] w-full"
          >
            <defs>
              <linearGradient id="riderHomeWaveWarm" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffedd5" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#fdba74" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#fb923c" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="riderHomeWaveOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff6818" />
                <stop offset="55%" stopColor="#ee4d2d" />
                <stop offset="100%" stopColor="#d73211" />
              </linearGradient>
            </defs>
            {/* Soft peach/orange upper curve */}
            <path
              d="M0,48 C95,88 210,16 390,44 L390,120 L0,120 Z"
              fill="url(#riderHomeWaveWarm)"
            />
            {/* Primary SPX orange wave */}
            <path
              d="M0,26 C110,92 245,62 390,12 L390,120 L0,120 Z"
              fill="url(#riderHomeWaveOrange)"
            />
            {/* Clean arched white/dark cutout dipping gently to frame the elevated center Scan QR tab */}
            <path
              d="M0,120 L0,104 C120,74 270,74 390,104 L390,120 Z"
              className="fill-white dark:fill-[#0f172a]"
            />
          </svg>
        </div>
      </section>

      {/* =====================================================================
          DESKTOP / LAPTOP RIDER DASHBOARD (min-[821px] — 100% UNCHANGED)
      ===================================================================== */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Dashboard" />

        {/* BENTO OVERVIEW GRID (No Maps) */}
        <section className="mb-7 max-[600px]:mb-4 grid grid-cols-[1.85fr_1fr] items-stretch gap-5 max-[1150px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            <BentoKpiRow
              cards={[
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
              ]}
            />

            <PortalHeroBanner
              role="rider"
              pipeline={[
                { label: "To Deliver", count: stats.toDeliver, icon: "fa-truck-fast", to: "/rider/deliveries" },
                { label: "Delivered", count: stats.delivered, icon: "fa-circle-check", to: "/rider/deliveries?tab=delivered" },
                { label: "Rescheduled", count: rescheduledCount, icon: "fa-calendar-day", to: "/rider/deliveries" },
                { label: "Failed", count: stats.failed, icon: "fa-triangle-exclamation", to: "/rider/deliveries?tab=failed" },
              ]}
            />
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
