import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, StatusBadge } from "../components/ui.jsx";
import { btnGhost, btnPrimary, panel } from "../components/styles.js";
import { getCoordinatorParcel, getByTransaction } from "../services/parcelService.js";
import { getParcelStatus } from "../utils/parcelStatus.js";
import { formatDay } from "../utils/format.js";
import { coordinateReturn } from "../store/failedDeliveries.js";
import { toast } from "../store/toast.js";

const value = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const dateValue = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

export default function ParcelDetails() {
  const { id = "" } = useParams();
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setParcel({ ...record, _verificationRecords: result?.verification_records || [] });
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

  const verification = parcel?.verification_status || parcel?.verification || parcel?.status;
  const delivery = getParcelStatus(parcel || {});
  const fields = [
    ["Parcel ID", parcel?.parcel_id || parcel?.id],
    ["Transaction Number", parcel?.transaction_number],
    ["Parcel Status", parcel?.status],
    ["Seller Name", parcel?.seller_name || parcel?.seller?.name],
    ["Assigned Rider Name", parcel?.rider_name || parcel?.assigned_rider_name || parcel?.rider?.name || parcel?.deliveryRecord?.rider_name],
    ["Parcel Creation Date", dateValue(parcel?.created_at)],
    ["Verification Status", verification],
    ["Delivery Status", delivery],
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
        title={loading ? "Parcel Details" : `Parcel ${parcel?.parcel_id || parcel?.transaction_number || "Details"}`}
        subtitle="Parcel record, verification status, rescheduling history, and Return-to-Hub coordination."
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
          {parcel?.returnToHub && (
            <section className="rounded-2xl border border-[#d8b4fe] bg-[#faf7ff] p-5 dark:border-[#5b21b6] dark:bg-[#221933]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#6d28d9] dark:text-[#c4b5fd]">
                    <i className="fa-solid fa-warehouse mr-2" />
                    Return to Hub — Maximum 3-Day Rescheduling Limit Reached
                  </h2>
                  <p className="mt-1 text-[13px] text-[#666] dark:text-[#d1c9c2]">
                    This parcel remained undelivered after 3 rescheduled delivery days ({parcel.lastFailure || "undelivered"}) and has been removed from the rider&apos;s pending deliveries.
                  </p>
                </div>
                {parcel.returnCoordinated ? (
                  <span className="rounded-full bg-[#eaf8ef] px-3.5 py-1.5 text-[12.5px] font-bold text-[#29945a]">
                    <i className="fa-solid fa-circle-check mr-1.5" /> Return to Seller Coordinated
                  </span>
                ) : (
                  <button onClick={handleCoordinateReturn} className={btnPrimary}>
                    <i className="fa-solid fa-rotate-left" /> Coordinate Return to Seller
                  </button>
                )}
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
              <h2 className="mb-4 text-lg font-bold">Additional Details</h2>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Recipient</span>
                <span className="text-right text-sm font-semibold">
                  {value(parcel.receiver_name || parcel.recipient_name)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Address</span>
                <span className="text-right text-sm font-semibold">
                  {value(parcel.receiver_address || parcel.address)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Contact</span>
                <span className="text-right text-sm font-semibold">{value(parcel.receiver_contact)}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line">
                <span className="text-sm text-[#999]">Contents</span>
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
