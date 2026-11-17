import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ShipmentDetailsView from "../components/parcels/ShipmentDetailsView.jsx";
import { EmptyState } from "../components/ui.jsx";
import { btnGhost, inputCls, panel } from "../components/styles.js";
import {
  decideDiscreetHandling,
  getByTransaction,
  getCoordinatorParcel,
} from "../services/parcelService.js";
import { getUser } from "../api.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";

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
  const [discreetRemarks, setDiscreetRemarks] = useState("");
  const [discreetBusy, setDiscreetBusy] = useState(false);
  const user = getUser();
  const isCoordinator = user?.role === "coordinator";

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
        _videos: result?.videos || [],
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

  if (loading) {
    return (
      <section className={`${panel} mx-auto max-w-5xl p-8 text-sm text-[#999]`}>
        Loading shipment details…
      </section>
    );
  }

  if (error || !parcel) {
    return (
      <section className={`${panel} mx-auto max-w-5xl p-8`}>
        <EmptyState icon="fa-box-open" title="Shipment details unavailable" text={error || "Parcel not found."} />
        <div className="mt-4 text-center">
          <Link to="/parcels" className={btnGhost}>
            Back to Parcel Records
          </Link>
        </div>
      </section>
    );
  }

  const coordinatorSlot =
    isCoordinator && parcel.discrete_item ? (
      <section className={`${panel} p-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14.5px] font-bold text-[#1e293b] dark:text-white">
            Coordinator Discreet Handling Verification
          </h3>
          {parcel.discreet_reviewed_at && (
            <span className="text-xs text-[#888]">
              Reviewed {dateValue(parcel.discreet_reviewed_at)}
              {parcel.discreet_reviewer_name ? ` by ${parcel.discreet_reviewer_name}` : ""}
            </span>
          )}
        </div>
        <p className="mb-3 rounded-lg border border-[#e7dcd4] bg-[#fffaf7] p-3 text-xs text-[#333] dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]">
          <strong>Seller reason:</strong> {parcel.discreet_reason || "No explanation provided."}
        </p>
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
      </section>
    ) : null;

  return (
    <ShipmentDetailsView
      parcel={parcel}
      videos={parcel._videos || []}
      verificationRecords={parcel._verificationRecords || []}
      backTo="/parcels"
      backLabel="Back to Parcel Records"
      coordinatorSlot={coordinatorSlot}
    />
  );
}
