import { useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import Pagination from "../../components/Pagination.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { PanelLink, PanelTitle } from "../../components/portal.jsx";
import { btnPrimary, panel, td, th } from "../../components/styles.js";
import BentoKpiRow from "../../components/dashboard/BentoKpiRow.jsx";
import PortalHeroBanner from "../../components/dashboard/PortalHeroBanner.jsx";
import DashboardRightRail from "../../components/dashboard/DashboardRightRail.jsx";
import RecentActivity from "../../components/audit/RecentActivity.jsx";
import { useRiderScans } from "../../store/riderScans.js";
import { riderCounts } from "../../utils/stats.js";
import { useAssignedParcels, useMyDeliveries } from "../../store/riderDeliveries.js";

const PAGE_SIZE = 5;

// Dashboard ng rider: Assigned Parcels (i-scan ang QR) -> Recent Scans -> To Be Delivered -> Delivered / Failed.
export default function RiderDashboard() {
  const scans = useRiderScans();
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();
  const [page, setPage] = useState(1);

  const stats = riderCounts(assigned, mine);
  const safePage = Math.min(page, Math.max(1, Math.ceil(assigned.length / PAGE_SIZE)));
  const rows = assigned.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  return (
    <>
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
                to: "/rider/parcels",
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
              { label: "Assigned", count: assigned.length, icon: "fa-box-open", to: "/rider/parcels" },
              { label: "To Deliver", count: stats.toDeliver, icon: "fa-truck-fast", to: "/rider/deliveries" },
              { label: "Delivered", count: stats.delivered, icon: "fa-circle-check", to: "/rider/deliveries?tab=delivered" },
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

      <section className={`${panel} mb-7 max-[600px]:mb-4 overflow-hidden p-[30px] max-[600px]:p-4`}>
        <PanelTitle icon="fa-box-open">Assigned Parcels</PanelTitle>
        <p className="-mt-3 mb-4 text-[13px] text-[#999]">Parcels the coordinator assigned to you. Scan each parcel's QR code to start its delivery.</p>
        {assigned.length === 0 ? (
          <EmptyState icon="fa-box-open" title="No assigned parcels" text="New parcels from the coordinator will show up here." />
        ) : (
          <>
            {/* Desktop & Tablet Table */}
            <div className="hidden min-[701px]:block overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-[#fafafa] dark:bg-night-head">
                  <tr>{["Parcel", "Receiver", "Address", "Seller", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                      <td className={`${td} whitespace-nowrap`}>
                        <strong className="block text-[#333] dark:text-[#f1eeeb]">{p.parcel_id}</strong>
                        <span className="text-[12px] text-[#aaa]">{p.contents}</span>
                      </td>
                      <td className={td}>{p.receiver}</td>
                      <td className={`${td} max-w-[240px]`}>{p.address}</td>
                      <td className={td}>{p.seller}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Link to={`/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`} className={btnPrimary}>
                          <i className="fa-solid fa-qrcode" /> Scan QR
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="min-[701px]:hidden space-y-3">
              {rows.map((p) => (
                <article key={p.parcel_id} className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{p.parcel_id}</strong>
                      <span className="block text-[12px] text-[#888]">{p.contents}</span>
                    </div>
                    <Link
                      to={`/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-bold text-white"
                    >
                      <i className="fa-solid fa-qrcode" /> Scan QR
                    </Link>
                  </div>
                  <div className="mt-3 space-y-1 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                    <p><i className="fa-regular fa-user mr-1.5 text-[#999]" /><strong className="text-[#333] dark:text-[#f1eeeb]">{p.receiver}</strong></p>
                    <p className="flex items-start gap-1.5 text-[12.5px]"><i className="fa-solid fa-location-dot mt-0.5 text-brand" /><span>{p.address}</span></p>
                    <p className="text-[12px] text-[#999]">Seller: {p.seller}</p>
                  </div>
                </article>
              ))}
            </div>

            <Pagination page={safePage} pageSize={PAGE_SIZE} total={assigned.length} onPage={setPage} />
          </>
        )}
      </section>

      <div className="mb-7 max-[600px]:mb-4"><RecentScans scans={scans} action={<PanelLink to="/rider/scan">Scan</PanelLink>} /></div>

      <RecentActivity to="/rider/activity" />
    </>
  );
}
