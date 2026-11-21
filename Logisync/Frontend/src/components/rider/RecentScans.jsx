import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import { EmptyState } from "../ui.jsx";
import { PanelTitle } from "../portal.jsx";
import { panel, stickyThead, tableScrollCompact, td, th } from "../styles.js";
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
    <section className={`${panel} overflow-hidden p-[30px] max-[600px]:p-4`}>
      <PanelTitle icon="fa-clock-rotate-left" action={action}>Recent Scans</PanelTitle>
      {rows.length === 0 ? (
        <EmptyState icon="fa-qrcode" title="No scans yet" text="Parcels you scan will show up here, then move to To Be Delivered." />
      ) : (
        <>
          {/* Mobile Cards View (max-[820px] ONLY) */}
          <div className="space-y-3 min-[821px]:hidden">
            {rows.map((s) => {
              const stage = stageOf(s);
              const badge = stageBadge[stage];
              return (
                <article
                  key={s.parcel_id}
                  className="rounded-xl border border-slate-200/85 bg-[#fafbfc] p-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.03)] dark:border-night-line dark:bg-night-head/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                        Transaction No.
                      </span>
                      <strong className="block truncate font-mono text-[14px] font-extrabold text-[#0f172a] dark:text-white">
                        {s.transaction_number}
                      </strong>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={s.status} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-400">Receiver</span>
                      <span className="block truncate font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                        {s.receiver || "—"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-400">Seller</span>
                      <span className="block truncate font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                        {s.seller || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/75 pt-2.5 dark:border-night-line">
                    <div className="flex flex-wrap items-center gap-2">
                      {badge ? (
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${badge[1]}`}>
                          {badge[0]}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-night-panel dark:text-[#b8b0a8]">
                          Not cleared
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {formatDate(s.at)}
                      </span>
                    </div>

                    <Link
                      to={`/rider/scan?txn=${encodeURIComponent(s.transaction_number)}`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand hover:underline"
                    >
                      <span>Check again</span>
                      <i className="fa-solid fa-arrow-right text-[10px]" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop Table View (min-[821px] — 100% unchanged) */}
          <div className={`hidden min-[821px]:block ${tableScrollCompact}`}>
            <table className="w-full min-w-[720px] border-collapse">
              <thead className={stickyThead}>
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
        </>
      )}
    </section>
  );
}
