import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, StatusBadge, CodBadge } from "../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, panel } from "../components/styles.js";
import {
  decideDiscreetHandling,
  getByTransaction,
  getCoordinatorParcel,
  hubVerifyParcel,
  rtsDispatchParcel,
  confirmReturnedParcel,
} from "../services/parcelService.js";
import { getUser } from "../api.js";
import { getParcelStatus } from "../utils/parcelStatus.js";
import { formatDay } from "../utils/format.js";
import { coordinateReturn } from "../store/failedDeliveries.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";

const value = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const dateValue = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

function DiscreetBadge({ discreteItem, discreetStatus }) {
  if (!discreteItem && (!discreetStatus || discreetStatus === "NOT_REQUESTED")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-semibold text-[#6b7280] dark:bg-night-head dark:text-[#b8b0a8]">
        No (Standard Handling)
      </span>
    );
  }
  const status = discreetStatus || (discreteItem ? "PENDING_REVIEW" : "NOT_REQUESTED");
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-3 py-0.5 text-xs font-bold text-[#1f7f4a]">
        <i className="fa-solid fa-user-shield text-[10px]" /> Approved by Coordinator
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fdecec] px-3 py-0.5 text-xs font-bold text-[#c53030]">
        <i className="fa-solid fa-ban text-[10px]" /> Rejected by Coordinator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e5] px-3 py-0.5 text-xs font-bold text-[#b45309]">
      <i className="fa-solid fa-clock text-[10px]" /> Pending Coordinator Review
    </span>
  );
}

export default function ParcelDetails() {
  const { id = "" } = useParams();
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discreetRemarks, setDiscreetRemarks] = useState("");
  const [discreetBusy, setDiscreetBusy] = useState(false);
  const [rtsBusy, setRtsBusy] = useState(false);
  const user = getUser();
  const isCoordinator = user?.role === "coordinator";
  const isSeller = user?.role === "seller";

  const handleHubVerify = async () => {
    if (!parcel?.parcel_id) return;
    setRtsBusy(true);
    try {
      await hubVerifyParcel(parcel.parcel_id);
      toast("Parcel marked as Hub Verified.", "success");
      await load();
    } catch (err) {
      toast(err.message || "Failed to verify hub arrival.", "error");
    } finally {
      setRtsBusy(false);
    }
  };

  const handleRtsDispatch = async () => {
    if (!parcel?.parcel_id) return;
    setRtsBusy(true);
    try {
      await rtsDispatchParcel(parcel.parcel_id);
      toast("Parcel dispatched towards seller (RTS In Transit).", "success");
      await load();
    } catch (err) {
      toast(err.message || "Failed to dispatch RTS parcel.", "error");
    } finally {
      setRtsBusy(false);
    }
  };

  const handleConfirmReturned = async () => {
    if (!parcel?.parcel_id) return;
    setRtsBusy(true);
    try {
      await confirmReturnedParcel(parcel.parcel_id, user?.name || "Seller");
      toast("Receipt of returned parcel confirmed.", "success");
      await load();
    } catch (err) {
      toast(err.message || "Failed to confirm receipt.", "error");
    } finally {
      setRtsBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let result;
      try {
        result = await getCoordinatorParcel(decodeURIComponent(id));
      } catch {
        result = await getByTransaction(decodeURIComponent(id));
      }
      const record = result?.parcel || result;
      if (!record || !(record.parcel_id || record.id || record.transaction_number)) {
        throw new Error("The server did not return parcel details.");
      }
      setParcel({
        ...record,
        _verificationRecords: result?.verification_records || [],
        _declarationHistory: result?.declaration_history || [],
      });
      setDiscreetRemarks(record.discreet_review_remarks || "");
    } catch (e) {
      setError(e.message || "Unable to load parcel details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCoordinateReturn = () => {
    if (!parcel) return;
    coordinateReturn(parcel.parcel_id || parcel.transaction_number, {
      note: "Coordinated return to seller from Parcel Details.",
    });
    toast(`Return to seller coordinated for ${parcel.transaction_number || parcel.parcel_id}.`);
    load();
  };

  const handleDiscreetDecision = async (decision) => {
    if (!parcel?.parcel_id) return;
    if (decision === "REJECT" && !discreetRemarks.trim()) {
      toast("Please provide a short note explaining why the discreet request is rejected.", "error");
      return;
    }
    setDiscreetBusy(true);
    try {
      await decideDiscreetHandling(parcel.parcel_id, decision, discreetRemarks.trim());
      logAction({
        category: "Discreet Verification",
        action: decision === "APPROVE" ? "Approved discreet handling" : "Rejected discreet handling",
        target: parcel.parcel_id,
        detail: discreetRemarks.trim(),
      });
      toast(
        decision === "APPROVE"
          ? `Discreet handling approved for ${parcel.parcel_id}`
          : `Discreet handling rejected for ${parcel.parcel_id}`
      );
      await load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setDiscreetBusy(false);
    }
  };

  const verification = parcel?.verification_status || parcel?.verification || parcel?.status;
  const delivery = getParcelStatus(parcel || {});
  const categoryDisplay = parcel?.content_category
    ? parcel.content_category === "Other" && parcel.other_category_description
      ? `Other (${parcel.other_category_description})`
      : parcel.content_category
    : "Unspecified";

  const isCod = Boolean(parcel?.is_cod || String(parcel?.payment_method || "").toUpperCase() === "COD");
  const rtsStage = parcel?.rts_status || (parcel?.returnToHub ? "RETURN_TO_HUB" : null);

  const fields = [
    ["Parcel ID", parcel?.parcel_id || parcel?.id],
    ["Transaction Number", parcel?.transaction_number],
    ["Payment Method", isCod ? "Cash on Delivery (COD)" : "Prepaid (Non-COD)"],
    ["Parcel Status", parcel?.status],
    ["Seller Name", parcel?.seller_name || parcel?.seller?.name],
    ...(parcel?.seller_code || parcel?.seller?.code || parcel?.seller_id ? [["Seller ID", parcel?.seller_code || parcel?.seller?.code || `SEL-${parcel?.seller_id}`]] : []),
    ...(parcel?.shop_name || parcel?.seller?.shop_name || parcel?.shop ? [["Shop Name", parcel?.shop_name || parcel?.seller?.shop_name || parcel?.shop]] : []),
    ["Assigned Rider Name", parcel?.rider_name || parcel?.assigned_rider_name || parcel?.rider?.name || parcel?.deliveryRecord?.rider_name],
    ["Parcel Creation Date", dateValue(parcel?.created_at)],
    ["Verification Status", verification],
    ["Delivery Status", delivery],
    ...(parcel?.delivery_hold
      ? [["Delivery Hold", `Active (${parcel.delivery_hold_reason || "Incident reported"})`]]
      : []),
    ...(rtsStage
      ? [["RTS Workflow Stage", rtsStage === "RETURNED_TO_SELLER" ? "Stage 4: Returned to Seller" : rtsStage === "RTS_IN_TRANSIT" ? "Stage 3: RTS In Transit" : rtsStage === "HUB_VERIFIED" ? "Stage 2: Hub Verified" : "Stage 1: Return to Hub"]]
      : []),
    ...(parcel?.scheduledFor && !parcel?.returnToHub
      ? [
          [
            "Latest Rescheduled Date",
            `${formatDay(parcel.scheduledFor)} (Day ${parcel.rescheduleCount || 1} of ${parcel.maxReschedules || 3})`,
          ],
        ]
      : []),
  ];

  return (
    <>
      <Topbar
        title={
          loading ? (
            "Parcel Details"
          ) : (
            <span className="inline-flex items-center gap-2">
              <span>Parcel {parcel?.parcel_id || parcel?.transaction_number || "Details"}</span>
              {isCod && <CodBadge />}
            </span>
          )
        }
        subtitle="Parcel record, declared content category, discreet handling verification, and delivery history."
      >
        <Link to="/parcels" className={btnGhost}>
          <i className="fa-solid fa-arrow-left" /> Back to Parcels
        </Link>
      </Topbar>

      {loading ? (
        <section className={`${panel} p-8 text-sm text-[#999]`}>Loading parcel details…</section>
      ) : error ? (
        <section className={`${panel} p-8`}>
          <EmptyState icon="fa-box-open" title="Parcel details unavailable" text={error} />
          <div className="text-center">
            <Link to="/parcels" className={btnGhost}>
              Back to Parcels
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {parcel?.declaration_flagged && (
            <section
              role="alert"
              className="rounded-2xl border border-[#f5bcbc] bg-[#fff5f5] p-5 text-[#9b2c2c] dark:border-[#d94a4a]/40 dark:bg-[#d94a4a]/10 dark:text-[#f5a3a3]"
            >
              <h2 className="flex items-center gap-2 text-[16px] font-bold">
                <i className="fa-solid fa-triangle-exclamation text-[#d94a4a]" />
                Flagged Declaration — Requires Coordinator Verification
              </h2>
              <p className="mt-1 text-[13.5px] leading-relaxed">
                {parcel.declaration_flag_reason ||
                  "This parcel declaration was flagged for potential inconsistency or non-standard discreet handling. Please inspect the seller's packing video carefully before approving."}
              </p>
            </section>
          )}

          {parcel?.delivery_hold && (
            <section
              role="alert"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-200"
            >
              <h2 className="flex items-center gap-2 text-[16px] font-bold">
                <i className="fa-solid fa-hand text-amber-600" />
                Temporary Delivery Hold Active
              </h2>
              <p className="mt-1 text-[13.5px] leading-relaxed">
                This parcel is currently held due to a reported rider incident ({parcel.delivery_hold_reason || "Accident/Breakdown"}). The 3-day delivery rescheduling counter is paused and will not consume days while on hold.
              </p>
            </section>
          )}

          {(parcel?.returnToHub || parcel?.rts_status || parcel?.status === "RETURNED") && (
            <section className="rounded-2xl border border-[#d8b4fe] bg-[#faf7ff] p-5 dark:border-[#5b21b6] dark:bg-[#221933]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-[#6d28d9] dark:text-[#c4b5fd]">
                    <i className="fa-solid fa-boxes-packing mr-2" />
                    Return to Sender (RTS) Workflow — 4 Stages
                  </h2>
                  <p className="mt-1 text-[13px] text-[#666] dark:text-[#d1c9c2]">
                    Tracking returned parcel through Return to Hub, Hub Arrival Verification, RTS Dispatch, and Seller Receipt.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isCoordinator && (!parcel.rts_status || parcel.rts_status === "RETURN_TO_HUB") && (
                    <button
                      type="button"
                      disabled={rtsBusy}
                      onClick={handleHubVerify}
                      className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-circle-check mr-1.5" /> Verify Hub Arrival
                    </button>
                  )}

                  {isCoordinator && parcel.rts_status === "HUB_VERIFIED" && (
                    <button
                      type="button"
                      disabled={rtsBusy}
                      onClick={handleRtsDispatch}
                      className="rounded-lg bg-[#ea580c] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#c2410c] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-truck-fast mr-1.5" /> Dispatch to Seller (RTS In Transit)
                    </button>
                  )}

                  {(isSeller || isCoordinator) && parcel.rts_status === "RTS_IN_TRANSIT" && (
                    <button
                      type="button"
                      disabled={rtsBusy}
                      onClick={handleConfirmReturned}
                      className="rounded-lg bg-[#29945a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#217a49] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-box-open mr-1.5" /> Confirm Receipt (Returned to Seller)
                    </button>
                  )}

                  {parcel.rts_status === "RETURNED_TO_SELLER" && (
                    <span className="rounded-full bg-[#eaf8ef] px-3.5 py-1.5 text-[12.5px] font-bold text-[#29945a]">
                      <i className="fa-solid fa-circle-check mr-1.5" /> Returned to Seller
                    </span>
                  )}
                </div>
              </div>

              {/* 4-Stage Visual Progress Bar */}
              <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs max-[768px]:grid-cols-2 max-[480px]:grid-cols-1">
                {/* Stage 1: Return to Hub */}
                <div
                  className={`rounded-xl border p-3 ${
                    parcel.returnToHub || parcel.rts_status
                      ? "border-[#7c3aed]/40 bg-white font-bold text-[#7c3aed] shadow-sm dark:bg-night-panel dark:text-[#c4b5fd]"
                      : "border-gray-200 bg-gray-50 text-gray-400 dark:border-night-line dark:bg-night-head"
                  }`}
                >
                  <div className="text-[14px] mb-1">
                    <i className="fa-solid fa-warehouse mr-1" /> Stage 1
                  </div>
                  <div>Return to Hub</div>
                  <small className="block mt-1 font-normal opacity-75">
                    {parcel.return_to_hub_at ? dateValue(parcel.return_to_hub_at) : "Rider Initiated"}
                  </small>
                </div>

                {/* Stage 2: Hub Verification */}
                <div
                  className={`rounded-xl border p-3 ${
                    ["HUB_VERIFIED", "RTS_IN_TRANSIT", "RETURNED_TO_SELLER"].includes(parcel.rts_status)
                      ? "border-[#7c3aed]/40 bg-white font-bold text-[#7c3aed] shadow-sm dark:bg-night-panel dark:text-[#c4b5fd]"
                      : "border-gray-200 bg-gray-50 text-gray-400 dark:border-night-line dark:bg-night-head"
                  }`}
                >
                  <div className="text-[14px] mb-1">
                    <i className="fa-solid fa-qrcode mr-1" /> Stage 2
                  </div>
                  <div>Hub Verification</div>
                  <small className="block mt-1 font-normal opacity-75">
                    {parcel.hub_verified_at ? dateValue(parcel.hub_verified_at) : "Pending Hub Arrival"}
                  </small>
                </div>

                {/* Stage 3: RTS In Transit */}
                <div
                  className={`rounded-xl border p-3 ${
                    ["RTS_IN_TRANSIT", "RETURNED_TO_SELLER"].includes(parcel.rts_status)
                      ? "border-[#ea580c]/40 bg-white font-bold text-[#ea580c] shadow-sm dark:bg-night-panel dark:text-[#ff9858]"
                      : "border-gray-200 bg-gray-50 text-gray-400 dark:border-night-line dark:bg-night-head"
                  }`}
                >
                  <div className="text-[14px] mb-1">
                    <i className="fa-solid fa-truck-fast mr-1" /> Stage 3
                  </div>
                  <div>RTS In Transit</div>
                  <small className="block mt-1 font-normal opacity-75">
                    {parcel.rts_dispatched_at ? dateValue(parcel.rts_dispatched_at) : "Dispatched to Seller"}
                  </small>
                </div>

                {/* Stage 4: Returned to Seller */}
                <div
                  className={`rounded-xl border p-3 ${
                    parcel.rts_status === "RETURNED_TO_SELLER" || parcel.status === "RETURNED"
                      ? "border-[#29945a]/40 bg-white font-bold text-[#29945a] shadow-sm dark:bg-night-panel dark:text-[#52c686]"
                      : "border-gray-200 bg-gray-50 text-gray-400 dark:border-night-line dark:bg-night-head"
                  }`}
                >
                  <div className="text-[14px] mb-1">
                    <i className="fa-solid fa-circle-check mr-1" /> Stage 4
                  </div>
                  <div>Returned to Seller</div>
                  <small className="block mt-1 font-normal opacity-75">
                    {parcel.returned_to_seller_at
                      ? `Received by ${parcel.returned_received_by || "Seller"}`
                      : "Pending Seller Receipt"}
                  </small>
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
            <section className={`${panel} p-6`}>
              <h2 className="mb-4 text-lg font-bold">Parcel Information</h2>
              {fields.map(([label, raw]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 last:border-0 dark:border-night-line"
                >
                  <span className="text-sm text-[#999]">{label}</span>
                  <span className="break-words text-right text-sm font-semibold">
                    {label === "Delivery Status" ? <StatusBadge status={raw} /> : value(raw)}
                  </span>
                </div>
              ))}
            </section>

            <section className={`${panel} p-6`}>
              <h2 className="mb-4 text-lg font-bold">Recipient &amp; Delivery Details</h2>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Recipient</span>
                <span className="text-right text-sm font-semibold">
                  {value(parcel.receiver_name || parcel.recipient_name)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <div className="flex justify-between gap-4">
                  <span className="text-sm text-[#999]">Address</span>
                  <span className="text-right text-sm font-semibold break-words max-w-[65%]">
                    {value(parcel.receiver_address || parcel.address)}
                  </span>
                </div>
                {(parcel.receiver_barangay || parcel.receiver_city || parcel.receiver_province) && (
                  <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
                    {parcel.receiver_barangay && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-night-head dark:text-slate-300">
                        Brgy. {parcel.receiver_barangay}
                      </span>
                    )}
                    {parcel.receiver_city && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-night-head dark:text-slate-300">
                        {parcel.receiver_city}
                      </span>
                    )}
                    {parcel.receiver_province && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-night-head dark:text-slate-300">
                        {parcel.receiver_province}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Contact</span>
                <span className="text-right text-sm font-semibold">{value(parcel.receiver_contact)}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Declared Category</span>
                <span className="text-right text-sm font-semibold">{categoryDisplay}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Item Description</span>
                <span className="text-right text-sm font-semibold">{value(parcel.contents || parcel.item)}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Delivery Updated</span>
                <span className="text-right text-sm font-semibold">
                  {dateValue(parcel.delivered_at || parcel.updated_at)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-[#999]">Assigned Rider</span>
                <span className="text-right text-sm font-semibold">
                  {value(
                    parcel.rider_name ||
                      parcel.assigned_rider_name ||
                      parcel.rider?.name ||
                      parcel?.deliveryRecord?.rider_name
                  )}
                </span>
              </div>
            </section>
          </div>

          {/* Content Declaration & Discreet Handling Review Panel */}
          <section className={`${panel} p-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f1f1] pb-3.5 dark:border-night-line">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <i className="fa-solid fa-clipboard-check text-brand" />
                  Declared Content Category &amp; Discreet Handling Verification
                </h2>
                <p className="mt-0.5 text-xs text-[#888]">
                  Review the seller&apos;s declared item category and discreet-handling request. Discreet requests never bypass video verification.
                </p>
              </div>
              <DiscreetBadge
                discreteItem={parcel.discrete_item}
                discreetStatus={parcel.discreet_status}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm max-[700px]:grid-cols-1">
              <div className="rounded-xl border border-[#f0e6df] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <span className="block text-xs font-semibold uppercase text-[#888]">
                  Declared Item Category
                </span>
                <strong className="mt-1 block text-[15px] text-[#27364f] dark:text-[#f1eeeb]">
                  {categoryDisplay}
                </strong>
              </div>
              <div className="rounded-xl border border-[#f0e6df] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <span className="block text-xs font-semibold uppercase text-[#888]">
                  Item Description, if applicable
                </span>
                <strong className="mt-1 block text-[15px] text-[#27364f] dark:text-[#f1eeeb]">
                  {value(parcel.contents || parcel.item)}
                </strong>
              </div>
              <div className="rounded-xl border border-[#f0e6df] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <span className="block text-xs font-semibold uppercase text-[#888]">
                  Discreet Handling Requested
                </span>
                <strong className="mt-1 block text-[15px] text-[#27364f] dark:text-[#f1eeeb]">
                  {parcel.discrete_item ? "Yes" : "No"}
                </strong>
              </div>
              <div className="rounded-xl border border-[#f0e6df] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <span className="block text-xs font-semibold uppercase text-[#888]">
                  Verification Status
                </span>
                <strong className="mt-1 block text-[15px] text-[#27364f] dark:text-[#f1eeeb]">
                  Parcel: {value(verification)} · Discreet:{" "}
                  {parcel.discrete_item
                    ? (parcel.discreet_status || "PENDING_REVIEW").replace("_", " ")
                    : "Not Requested"}
                </strong>
              </div>
            </div>

            {parcel.discrete_item && (
              <div className="mt-4 space-y-4 rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
                <div>
                  <span className="block text-xs font-semibold uppercase text-[#888]">
                    Seller&apos;s Explanation for Discreet Handling
                  </span>
                  <p className="mt-1 rounded-lg border border-[#e7dcd4] bg-white p-3 text-sm text-[#333] dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]">
                    {parcel.discreet_reason || "No explanation provided."}
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="parcel-details-discreet-remarks"
                      className="text-xs font-semibold text-[#555] dark:text-[#d1c9c2]"
                    >
                      Coordinator Review Remarks (required when rejecting discreet request)
                    </label>
                    {parcel.discreet_reviewed_at && (
                      <span className="text-xs text-[#888]">
                        Reviewed {dateValue(parcel.discreet_reviewed_at)}
                        {parcel.discreet_reviewer_name ? ` by ${parcel.discreet_reviewer_name}` : ""}
                      </span>
                    )}
                  </div>
                  <input
                    id="parcel-details-discreet-remarks"
                    type="text"
                    value={discreetRemarks}
                    onChange={(e) => setDiscreetRemarks(e.target.value)}
                    placeholder="Add review note for the discreet handling request..."
                    className={`${inputCls} mb-3 bg-white dark:bg-night-panel`}
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={discreetBusy}
                      onClick={() => handleDiscreetDecision("APPROVE")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#29945a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#217a49] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-user-check" /> Approve Discreet Handling
                    </button>
                    <button
                      type="button"
                      disabled={discreetBusy}
                      onClick={() => handleDiscreetDecision("REJECT")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#d94747] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#b83737] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-ban" /> Reject Discreet Handling
                    </button>
                  </div>
                </div>
              </div>
            )}

            {Array.isArray(parcel._declarationHistory) && parcel._declarationHistory.length > 0 && (
              <div className="mt-5 border-t border-[#f1f1f1] pt-4 dark:border-night-line">
                <h3 className="mb-2.5 text-sm font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  <i className="fa-solid fa-clock-rotate-left mr-1.5 text-brand" />
                  Declaration &amp; Discreet Audit History
                </h3>
                <ul className="space-y-2 text-xs">
                  {parcel._declarationHistory.map((h) => (
                    <li key={h.log_id} className="rounded-lg bg-[#f9fafb] p-3 dark:bg-night-head">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[#27364f] dark:text-[#f1eeeb]">{h.action}</strong>
                        <span className="text-[#888]">
                          {h.actor_name} ({h.actor_role}) · {dateValue(h.created_at)}
                        </span>
                      </div>
                      {h.detail && <p className="mt-1 text-[#666] dark:text-[#d1c9c2]">{h.detail}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {Array.isArray(parcel?.attempts) && parcel.attempts.length > 0 && (
            <section className={`${panel} p-6`}>
              <h2 className="mb-4 text-lg font-bold">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-brand" />
                Delivery Attempts & Reschedule History ({parcel.attempts.length})
              </h2>
              <ol className="space-y-3 border-l-2 border-[#e5e8ee] pl-4 text-sm dark:border-night-line">
                {parcel.attempts.map((att, idx) => (
                  <li key={att.id || idx}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-[#27364f] dark:text-[#f1eeeb]">
                        Attempt #{att.attempt || idx + 1} · Scheduled: {formatDay(att.scheduledDate)}
                      </strong>
                      {att.outcome === "return_to_hub" ? (
                        <span className="rounded-full bg-[#f2ecff] px-3 py-0.5 text-xs font-bold text-[#7c3aed]">
                          Marked Return to Hub
                        </span>
                      ) : att.outcome === "delivered" ? (
                        <span className="rounded-full bg-[#eaf8ef] px-3 py-0.5 text-xs font-bold text-[#29945a]">
                          Delivered
                        </span>
                      ) : att.rescheduledTo ? (
                        <span className="rounded-full bg-[#fff4d8] px-3 py-0.5 text-xs font-bold text-[#c98200]">
                          Rescheduled → {formatDay(att.rescheduledTo)} (Day {att.rescheduleDay || 1}/3)
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium text-[#d94747]">Failure Reason: {att.reason}</p>
                    {att.note && <p className="mt-0.5 text-xs text-[#888]">{att.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </>
  );
}
