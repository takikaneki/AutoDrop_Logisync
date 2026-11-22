import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import CoordinatorRthModal from "./CoordinatorRthModal.jsx";
import { EmptyState } from "../ui.jsx";
import { btnGhost, btnPrimary, panel } from "../styles.js";
import { fetchCoordinatorRth } from "../../services/parcelService.js";
import { formatDate } from "../../utils/format.js";
import Icon from "../Icon.jsx";

export default function CoordinatorRthSection() {
  const [data, setData] = useState({ pending: [], confirmed: [], counts: { pending: 0, confirmed: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending"); // "pending" | "confirmed"
  const [selectedParcel, setSelectedParcel] = useState(null);

  const loadRth = async () => {
    try {
      setLoading(true);
      const res = await fetchCoordinatorRth();
      if (res?.success) {
        setData({
          pending: res.pending || [],
          confirmed: res.confirmed || [],
          counts: res.counts || {
            pending: res.pending?.length || 0,
            confirmed: res.confirmed?.length || 0,
            total: (res.pending?.length || 0) + (res.confirmed?.length || 0),
          },
        });
      }
    } catch {
      // silently handle or empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRth();
  }, []);

  const list = tab === "pending" ? data.pending : data.confirmed;

  return (
    <section className={`${panel} mb-7 p-6 max-[600px]:p-4`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4 dark:border-night-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[19px] font-bold text-[#1e293b] dark:text-white">
              <Icon name="undo-2" className="mr-2 text-[#7c3aed]" />
              Return to Hub (RTH) Physical Verification
            </h2>
            {data.counts.pending > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {data.counts.pending} Awaiting Hub Arrival
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[#64748b] dark:text-[#9c948c]">
            Monitor rider returns in transit and verify physical arrival at the hub using the Unified QR Scanner.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/verification?scan=1"
            className={`${btnPrimary} !bg-[#7c3aed] hover:!bg-[#6d28d9]`}
            title="Open the Unified QR Scanner to verify returned parcels"
          >
            <Icon name="qr-code" className="mr-1.5" /> Scan Unified QR
          </Link>
          <button
            type="button"
            onClick={loadRth}
            className={`${btnGhost} h-9 w-9 !p-0`}
            title="Refresh list"
            aria-label="Refresh list"
          >
            <Icon name="refresh-cw" className={`${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs: Pending vs Confirmed */}
      <div className="mb-4 grid grid-cols-2 items-stretch gap-2.5 sm:inline-flex sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-[12.5px] sm:px-4 sm:py-2 sm:text-[13px] font-bold leading-snug transition ${
            tab === "pending"
              ? "border-[#fde047] bg-[#fef9c3] text-[#a16207] dark:border-yellow-500/40 dark:bg-yellow-500/15 dark:text-[#facc15]"
              : "border-slate-200/80 bg-slate-50/70 text-[#64748b] hover:bg-[#f1f5f9] dark:border-night-line dark:bg-night-head/60 dark:text-[#9c948c] dark:hover:bg-night-line"
          }`}
        >
          <Icon name="clock" className="shrink-0" />
          <span className="min-w-0">Pending Arrival</span>
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-xs font-extrabold text-[#a16207] dark:bg-night-panel dark:text-[#facc15]">
            {data.counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("confirmed")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-[12.5px] sm:px-4 sm:py-2 sm:text-[13px] font-bold leading-snug transition ${
            tab === "confirmed"
              ? "border-[#bbf7d0] bg-[#dcfce7] text-[#15803d] dark:border-green-500/40 dark:bg-green-500/15 dark:text-[#4ade80]"
              : "border-slate-200/80 bg-slate-50/70 text-[#64748b] hover:bg-[#f1f5f9] dark:border-night-line dark:bg-night-head/60 dark:text-[#9c948c] dark:hover:bg-night-line"
          }`}
        >
          <Icon name="circle-check" className="shrink-0" />
          <span className="min-w-0">Confirmed at Hub</span>
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-xs font-extrabold text-[#15803d] dark:bg-night-panel dark:text-[#4ade80]">
            {data.counts.confirmed}
          </span>
        </button>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="py-12 text-center text-[13px] text-[#64748b]">
          <Icon name="loader-2" className="mr-2 text-brand animate-spin" />
          Loading Return to Hub parcels…
        </div>
      ) : list.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon="undo-2"
            title={tab === "pending" ? "No pending returns awaiting arrival" : "No confirmed returns yet"}
            text={
              tab === "pending"
                ? "Parcels marked for Return to Hub by riders will appear here until physically confirmed at the hub."
                : "Confirmed returns will be preserved here with complete custody history."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e5e7eb] dark:border-night-line">
          <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
            <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:bg-night-head dark:text-[#9c948c]">
              <tr>
                <th className="px-4 py-3">Transaction Number</th>
                <th className="px-4 py-3">Assigned Rider</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Return Reason</th>
                <th className="px-4 py-3">{tab === "pending" ? "Marked For Return" : "Confirmed Date"}</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] text-[#334155] dark:divide-night-line dark:text-[#d1c9c2]">
              {list.map((p) => {
                const key = p.parcel_id || p.transaction_number;
                return (
                  <tr key={key} className="hover:bg-[#f8fafc] dark:hover:bg-night-head/50">
                    <td className="px-4 py-3.5 font-mono font-bold text-[#1e293b] dark:text-white">
                      {p.transaction_number || p.parcel_id}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-[#1e293b] dark:text-white">
                        {p.assigned_rider_name || p.rider_name || "Rider"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span>{p.seller_name || p.seller || "Seller"}</span>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px] truncate" title={p.rth_reason || p.return_note}>
                      <span className="font-semibold text-rose-700 dark:text-rose-400">
                        {p.rth_reason || p.return_note || "Buyer Refused / Cancelled"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#64748b] dark:text-[#9c948c]">
                      {tab === "pending"
                        ? formatDate(p.rth_requested_at || p.updated_at)
                        : formatDate(p.rth_confirmed_at || p.updated_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={
                          tab === "pending"
                            ? "Return to Hub"
                            : "Return to Hub – Confirmed"
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedParcel(p)}
                        className={
                          tab === "pending"
                            ? "rounded-lg bg-[#7c3aed] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d28d9]"
                            : `${btnGhost} !px-3 !py-1 text-xs`
                        }
                      >
                        {tab === "pending" ? (
                          <>
                            <Icon name="check" className="mr-1" /> Verify Arrival
                          </>
                        ) : (
                          "View Record"
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Coordinator RTH Physical Confirmation Modal */}
      {selectedParcel && (
        <CoordinatorRthModal
          parcel={selectedParcel}
          open={!!selectedParcel}
          onClose={() => setSelectedParcel(null)}
          onConfirmed={() => {
            loadRth();
          }}
        />
      )}
    </section>
  );
}
