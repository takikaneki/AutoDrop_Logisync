import { useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import Pagination from "../../components/Pagination.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { PanelLink, PanelTitle, StatCard, StatGrid } from "../../components/portal.jsx";
import { btnPrimary, panel, td, th } from "../../components/styles.js";
import DashboardShortcuts from "../../components/dashboard/DashboardShortcuts.jsx";
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

  return (
    <>
      <Topbar title="Dashboard" />

      <DashboardShortcuts role="rider" />
      <StatGrid>
        <StatCard label="Total Parcels" value={stats.total} icon="fa-box" tone="orange" to="/rider/parcels" />
        <StatCard label="To Be Delivered" value={stats.toDeliver} icon="fa-truck-fast" tone="blue" to="/rider/deliveries" />
        <StatCard label="Delivered" value={stats.delivered} icon="fa-circle-check" tone="green" to="/rider/deliveries?tab=delivered" />
        <StatCard label="Failed Delivery" value={stats.failed} icon="fa-triangle-exclamation" tone="red" to="/rider/deliveries?tab=failed" />
      </StatGrid>

      <section className={`${panel} mb-7 overflow-hidden p-[30px] max-[600px]:p-5`}>
        <PanelTitle icon="fa-box-open">Assigned Parcels</PanelTitle>
        <p className="-mt-3 mb-4 text-[13px] text-[#999]">Parcels the coordinator assigned to you. Scan each parcel's QR code to start its delivery.</p>
        {assigned.length === 0 ? (
          <EmptyState icon="fa-box-open" title="No assigned parcels" text="New parcels from the coordinator will show up here." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
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
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={assigned.length} onPage={setPage} />
          </>
        )}
      </section>

      <div className="mb-7"><RecentScans scans={scans} action={<PanelLink to="/rider/scan">Scan</PanelLink>} /></div>

      <RecentActivity to="/rider/activity" />
    </>
  );
}
