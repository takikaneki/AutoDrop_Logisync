import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import Pagination from "../../components/Pagination.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { btnPrimary, panel, td, th } from "../../components/styles.js";
import { STAGE, useAssignedParcels, useMyDeliveries } from "../../store/riderDeliveries.js";
import { formatDate } from "../../utils/format.js";

const PAGE_SIZE = 10;

const BADGE = {
  waiting: ["Waiting to be scanned", "bg-[#fff4d8] text-[#c98200]"],
  [STAGE.TO_DELIVER]: ["To be delivered", "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"],
  [STAGE.DELIVERED]: ["Delivered", "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"],
  [STAGE.FAILED]: ["Failed", "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"],
};

const TABS = [
  ["all", "All"],
  ["waiting", "Waiting to be scanned"],
  [STAGE.TO_DELIVER, "To Be Delivered"],
  [STAGE.DELIVERED, "Delivered"],
  [STAGE.FAILED, "Failed"],
];

const ACTION = {
  waiting: (p) => ({ to: `/rider/scan?expect=${encodeURIComponent(p.parcel_id)}`, label: "Scan QR", primary: true }),
  [STAGE.TO_DELIVER]: () => ({ to: "/rider/deliveries", label: "Open" }),
  [STAGE.DELIVERED]: () => ({ to: "/rider/deliveries?tab=delivered", label: "View" }),
  [STAGE.FAILED]: () => ({ to: "/rider/deliveries?tab=failed", label: "View" }),
};

// Lahat ng parcel na naka-assign sa rider (waiting + to be delivered + delivered + failed).
// Pareho ang pinagkukunan ng data at bilang ng Dashboard cards, kaya laging tugma. /rider/parcels?status=all|waiting|to_deliver|delivered|failed
export default function RiderParcels() {
  const assigned = useAssignedParcels();
  const mine = useMyDeliveries();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const filter = TABS.some(([k]) => k === params.get("status")) ? params.get("status") : "all";

  const all = useMemo(
    () => [
      ...assigned.map((p) => ({ ...p, stage: "waiting", at: new Date(p.updated_at).getTime() })),
      ...mine.map((d) => ({ ...d, at: d.doneAt || d.scannedAt })),
    ].sort((a, b) => (b.at || 0) - (a.at || 0)),
    [assigned, mine]
  );
  const count = (k) => (k === "all" ? all.length : all.filter((p) => p.stage === k).length);
  const list = filter === "all" ? all : all.filter((p) => p.stage === filter);
  const safePage = Math.min(page, Math.max(1, Math.ceil(list.length / PAGE_SIZE)));
  const rows = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pick = (k) => {
    setPage(1);
    setParams(k === "all" ? {} : { status: k }, { replace: true });
  };

  return (
    <>
      <Topbar title="My Parcels" subtitle="Every parcel assigned to you and where it is now.">
        <Link to="/rider/scan" className={btnPrimary}><i className="fa-solid fa-qrcode" /> Scan QR Code</Link>
      </Topbar>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => pick(k)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${filter === k ? "bg-brand text-white" : "border border-[#eee] bg-white text-[#777] hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"}`}
          >
            {label} ({count(k)})
          </button>
        ))}
      </div>

      <section className={`${panel} overflow-hidden p-[26px] max-[600px]:p-5`}>
        {list.length === 0 ? (
          <EmptyState icon="fa-box-open" title="No parcels here" text={filter === "all" ? "Parcels the coordinator assigns to you will show up here." : "Nothing matches this filter yet."} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-[#fafafa] dark:bg-night-head">
                  <tr>{["Parcel", "Receiver", "Address", "Seller", "Status", "Updated", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const [label, cls] = BADGE[p.stage];
                    const a = ACTION[p.stage](p);
                    return (
                      <tr key={p.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                        <td className={`${td} whitespace-nowrap`}>
                          <strong className="block text-[#333] dark:text-[#f1eeeb]">{p.transaction_number || p.parcel_id}</strong>
                          <span className="text-[12px] text-[#aaa]">{p.contents || "—"}</span>
                        </td>
                        <td className={td}>{p.receiver || "—"}</td>
                        <td className={`${td} max-w-[240px]`}>{p.address || "—"}</td>
                        <td className={td}>{p.seller || "—"}</td>
                        <td className={td}><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>{label}</span></td>
                        <td className={`${td} whitespace-nowrap`}>{p.at ? formatDate(p.at) : "—"}</td>
                        <td className={`${td} whitespace-nowrap text-right`}>
                          {a.primary ? (
                            <Link to={a.to} className={btnPrimary}><i className="fa-solid fa-qrcode" /> {a.label}</Link>
                          ) : (
                            <Link to={a.to} className="font-semibold text-brand hover:underline">{a.label}</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
