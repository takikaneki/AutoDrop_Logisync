import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import { EmptyState } from "../ui.jsx";
import { PanelTitle } from "../portal.jsx";
import { panel, td, th } from "../styles.js";
import { formatDate } from "../../utils/format.js";
import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";

const stageBadge = {
  [STAGE.TO_DELIVER]: ["To be delivered", "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"],
  [STAGE.DELIVERED]: ["Delivered", "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"],
  [STAGE.FAILED]: ["Failed", "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"],
};

// Mga huling na-scan ng rider (device na ito). Ang "Delivery" column ay nagpapakita kung nasaan na ang parcel
// (To be delivered / Delivered / Failed). limit = ilan ang ipapakita.
export default function RecentScans({ scans, limit = 5, action }) {
  const deliveries = useMyDeliveries();
  const stageOf = (s) => deliveries.find((d) => d.parcel_id === s.parcel_id)?.stage;
  const rows = scans.slice(0, limit);

  return (
    <section className={`${panel} overflow-hidden p-[30px] max-[600px]:p-5`}>
      <PanelTitle icon="fa-clock-rotate-left" action={action}>Recent Scans</PanelTitle>
      {rows.length === 0 ? (
        <EmptyState icon="fa-qrcode" title="No scans yet" text="Parcels you scan will show up here, then move to To Be Delivered." />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>{["Transaction no.", "Receiver", "Seller", "Verification", "Delivery", "Scanned", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const stage = stageOf(s);
                const badge = stageBadge[stage];
                return (
                  <tr key={s.parcel_id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>{s.transaction_number}</td>
                    <td className={td}>{s.receiver || "—"}</td>
                    <td className={td}>{s.seller || "—"}</td>
                    <td className={td}><StatusBadge status={s.status} /></td>
                    <td className={td}>
                      {badge ? (
                        <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${badge[1]}`}>{badge[0]}</span>
                      ) : (
                        <span className="text-[12px] text-[#aaa]">Not cleared</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(s.at)}</td>
                    <td className={`${td} text-right`}>
                      <Link to={`/rider/scan?txn=${encodeURIComponent(s.transaction_number)}`} className="font-semibold text-brand hover:underline">Check again</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
