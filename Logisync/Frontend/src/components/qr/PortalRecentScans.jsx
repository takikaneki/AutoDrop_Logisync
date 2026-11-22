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
    <section className={`hidden min-[821px]:block mt-6 ${panel} overflow-hidden p-[30px]`}>
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
        <div className={tableScrollCompact}>
          <table className="w-full min-w-[680px] border-collapse">
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
                  <td className={`${td} whitespace-nowrap font-bold text-[#333] dark:text-[#f1eeeb]`}>
                    {s.transaction_number}
                  </td>
                  <td className={td}>{s.receiver || "—"}</td>
                  <td className={td}>{isSeller ? s.contents || "—" : s.seller || "—"}</td>
                  <td className={td}>
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
      )}
    </section>
  );
}
