import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { CodBadge, Modal } from "../../components/ui.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import FailureReasonSelect from "../../components/rider/FailureReasonSelect.jsx";
import { DetailList, Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, labelCls, panel, textareaCls } from "../../components/styles.js";
import {
  scanUnifiedQr,
  findParcel,
  riderRescheduleParcel,
  riderRequestRth,
} from "../../services/parcelService.js";
import { logScan, useRiderScans } from "../../store/riderScans.js";
import {
  MAX_RESCHEDULES,
  addToDeliver,
  applyServerFailureResult,
  findAssigned,
  getAttemptOrdinalLabel,
  isImmediateRthReason,
  markDelivered,
  markFailed,
  syncRiderDeliveriesWithServer,
  todayIso,
  addDaysIso,
} from "../../store/riderDeliveries.js";
import { reportFailure } from "../../store/failedDeliveries.js";
import { compressImage } from "../../utils/image.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { toast } from "../../store/toast.js";
import Icon from "../../components/Icon.jsx";

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function RiderScan() {
  const [params, setParams] = useSearchParams();
  const scans = useRiderScans();
  const [parcel, setParcel] = useState(null);
  const [scanContext, setScanContext] = useState(null);
  const [outcome, setOutcome] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  // Modals for Rider Actions ("delivered" | "failed")
  const [actionModal, setActionModal] = useState(null);
  const [proof, setProof] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const [failedReason, setFailedReason] = useState("");
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
      // Only add to active delivery queue if strictly VERIFIED, assigned to this rider, and not RTH/Delivered
      const verified =
        p.status === "VERIFIED" ||
        p.verification_status === "VERIFIED" ||
        p.status === "OUT_FOR_DELIVERY" ||
        p.status === "RESCHEDULED" ||
        p.delivery_status === "TO_DELIVER" ||
        p.delivery_status === "RESCHEDULED";

      const isRthOrDone =
        p.status === "RETURN_TO_HUB" ||
        p.status === "RTH_PENDING" ||
        p.status === "RTH_CONFIRMED" ||
        p.status === "DELIVERED" ||
        p.delivery_status === "DELIVERED" ||
        p.rth_status === "PENDING" ||
        p.rth_status === "PENDING_CONFIRMATION" ||
        p.rth_status === "CONFIRMED";

      if (verified && !isRthOrDone && scanData?.assigned_to_current_rider !== false) {
        logScan(p, value);
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

  // Action: Failed Delivery (Automatic Reschedule up to 2 attempts OR Immediate Return to Hub with Proof Photo)
  const currentReschedCount = Number(
    parcel?.rescheduleCount ?? parcel?.reschedule_count ?? parcel?.next_day_attempt_count ?? 0
  );
  const baseSchedDate =
    (parcel?.scheduledFor || parcel?.scheduled_for) &&
    String(parcel?.scheduledFor || parcel?.scheduled_for).slice(0, 10) >= todayIso()
      ? String(parcel?.scheduledFor || parcel?.scheduled_for).slice(0, 10)
      : todayIso();
  const nextScheduledDay = addDaysIso(baseSchedDate, 1);
  const willAutoRthByLimit = currentReschedCount >= MAX_RESCHEDULES;
  const isImmediateRth = isImmediateRthReason(failedReason);

  const handleFailedSubmit = async () => {
    if (!failedReason) {
      setActionError("Please select a failure reason.");
      return;
    }
    if (!proof) {
      setActionError("Please upload or capture a proof photo as evidence before submitting.");
      return;
    }
    if (!actionNotes.trim()) {
      setActionError("Please enter notes explaining the failed delivery attempt.");
      return;
    }

    setActionBusy(true);
    setActionError("");
    try {
      const pid = parcel.parcel_id || parcel.transaction_number;
      const localRes = markFailed(pid, {
        reason: failedReason,
        note: actionNotes.trim(),
        proof,
        customDate: nextScheduledDay,
        skipRemoteSync: true,
      });
      reportFailure(parcel, {
        reason: failedReason,
        note: actionNotes.trim(),
        proof,
        result: localRes,
      });

      if (isImmediateRth || willAutoRthByLimit || localRes?.outcome === "return_to_hub" || localRes?.outcome === "recipient_refused") {
        const rthRes = await riderRequestRth(pid, {
          reason: failedReason,
          notes: actionNotes.trim(),
          proof,
        }).catch(() => null);
        if (rthRes) applyServerFailureResult(pid, rthRes);

        toast(
          `${parcel.transaction_number} marked as Return to Hub (${failedReason}). Coordinator notified for hub confirmation.`,
          "error"
        );
        setParcel((prev) => ({
          ...prev,
          status: "RETURN_TO_HUB",
          delivery_status: "RETURN_TO_HUB",
          return_to_hub: true,
          rth_status: "PENDING",
          rth_reason: failedReason,
          rth_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          delivery_proof: proof || prev?.delivery_proof,
        }));
      } else {
        const res = await riderRescheduleParcel(pid, {
          reason: failedReason,
          scheduledFor: nextScheduledDay,
          notes: actionNotes.trim(),
          proof,
        }).catch(() => null);
        if (res) applyServerFailureResult(pid, res);

        if (res?.return_to_hub || res?.status === "RETURN_TO_HUB") {
          toast(
            `${parcel.transaction_number} reached the 2-attempt reschedule limit and was marked for Return to Hub.`,
            "error"
          );
          setParcel((prev) => ({
            ...prev,
            status: "RETURN_TO_HUB",
            delivery_status: "RETURN_TO_HUB",
            return_to_hub: true,
            rth_status: "PENDING",
            rth_reason: "Maximum delivery attempts reached",
            updated_at: new Date().toISOString(),
          }));
        } else {
          const nextAttemptNum = Math.min(
            MAX_RESCHEDULES,
            Math.max(Number(res?.reschedule_count || 0), Number(res?.next_day_attempt_count || 0), currentReschedCount + 1)
          );
          const resolvedDate = res?.scheduled_for || localRes?.scheduledFor || nextScheduledDay;
          toast(
            `${parcel.transaction_number} rescheduled for ${formatDay(resolvedDate)} (${getAttemptOrdinalLabel(nextAttemptNum)}).`,
            "info"
          );
          setParcel((prev) => ({
            ...prev,
            status: "RESCHEDULED",
            rescheduled: true,
            scheduledFor: resolvedDate,
            scheduled_for: resolvedDate,
            lastFailure: failedReason,
            rescheduleCount: nextAttemptNum,
            reschedule_count: nextAttemptNum,
            next_day_attempt_count: nextAttemptNum,
            updated_at: new Date().toISOString(),
          }));
        }
      }
      syncRiderDeliveriesWithServer();
      setActionModal(null);
    } catch (err) {
      setActionError(err.message || "Failed to record failed delivery attempt.");
    } finally {
      setActionBusy(false);
    }
  };

  const isVerified =
    parcel?.status === "VERIFIED" ||
    parcel?.verification_status === "VERIFIED" ||
    parcel?.status === "OUT_FOR_DELIVERY" ||
    parcel?.status === "RESCHEDULED" ||
    parcel?.status === "DELIVERED" ||
    parcel?.delivery_status === "TO_DELIVER" ||
    parcel?.delivery_status === "RESCHEDULED" ||
    parcel?.delivery_status === "DELIVERED";
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
    isVerified &&
    !isDelivered &&
    !isRthPending &&
    !isRthConfirmed;

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
        <section className={`${panel} mb-6 p-6 sm:p-7 max-[600px]:p-4`}>
          {expect && (
            <div className="mx-auto mb-5 max-w-[520px]">
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
            <div className="mx-auto mt-4 max-w-[520px]">
              <Notice tone="error" icon="circle-alert" role="alert">
                {error}
              </Notice>
            </div>
          )}
        </section>
      )}

      {parcel && (
        <section className={`${panel} mb-6 space-y-6 p-6 sm:p-7 max-[600px]:p-4`}>
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
          {!isVerified ? (
            <Notice tone="error" icon="circle-alert" role="alert">
              <strong className="block">Parcel is not ready for delivery</strong>
              <span>
                This parcel has not been approved by the Coordinator yet
                {parcel.status === "WAITING_FOR_VIDEO"
                  ? " — waiting for the seller to upload packing video."
                  : parcel.status === "VIDEO_SUBMITTED"
                    ? " — packing video is still under verification."
                    : parcel.status === "REUPLOAD_REQUESTED"
                      ? " — seller needs to re-upload the packing video."
                      : parcel.status === "REJECTED"
                        ? " — parcel was rejected during verification."
                        : "."}
              </span>
            </Notice>
          ) : !isAssigned ? (
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
              ["Contents", parcel.contents || "—"],
              ["Seller", parcel.seller || parcel.seller_name || "—"],
              ["Last Updated", parcel.updated_at ? formatDate(parcel.updated_at) : "—"],
            ]}
          />

          {/* Active Rider Action Buttons: ONLY Delivered or Failed Delivery */}
          {isAssigned && isReady && (
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-4 dark:border-night-line dark:bg-night-soft">
              <h4 className="mb-3 text-[14px] font-bold text-[#1e293b] dark:text-white">
                Available Delivery Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Delivered */}
                <button
                  type="button"
                  onClick={() => {
                    setActionModal("delivered");
                    setProof("");
                    setActionNotes("");
                    setActionError("");
                  }}
                  className={`${btnPrimary} !bg-[#16a34a] hover:!bg-[#15803d] flex items-center justify-center gap-2 !py-3`}
                >
                  <Icon name="circle-check" />
                  <span>Delivered</span>
                </button>

                {/* 2. Failed Delivery */}
                <button
                  type="button"
                  onClick={() => {
                    setActionModal("failed");
                    setFailedReason("");
                    setProof("");
                    setActionNotes("");
                    setActionError("");
                  }}
                  className={`${btnPrimary} !bg-[#dc2626] hover:!bg-[#b91c1c] flex items-center justify-center gap-2 !py-3`}
                >
                  <Icon name="circle-x" />
                  <span>Failed Delivery</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafafa] p-4 text-[13px] text-[#777] dark:bg-night-head dark:text-[#d1c9c2]">
            {isVerified && isAssigned ? (
              <Link to="/rider/deliveries" className={btnPrimary}>
                Go to Deliveries
              </Link>
            ) : (
              <button type="button" onClick={reset} className={btnPrimary}>
                <Icon name="scan-line" /> Scan another parcel
              </button>
            )}
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

      {/* ACTION MODAL: Failed Delivery (Auto-Reschedule or Immediate RTH with Proof Photo) */}
      <Modal
        open={actionModal === "failed"}
        onClose={() => setActionModal(null)}
        z="z-[3500]"
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto p-6 dark:bg-night-panel"
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-night-line">
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">
            <Icon name="circle-x" className="mr-2 text-rose-600" />
            Report Failed Delivery
          </h3>
          <button
            onClick={() => setActionModal(null)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
          >
            <Icon name="x" className="text-sm" />
          </button>
        </div>

        <p className="mb-3 text-[13px] text-[#64748b]">
          {parcel?.transaction_number} · {parcel?.receiver || parcel?.receiver_name}
        </p>

        {willAutoRthByLimit && !isImmediateRth && (
          <div className="mb-4 rounded-xl border border-[#d8b4fe] bg-[#f8f5ff] p-3 text-[13px] text-[#6d28d9] dark:border-[#5b21b6] dark:bg-[#241b35] dark:text-[#c4b5fd]">
            <strong className="block font-bold">
              <Icon name="undo-2" className="mr-1.5" />
              2-Attempt Limit Reached ({MAX_RESCHEDULES}/{MAX_RESCHEDULES} Attempts)
            </strong>
            <p className="mt-1">
              This parcel has already been rescheduled {MAX_RESCHEDULES} times and will automatically be marked for Return to Hub.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="scanFailedReason">
            Failure Reason <span className="text-[#dc2626]">*</span>
          </label>
          <FailureReasonSelect
            id="scanFailedReason"
            value={failedReason}
            disabled={actionBusy}
            onChange={(val) => {
              setFailedReason(val);
              setActionError("");
            }}
          />
        </div>

        {failedReason && !isImmediateRth && !willAutoRthByLimit && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <strong className="block font-bold">
              <Icon name="calendar-days" className="mr-1.5" />
              Automatic Reschedule ({getAttemptOrdinalLabel(currentReschedCount + 1)} · {currentReschedCount + 1}/{MAX_RESCHEDULES})
            </strong>
            <p className="mt-1">
              Next Delivery Date: <strong>{formatDay(nextScheduledDay)}</strong>. The parcel will move to the{" "}
              <strong>Rescheduled</strong> filter tab in My Deliveries.
            </p>
          </div>
        )}

        {isImmediateRth && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12.5px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            <strong className="block font-bold">
              <Icon name="undo-2" className="mr-1.5" />
              Automatic Return to Hub (RTH)
            </strong>
            <p className="mt-1">
              Selecting <strong>{failedReason}</strong> will immediately mark this parcel as{" "}
              <strong>Return to Hub</strong> and notify the Coordinator for physical arrival confirmation.
            </p>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-night-line dark:bg-night-head/60">
          <label className={labelCls} htmlFor="scanRthProof">
            Upload Proof / Evidence Photo <span className="text-[#dc2626]">*</span>{" "}
            <span className="font-normal text-[#64748b] dark:text-[#b8b0a8]">(Required)</span>
          </label>
          <input
            id="scanRthProof"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pickProofPhoto}
            className="block w-full text-[13px] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-[12.5px] file:font-bold file:text-white hover:file:bg-brand-dark"
          />
          {proofBusy && <p className="mt-2 text-xs text-[#888]">Processing photo…</p>}
          {proof && (
            <div className="mt-3 space-y-2">
              <img
                src={proof}
                alt="Failed delivery evidence preview"
                className="max-h-[200px] w-full rounded-xl border border-[#eee] bg-white object-contain dark:border-night-line"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setProof("")}
                  className="text-[12px] font-semibold text-[#dc2626] hover:underline dark:text-[#ff7b7b]"
                >
                  Remove photo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <label className={labelCls} htmlFor="scanFailNote">
            Notes <span className="text-[#dc2626]">*</span>{" "}
            <span className="font-normal text-[#64748b] dark:text-[#b8b0a8]">(Required)</span>
          </label>
          <textarea
            id="scanFailNote"
            rows={2}
            required
            value={actionNotes}
            onChange={(e) => {
              setActionNotes(e.target.value);
              if (actionError) setActionError("");
            }}
            placeholder="Explain what happened during the delivery attempt (required)…"
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
            onClick={handleFailedSubmit}
            disabled={actionBusy || proofBusy}
            className={`${btnPrimary} ${
              isImmediateRth || willAutoRthByLimit
                ? "!bg-rose-600 hover:!bg-rose-700"
                : "!bg-amber-600 hover:!bg-amber-700"
            }`}
          >
            {actionBusy
              ? "Submitting…"
              : isImmediateRth || willAutoRthByLimit
              ? "Submit & Mark Return to Hub"
              : `Submit & Reschedule (${formatDay(nextScheduledDay)})`}
          </button>
        </div>
      </Modal>

      <RecentScans scans={scans} limit={8} />
    </>
  );
}
