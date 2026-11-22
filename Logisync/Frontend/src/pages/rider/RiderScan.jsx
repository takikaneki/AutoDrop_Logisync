import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { CodBadge, Modal } from "../../components/ui.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import { DetailList, Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, textareaCls } from "../../components/styles.js";
import {
  scanUnifiedQr,
  findParcel,
  riderRescheduleParcel,
  riderRequestRth,
} from "../../services/parcelService.js";
import { logScan, useRiderScans } from "../../store/riderScans.js";
import {
  addToDeliver,
  findAssigned,
  markDelivered,
  syncRiderDeliveriesWithServer,
  todayIso,
  addDaysIso,
} from "../../store/riderDeliveries.js";
import { compressImage } from "../../utils/image.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { toast } from "../../store/toast.js";
import Icon from "../../components/Icon.jsx";

const RTH_REASONS = [
  "Recipient Refused Parcel",
  "Buyer refused delivery",
  "Buyer cancelled order",
  "Incorrect address / Cannot be located",
  "Damaged item upon arrival",
  "Other valid return reasons",
];

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function RiderScan() {
  const [params, setParams] = useSearchParams();
  const scans = useRiderScans();
  const [parcel, setParcel] = useState(null);
  const [scanContext, setScanContext] = useState(null);
  const [outcome, setOutcome] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  // Modals for Rider Actions
  const [actionModal, setActionModal] = useState(null); // "delivered" | "reschedule" | "rth"
  const [proof, setProof] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const [rthReason, setRthReason] = useState(RTH_REASONS[0]);
  const [actionNotes, setActionNotes] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const expect = params.get("expect");
  const autoStart = params.get("auto") === "1";

  const lookup = async (value) => {
    setLooking(true);
    setError("");
    try {
      // 1. Try unified scan API first
      let scanData = null;
      let p = null;
      try {
        scanData = await scanUnifiedQr(value);
        if (scanData?.parcel) {
          p = scanData.parcel;
          setScanContext(scanData);
        }
      } catch {
        // Fallback to legacy findParcel / local store
        try {
          const res = await findParcel(value, "rider");
          p = res?.parcel;
        } catch (serverErr) {
          const local = findAssigned(value);
          if (local) p = local;
          else throw serverErr;
        }
      }

      if (!p) throw new Error("Parcel not found.");

      if (expect && !same(p.parcel_id, expect) && !same(p.transaction_number, expect)) {
        setParcel(null);
        setError(`That QR is for a different parcel. Please scan the QR of ${expect}.`);
        return;
      }

      setParcel(p);
      logScan(p, value);

      // Only add to active delivery queue if verified and not RTH
      if (
        p.status !== "RTH_PENDING" &&
        p.status !== "RTH_CONFIRMED" &&
        p.status !== "DELIVERED" &&
        p.rth_status !== "PENDING_CONFIRMATION" &&
        p.rth_status !== "CONFIRMED"
      ) {
        setOutcome(addToDeliver(p, value));
      }
    } catch (err) {
      setParcel(null);
      setError(err.message || "Failed to find parcel.");
    } finally {
      setLooking(false);
    }
  };

  useEffect(() => {
    syncRiderDeliveriesWithServer();
    const txn = params.get("txn");
    if (txn) lookup(txn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setParcel(null);
    setScanContext(null);
    setOutcome("");
    setError("");
    params.delete("txn");
    params.delete("expect");
    params.delete("auto");
    setParams(params, { replace: true });
  };

  const pickProofPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofBusy(true);
    setActionError("");
    try {
      setProof(await compressImage(file));
    } catch (err) {
      setProof("");
      setActionError(err.message || "Failed to process photo.");
    } finally {
      setProofBusy(false);
    }
  };

  // Action: Mark as Delivered
  const handleDeliveredSubmit = async () => {
    if (!proof) {
      setActionError("Please upload or capture a photo as proof of delivery.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      const pid = parcel.parcel_id || parcel.transaction_number;
      await markDelivered(pid, { proof, note: actionNotes.trim() });
      toast(`${parcel.transaction_number} marked as delivered!`, "success");
      setParcel((prev) => ({
        ...prev,
        status: "DELIVERED",
        delivery_status: "DELIVERED",
        delivered_at: new Date().toISOString(),
      }));
      setActionModal(null);
    } catch (err) {
      setActionError(err.message || "Failed to complete delivery.");
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Buyer Unavailable (Reschedule for Delivery)
  const handleRescheduleSubmit = async () => {
    setActionBusy(true);
    setActionError("");
    try {
      const pid = parcel.parcel_id || parcel.transaction_number;
      const nextDay = addDaysIso(todayIso(), 1);
      const res = await riderRescheduleParcel(pid, {
        reason: "Buyer Unavailable",
        scheduledFor: nextDay,
        notes: actionNotes.trim(),
      });
      if (res?.success) {
        if (res.rth_required || res.status === "RETURN_TO_HUB" || res.status === "RTH_PENDING") {
          toast(
            `${parcel.transaction_number} reached maximum next-day delivery attempts (2 attempts). Automatically marked for Return to Hub.`,
            "error"
          );
          setParcel((prev) => ({
            ...prev,
            status: "RETURN_TO_HUB",
            rth_status: "PENDING",
            rth_reason: "Maximum delivery attempts reached",
          }));
        } else {
          toast(
            `${parcel.transaction_number} rescheduled for next delivery day (${formatDay(nextDay)}). Attempt count recorded.`,
            "info"
          );
          setParcel((prev) => ({
            ...prev,
            status: "RESCHEDULED",
            rescheduled: true,
            scheduledFor: nextDay,
            next_day_attempt_count: res.next_day_attempt_count ?? (Number(prev.next_day_attempt_count || 0) + 1),
            rescheduleCount: Number(prev.rescheduleCount || 0) + 1,
          }));
        }
        syncRiderDeliveriesWithServer();
        setActionModal(null);
      } else {
        setActionError(res?.message || "Failed to reschedule delivery.");
      }
    } catch (err) {
      setActionError(err.message || "Failed to reschedule delivery.");
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Return to Hub (RTH) - Buyer Cancelled / Refused / Damaged
  const handleRthSubmit = async () => {
    if (!rthReason) {
      setActionError("Please select a valid return reason.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      const pid = parcel.parcel_id || parcel.transaction_number;
      const res = await riderRequestRth(pid, {
        reason: rthReason,
        notes: actionNotes.trim(),
      });
      if (res?.success) {
        toast(
          `${parcel.transaction_number} marked for Return to Hub. Removed from active queue.`,
          "error"
        );
        setParcel((prev) => ({
          ...prev,
          status: "RETURN_TO_HUB",
          rth_status: "PENDING",
          rth_reason: rthReason,
          rth_requested_at: new Date().toISOString(),
        }));
        syncRiderDeliveriesWithServer();
        setActionModal(null);
      } else {
        setActionError(res?.message || "Failed to submit Return to Hub request.");
      }
    } catch (err) {
      setActionError(err.message || "Failed to submit Return to Hub request.");
    } finally {
      setActionBusy(false);
    }
  };

  const isAssigned = scanContext?.assigned_to_current_rider !== false;
  const isDelivered = parcel?.status === "DELIVERED" || parcel?.delivery_status === "DELIVERED";
  const isRthPending =
    parcel?.status === "RETURN_TO_HUB" ||
    parcel?.status === "Return to Hub" ||
    parcel?.status === "RTH_PENDING" ||
    parcel?.status === "Return to Hub – Pending Confirmation" ||
    parcel?.rth_status === "PENDING" ||
    parcel?.rth_status === "PENDING_CONFIRMATION";
  const isRthConfirmed =
    parcel?.status === "RTH_CONFIRMED" ||
    parcel?.status === "Return to Hub – Confirmed" ||
    parcel?.rth_status === "CONFIRMED";
  const isRescheduled = parcel?.status === "RESCHEDULED" || parcel?.rescheduled;
  const isReady =
    !isDelivered &&
    !isRthPending &&
    !isRthConfirmed &&
    (parcel?.status === "VERIFIED" ||
      parcel?.verification_status === "VERIFIED" ||
      parcel?.status === "OUT_FOR_DELIVERY" ||
      isRescheduled);

  return (
    <>
      <Topbar
        title="Scan Unified QR Code"
        subtitle="Use the permanent QR code for Delivery scanning, Rescheduling, and Return to Hub (RTH)."
      >
        {parcel && (
          <button onClick={reset} className={btnGhost}>
            <Icon name="qr-code" /> Scan another parcel
          </button>
        )}
      </Topbar>

      {!parcel && (
        <section className={`${panel} mb-6 p-[30px] max-[600px]:p-5`}>
          {expect && (
            <div className="mx-auto mb-5 max-w-[360px]">
              <Notice tone="info" icon="qr-code">
                Scanning for assigned parcel <strong>{expect}</strong>.{" "}
                <button onClick={reset} className="font-bold underline">
                  Scan any parcel instead
                </button>
              </Notice>
            </div>
          )}
          <ScanPanel onValue={lookup} busy={looking} autoStart={autoStart} />
          {looking && <p className="mt-4 text-center text-[14px] text-[#999]">Looking up parcel…</p>}
          {error && (
            <div className="mx-auto mt-4 max-w-[360px]">
              <Notice tone="error" icon="circle-alert" role="alert">
                {error}
              </Notice>
            </div>
          )}
        </section>
      )}

      {parcel && (
        <section className={`${panel} mb-6 space-y-6 p-[30px] max-[600px]:p-5`}>
          {/* Header & Badges */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">
                Permanent Transaction Number
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-mono text-[20px] font-bold text-[#1e293b] dark:text-white">
                  {parcel.transaction_number || parcel.parcel_id}
                </p>
                {(parcel.is_cod || parcel.payment_method === "COD") && <CodBadge />}
              </div>
              {parcel.parcel_id && parcel.parcel_id !== parcel.transaction_number && (
                <p className="text-[12px] text-[#888]">
                  Parcel ID: <span className="font-mono">{parcel.parcel_id}</span>
                </p>
              )}
            </div>
            <StatusBadge status={parcel.status} />
          </div>

          {/* Role & Assignment Notice */}
          {!isAssigned ? (
            <Notice tone="error" icon="triangle-alert" role="alert">
              <strong className="block">Not Assigned to You</strong>
              <span>
                This parcel is assigned to another rider or has not been dispatched yet. Please check with your Coordinator.
              </span>
            </Notice>
          ) : isRthPending ? (
            <Notice tone="warn" icon="undo-2" role="status">
              <strong className="block">Return to Hub</strong>
              <span>
                You have marked this parcel for Return to Hub (Reason: {parcel.rth_reason || parcel.return_note || "Buyer refused"}).
                Please physically bring this parcel to the Hub for Coordinator physical verification.
              </span>
            </Notice>
          ) : isRthConfirmed ? (
            <Notice tone="success" icon="circle-check" role="status">
              <strong className="block">Return to Hub – Confirmed</strong>
              <span>
                The Coordinator has physically confirmed receipt of this parcel at the Hub. Custody has been safely returned.
              </span>
            </Notice>
          ) : isDelivered ? (
            <Notice tone="success" icon="circle-check" role="status">
              <strong className="block">Delivered</strong>
              <span>This parcel has already been successfully delivered to the recipient.</span>
            </Notice>
          ) : isRescheduled ? (
            <Notice tone="warn" icon="calendar-days" role="status">
              <strong className="block">Rescheduled for Delivery</strong>
              <span>
                Scheduled delivery date: <strong>{formatDay(parcel.scheduledFor)}</strong>.
                Attempt count: {parcel.next_day_attempt_count ? `Attempt ${parcel.next_day_attempt_count} of 2` : 'Rescheduled (Next-Day)'}. Parcel remains in your active delivery queue.
              </span>
            </Notice>
          ) : (
            <Notice tone="success" icon="truck" role="status">
              <strong className="block">Ready for Delivery</strong>
              <span>This parcel is cleared and assigned to you for delivery.</span>
            </Notice>
          )}

          {/* Details Table */}
          <DetailList
            rows={[
              ["Receiver", parcel.receiver || parcel.receiver_name],
              ["Receiver Contact", parcel.receiver_contact || parcel.contact || "—"],
              ["Delivery Address", parcel.address || parcel.receiver_address || "—"],
              ["Payment Method", (parcel.is_cod || parcel.payment_method === "COD") ? "Cash on Delivery (COD)" : "Prepaid (Non-COD)"],
              ["Contents", parcel.contents || "—"],
              ["Seller", parcel.seller || parcel.seller_name || "—"],
              ["Last Updated", parcel.updated_at ? formatDate(parcel.updated_at) : "—"],
            ]}
          />

          {/* Active Rider Action Buttons */}
          {isAssigned && isReady && (
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-4 dark:border-night-line dark:bg-night-soft">
              <h4 className="mb-3 text-[14px] font-bold text-[#1e293b] dark:text-white">
                Available Delivery Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Delivered */}
                <button
                  type="button"
                  onClick={() => {
                    setActionModal("delivered");
                    setProof("");
                    setActionNotes("");
                    setActionError("");
                  }}
                  className={`${btnPrimary} !bg-[#16a34a] hover:!bg-[#15803d] flex items-center justify-center gap-2`}
                >
                  <Icon name="circle-check" />
                  <span>Delivered</span>
                </button>

                {/* 2. Buyer Unavailable (Reschedule) */}
                <button
                  type="button"
                  onClick={() => {
                    setActionModal("reschedule");
                    setActionNotes("");
                    setActionError("");
                  }}
                  className={`${btnPrimary} !bg-[#d97706] hover:!bg-[#b45309] flex items-center justify-center gap-2`}
                >
                  <Icon name="calendar-days" />
                  <span>Buyer Unavailable (Reschedule)</span>
                </button>

                {/* 3. Return to Hub (RTH) */}
                <button
                  type="button"
                  onClick={() => {
                    setActionModal("rth");
                    setRthReason(RTH_REASONS[0]);
                    setActionNotes("");
                    setActionError("");
                  }}
                  className={`${btnPrimary} !bg-[#dc2626] hover:!bg-[#b91c1c] flex items-center justify-center gap-2`}
                >
                  <Icon name="undo-2" />
                  <span>Return to Hub (RTH)</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafafa] p-4 text-[13px] text-[#777] dark:bg-night-head dark:text-[#d1c9c2]">
            <Link to="/rider/deliveries" className={btnPrimary}>
              Go to Deliveries
            </Link>
            <Link to="/rider/messages" className="font-bold text-brand hover:underline">
              Message coordinator →
            </Link>
          </div>
        </section>
      )}

      {/* ACTION MODAL: Delivered */}
      <Modal
        open={actionModal === "delivered"}
        onClose={() => setActionModal(null)}
        z="z-[3500]"
        className="w-full max-w-[460px] p-6 dark:bg-night-panel"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-night-line">
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">
            <Icon name="circle-check" className="mr-2 text-green-600" />
            Complete Delivery
          </h3>
          <button
            onClick={() => setActionModal(null)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
          >
            <Icon name="x" className="text-sm" />
          </button>
        </div>

        <p className="mb-4 text-[13px] text-[#64748b]">
          Upload proof of delivery photo for <strong>{parcel?.transaction_number}</strong>.
        </p>

        <div>
          <label className={labelCls} htmlFor="podFile">
            Proof of Delivery Photo (Required)
          </label>
          <input
            id="podFile"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pickProofPhoto}
            className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-[13px] file:font-bold file:text-brand"
          />
          {proofBusy && <p className="mt-2 text-xs text-[#888]">Processing photo…</p>}
          {proof && (
            <img
              src={proof}
              alt="Proof preview"
              className="mt-3 max-h-[200px] w-full rounded-xl border border-[#eee] object-contain dark:border-night-line"
            />
          )}
        </div>

        <div className="mt-3">
          <label className={labelCls} htmlFor="delNote">
            Delivery Notes (Optional)
          </label>
          <input
            id="delNote"
            type="text"
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder="e.g. Received by sister; signed on slip"
            className={inputCls}
          />
        </div>

        {actionError && (
          <div className="mt-3 text-[12.5px] font-semibold text-red-600">
            {actionError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => setActionModal(null)} className={btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeliveredSubmit}
            disabled={actionBusy || proofBusy}
            className={`${btnPrimary} !bg-green-600 hover:!bg-green-700`}
          >
            {actionBusy ? "Saving…" : "Confirm Delivered"}
          </button>
        </div>
      </Modal>

      {/* ACTION MODAL: Reschedule (Buyer Unavailable) */}
      <Modal
        open={actionModal === "reschedule"}
        onClose={() => setActionModal(null)}
        z="z-[3500]"
        className="w-full max-w-[460px] p-6 dark:bg-night-panel"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-night-line">
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">
            <Icon name="calendar-days" className="mr-2 text-amber-600" />
            Reschedule for Delivery
          </h3>
          <button
            onClick={() => setActionModal(null)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
          >
            <Icon name="x" className="text-sm" />
          </button>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <strong className="block font-bold">Buyer Unavailable Protocol:</strong>
          <p className="mt-1">
            The parcel transaction will NOT be cancelled. It will be scheduled for the next delivery day, your attempt count will be incremented, and the parcel remains in your delivery queue.
          </p>
        </div>

        <div className="mt-4">
          <p className="text-[13px] text-[#64748b]">
            Next Delivery Day: <strong>{formatDay(addDaysIso(todayIso(), 1))}</strong>
          </p>
        </div>

        <div className="mt-3">
          <label className={labelCls} htmlFor="reschedNote">
            Attempt Notes (Optional)
          </label>
          <input
            id="reschedNote"
            type="text"
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder="e.g. Buyer not home; gate locked; phoned 2x"
            className={inputCls}
          />
        </div>

        {actionError && (
          <div className="mt-3 text-[12.5px] font-semibold text-red-600">
            {actionError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => setActionModal(null)} className={btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRescheduleSubmit}
            disabled={actionBusy}
            className={`${btnPrimary} !bg-amber-600 hover:!bg-amber-700`}
          >
            {actionBusy ? "Rescheduling…" : "Confirm Reschedule"}
          </button>
        </div>
      </Modal>

      {/* ACTION MODAL: Return to Hub (RTH) */}
      <Modal
        open={actionModal === "rth"}
        onClose={() => setActionModal(null)}
        z="z-[3500]"
        className="w-full max-w-[460px] p-6 dark:bg-night-panel"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-night-line">
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">
            <Icon name="undo-2" className="mr-2 text-rose-600" />
            Return to Hub (RTH) Request
          </h3>
          <button
            onClick={() => setActionModal(null)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
          >
            <Icon name="x" className="text-sm" />
          </button>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          <strong className="block font-bold">Buyer Cancelled / Refused / Damaged:</strong>
          <p className="mt-1">
            This will immediately mark the parcel as <strong>Return to Hub</strong> and remove it from your active delivery queue. The Coordinator will physically verify and confirm receipt upon arrival at the Hub.
          </p>
        </div>

        <div className="mt-4">
          <label className={labelCls} htmlFor="rthReason">
            Return Reason (Required)
          </label>
          <select
            id="rthReason"
            value={rthReason}
            onChange={(e) => setRthReason(e.target.value)}
            className={inputCls}
          >
            {RTH_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className={labelCls} htmlFor="rthNote">
            Explanation / Specific Remarks
          </label>
          <textarea
            id="rthNote"
            rows={2}
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder="e.g. Buyer explicitly refused to receive the package and pay COD."
            className={textareaCls}
          />
        </div>

        {actionError && (
          <div className="mt-3 text-[12.5px] font-semibold text-red-600">
            {actionError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => setActionModal(null)} className={btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRthSubmit}
            disabled={actionBusy}
            className={`${btnPrimary} !bg-rose-600 hover:!bg-rose-700`}
          >
            {actionBusy ? "Submitting…" : "Confirm Return to Hub"}
          </button>
        </div>
      </Modal>

      <RecentScans scans={scans} limit={8} />
    </>
  );
}
