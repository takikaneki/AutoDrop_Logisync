import { useState } from "react";
import { Modal } from "../ui.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, textareaCls } from "../styles.js";
import { confirmCoordinatorRth } from "../../services/parcelService.js";
import { formatDate } from "../../utils/format.js";
import { toast } from "../../store/toast.js";

export default function CoordinatorRthModal({ parcel, open, onClose, onConfirmed }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!parcel) return null;

  const txn = parcel.transaction_number || parcel.parcel_id || "—";
  const parcelId = parcel.parcel_id || parcel.transaction_number;
  const isConfirmed =
    parcel.rth_status === "CONFIRMED" ||
    parcel.status === "RTH_CONFIRMED" ||
    parcel.status === "Return to Hub – Confirmed";

  const riderName =
    parcel.assigned_rider_name ||
    parcel.rider_name ||
    parcel.rider ||
    "Rider";
  const sellerName = parcel.seller_name || parcel.seller || "Seller";
  const returnReason =
    parcel.rth_reason ||
    parcel.return_note ||
    parcel.lastFailure ||
    "Buyer Cancelled / Refused Delivery";
  const requestedAt = parcel.rth_requested_at || parcel.updated_at;
  const confirmedAt = parcel.rth_confirmed_at;
  const confirmedNotes = parcel.rth_confirmed_notes;

  const handleConfirm = async () => {
    if (isConfirmed) {
      toast("This parcel has already been confirmed at the Hub.", "info");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await confirmCoordinatorRth(parcelId, { notes: notes.trim() });
      if (res?.success) {
        toast(`Parcel ${txn} successfully confirmed as Returned to Hub.`, "success");
        if (onConfirmed) onConfirmed(res.parcel || { ...parcel, rth_status: "CONFIRMED", status: "RTH_CONFIRMED" });
        onClose();
      } else {
        setError(res?.message || "Failed to confirm return to hub.");
      }
    } catch (err) {
      setError(err.message || "Failed to confirm return to hub.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      z="z-[3500]"
      className="max-h-[90vh] w-full max-w-[500px] overflow-y-auto p-6 dark:bg-night-panel"
    >
      <div className="flex items-center justify-between border-b border-[#eee] pb-3.5 dark:border-night-line">
        <div>
          <h3 className="text-[18px] font-bold text-[#1e293b] dark:text-white">
            Return to Hub Physical Verification
          </h3>
          <p className="text-[12px] text-[#64748b] dark:text-[#9c948c]">
            Coordinator custody confirmation for returned parcel
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] hover:text-[#1e293b] dark:bg-night-line dark:hover:text-white"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Top Status & Txn */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8fafc] p-3.5 dark:bg-night-soft">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#9c948c]">
              Transaction Number
            </span>
            <span className="font-mono text-[16px] font-bold text-[#1e293b] dark:text-white">
              {txn}
            </span>
          </div>
          <div>
            <StatusBadge
              status={
                isConfirmed
                  ? "Return to Hub – Confirmed"
                  : "Return to Hub – Pending Confirmation"
              }
            />
          </div>
        </div>

        {/* Parcel Details */}
        <div className="space-y-2 rounded-xl border border-[#e5e7eb] p-3.5 text-[13px] dark:border-night-line">
          <div className="grid grid-cols-[130px_1fr] gap-2">
            <span className="text-[#64748b] dark:text-[#9c948c]">Assigned Rider:</span>
            <span className="font-semibold text-[#1e293b] dark:text-white">{riderName}</span>

            <span className="text-[#64748b] dark:text-[#9c948c]">Seller:</span>
            <span className="font-semibold text-[#1e293b] dark:text-white">{sellerName}</span>

            <span className="text-[#64748b] dark:text-[#9c948c]">Receiver:</span>
            <span className="text-[#1e293b] dark:text-white">{parcel.receiver_name || parcel.receiver || "—"}</span>

            <span className="text-[#64748b] dark:text-[#9c948c]">Contents:</span>
            <span className="text-[#1e293b] dark:text-white">{parcel.contents || "—"}</span>

            <span className="text-[#64748b] dark:text-[#9c948c]">Return Reason:</span>
            <span className="font-semibold text-[#b91c1c] dark:text-[#f87171]">{returnReason}</span>

            <span className="text-[#64748b] dark:text-[#9c948c]">RTH Requested:</span>
            <span className="text-[#1e293b] dark:text-white">
              {requestedAt ? formatDate(requestedAt) : "—"}
            </span>

            {isConfirmed && confirmedAt && (
              <>
                <span className="text-[#64748b] dark:text-[#9c948c]">Hub Confirmed:</span>
                <span className="font-bold text-[#7c3aed] dark:text-[#c4b5fd]">
                  {formatDate(confirmedAt)}
                </span>
              </>
            )}

            {isConfirmed && confirmedNotes && (
              <>
                <span className="text-[#64748b] dark:text-[#9c948c]">Hub Notes:</span>
                <span className="italic text-[#1e293b] dark:text-white">"{confirmedNotes}"</span>
              </>
            )}
          </div>
        </div>

        {/* Confirmation status message */}
        {isConfirmed ? (
          <div className="rounded-xl border border-[#c4b5fd] bg-[#f5f3ff] p-3 text-[13px] text-[#6d28d9] dark:border-[#5b21b6] dark:bg-[#241b35] dark:text-[#c4b5fd]">
            <i className="fa-solid fa-circle-check mr-2 font-bold" />
            <strong>Physical Return Confirmed:</strong> This parcel has been safely received and confirmed at the Hub. No further action is required.
          </div>
        ) : (
          <div>
            <label className={labelCls} htmlFor="hubNotes">
              Coordinator Hub Notes (Optional or for condition remarks)
            </label>
            <textarea
              id="hubNotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={textareaCls}
              placeholder="e.g. Package received intact at Bay 3; no seal tampering."
            />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <i className="fa-solid fa-circle-exclamation mr-1.5" />
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button type="button" onClick={onClose} className={btnGhost}>
          Close
        </button>
        {!isConfirmed && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`${btnPrimary} !bg-[#7c3aed] hover:!bg-[#6d28d9]`}
          >
            <i className="fa-solid fa-warehouse mr-1.5" />
            {busy ? "Confirming…" : "Confirm Returned to Hub"}
          </button>
        )}
      </div>
    </Modal>
  );
}
