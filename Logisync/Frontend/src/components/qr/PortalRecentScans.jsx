import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import { EmptyState } from "../ui.jsx";
import { PanelTitle } from "../portal.jsx";
import { panel, stickyThead, tableScrollCompact, td, th } from "../styles.js";
import { formatDate } from "../../utils/format.js";

export default function PortalRecentScans({ role = "coordinator", scans = [], limit = 8 }) {
  const rows = scans.slice(0, limit);
  const isSeller = role === "seller";

  const linkOf = (s) =>
    isSeller
      ? `/seller/scan?txn=${encodeURIComponent(s.transaction_number)}`
      : `/verification?txn=${encodeURIComponent(s.transaction_number)}`;

  return (
    <section className={`mt-6 ${panel} overflow-hidden p-6 max-[600px]:p-4`}>
      <PanelTitle icon="history">Recent Scans</PanelTitle>
      {rows.length === 0 ? (
        <EmptyState
          icon="qr-code"
          title="No scans yet"
          text={
            isSeller
              ? "Parcels you scan or look up will appear here for quick access."
              : "Parcels you scan or look up for verification will appear here."
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 min-[821px]:hidden">
            {rows.map((s) => (
              <article
                key={`${s.parcel_id}-${s.at}-m`}
                className="rounded-xl border border-slate-200/85 bg-[#fafbfc] p-3.5 dark:border-night-line dark:bg-night-head/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate font-mono text-[13.5px] font-extrabold text-[#0f172a] dark:text-white">
                      {s.transaction_number}
                    </strong>
                    <span className="block truncate text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                      {s.receiver || "—"} · {isSeller ? s.contents || "—" : s.seller || "—"}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/75 pt-2 text-[11.5px] dark:border-night-line">
                  <span className="text-slate-400">{formatDate(s.at)}</span>
                  <Link to={linkOf(s)} className="font-bold text-brand hover:underline">
                    Open →
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className={`hidden min-[821px]:block ${tableScrollCompact}`}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead className={stickyThead}>
                <tr>
                  {[
                    "Transaction no.",
                    "Receiver",
                    isSeller ? "Contents" : "Seller",
                    "Status",
                    "Scanned",
                    "",
                  ].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={`${s.parcel_id}-${s.at}`}
                    className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                  >
                    <td className={`${td} whitespace-nowrap font-mono font-bold text-[#333] dark:text-[#f1eeeb]`}>
                      {s.transaction_number}
                    </td>
                    <td className={`${td} max-w-[160px] truncate`}>{s.receiver || "—"}</td>
                    <td className={`${td} max-w-[180px] truncate`}>{isSeller ? s.contents || "—" : s.seller || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-[13px]`}>{formatDate(s.at)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <Link to={linkOf(s)} className="font-semibold text-brand hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
