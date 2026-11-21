import { useEffect, useState } from "react";
import StatusBadge from "../StatusBadge.jsx";
import ScanPanel from "../qr/ScanPanel.jsx";
import CoordinatorRthModal from "./CoordinatorRthModal.jsx";
import { EmptyState, Modal } from "../ui.jsx";
import { btnGhost, btnPrimary, panel } from "../styles.js";
import { fetchCoordinatorRth, findParcel } from "../../services/parcelService.js";
import { formatDate } from "../../utils/format.js";
import { toast } from "../../store/toast.js";

export default function CoordinatorRthSection() {
  const [data, setData] = useState({ pending: [], confirmed: [], counts: { pending: 0, confirmed: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending"); // "pending" | "confirmed"
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [scanError, setScanError] = useState("");

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

  const handleScanValue = async (val) => {
    setScanError("");
    const cleanVal = String(val || "").trim().toLowerCase();
    // Search in pending or confirmed list first
    const match =
      data.pending.find(
        (p) =>
          String(p.transaction_number || "").toLowerCase() === cleanVal ||
          String(p.parcel_id || "").toLowerCase() === cleanVal
      ) ||
      data.confirmed.find(
        (p) =>
          String(p.transaction_number || "").toLowerCase() === cleanVal ||
          String(p.parcel_id || "").toLowerCase() === cleanVal
      );

    if (match) {
      setScannerOpen(false);
      setSelectedParcel(match);
      return;
    }

    // Try finding via findParcel API
    try {
      const res = await findParcel(val, "coordinator");
      if (res?.parcel) {
        setScannerOpen(false);
        setSelectedParcel(res.parcel);
      } else {
        setScanError(`Parcel with QR ${val} not found in Return to Hub queue.`);
      }
    } catch (err) {
      setScanError(err.message || `No parcel found matching QR code.`);
    }
  };

  const list = tab === "pending" ? data.pending : data.confirmed;

  return (
    <section className={`${panel} mb-7 p-6 max-[600px]:p-4`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4 dark:border-night-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[19px] font-bold text-[#1e293b] dark:text-white">
              <i className="fa-solid fa-warehouse mr-2 text-[#7c3aed]" />
              Return to Hub (RTH) Verification
            </h2>
            {data.counts.pending > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {data.counts.pending} Awaiting Hub Arrival
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[#64748b] dark:text-[#9c948c]">
            Track rider returns in transit and scan the unified QR code upon physical receipt at the hub.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className={`${btnPrimary} !bg-[#7c3aed] hover:!bg-[#6d28d9]`}
          >
            <i className="fa-solid fa-qrcode mr-1.5" /> Scan Return QR
          </button>
          <button
            type="button"
            onClick={loadRth}
            className={`${btnGhost} h-9 w-9 !p-0`}
            title="Refresh list"
            aria-label="Refresh list"
          >
            <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs: Pending vs Confirmed */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition ${
            tab === "pending"
              ? "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-950/40 dark:text-orange-300"
              : "bg-transparent text-[#64748b] hover:bg-[#f1f5f9] dark:text-[#9c948c] dark:hover:bg-night-line"
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left" />
          <span>Pending Physical Return</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold text-[#c2410c] dark:bg-night-panel dark:text-orange-300">
            {data.counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("confirmed")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition ${
            tab === "confirmed"
              ? "bg-[#f3e8ff] text-[#7e22ce] dark:bg-purple-950/40 dark:text-purple-300"
              : "bg-transparent text-[#64748b] hover:bg-[#f1f5f9] dark:text-[#9c948c] dark:hover:bg-night-line"
          }`}
        >
          <i className="fa-solid fa-circle-check" />
          <span>Confirmed at Hub</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold text-[#7e22ce] dark:bg-night-panel dark:text-purple-300">
            {data.counts.confirmed}
          </span>
        </button>
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="py-12 text-center text-[13px] text-[#64748b]">
          <i className="fa-solid fa-circle-notch fa-spin mr-2 text-brand" />
          Loading Return to Hub parcels…
        </div>
      ) : list.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon="fa-warehouse"
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
                            ? "Return to Hub – Pending Confirmation"
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
                            <i className="fa-solid fa-check mr-1" /> Confirm
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

      {/* QR Scanner Modal for Hub Verification */}
      <Modal
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScanError("");
        }}
        z="z-[3500]"
        className="w-full max-w-[420px] p-6 text-center dark:bg-night-panel"
      >
        <div className="mb-3 flex items-center justify-between text-left">
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">
            Scan Return to Hub QR Code
          </h3>
          <button
            onClick={() => setScannerOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
        <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#9c948c]">
          Scan the parcel's permanent unified QR code to verify physical return at the hub.
        </p>
        <ScanPanel onValue={handleScanValue} />
        {scanError && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12.5px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
            <i className="fa-solid fa-triangle-exclamation mr-1.5" />
            {scanError}
          </div>
        )}
      </Modal>

      {/* Coordinator RTH Physical Confirmation Modal */}
      {selectedParcel && (
        <CoordinatorRthModal
          parcel={selectedParcel}
          open={!!selectedParcel}
          onClose={() => setSelectedParcel(null)}
          onConfirmed={(updated) => {
            loadRth();
          }}
        />
      )}
    </section>
  );
}
