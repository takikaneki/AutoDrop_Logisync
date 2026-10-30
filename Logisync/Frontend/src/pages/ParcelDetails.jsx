import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, StatusBadge } from "../components/ui.jsx";
import { btnGhost, panel } from "../components/styles.js";
import { getCoordinatorParcel, getByTransaction } from "../services/parcelService.js";
import { getParcelStatus } from "../utils/parcelStatus.js";

const value = (v) => v === null || v === undefined || v === "" ? "—" : v;
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

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        let result;
        try {
          result = await getCoordinatorParcel(decodeURIComponent(id));
        } catch (firstError) {
          // Activity logs may store a transaction number as target; support that existing API too.
          result = await getByTransaction(decodeURIComponent(id));
        }
        const record = result?.parcel || result;
        if (!record || !(record.parcel_id || record.id || record.transaction_number)) {
          throw new Error("The server did not return parcel details.");
        }
        if (active) setParcel({ ...record, _verificationRecords: result?.verification_records || [] });
      } catch (e) {
        if (active) setError(e.message || "Unable to load parcel details.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  const verification = parcel?.verification_status || parcel?.verification || parcel?.status;
  const delivery = getParcelStatus(parcel || {});
  const fields = [
    ["Parcel ID", parcel?.parcel_id || parcel?.id],
    ["Transaction Number", parcel?.transaction_number],
    ["Parcel Status", parcel?.status],
    ["Seller Name", parcel?.seller_name || parcel?.seller?.name],
    ["Assigned Rider Name", parcel?.rider_name || parcel?.assigned_rider_name || parcel?.rider?.name],
    ["Parcel Creation Date", dateValue(parcel?.created_at)],
    ["Verification Status", verification],
    ["Delivery Status", delivery],
  ];

  return <>
    <Topbar title={loading ? "Parcel Details" : `Parcel ${parcel?.parcel_id || parcel?.transaction_number || "Details"}`} subtitle="Parcel record and current verification and delivery information.">
      <Link to="/parcels" className={btnGhost}><i className="fa-solid fa-arrow-left" /> Back to Parcels</Link>
    </Topbar>
    {loading ? <section className={`${panel} p-8 text-sm text-[#999]`}>Loading parcel details…</section> : error ? <section className={`${panel} p-8`}>
      <EmptyState icon="fa-box-open" title="Parcel details unavailable" text={error} />
      <div className="text-center"><Link to="/parcels" className={btnGhost}>Back to Parcels</Link></div>
    </section> : <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
      <section className={`${panel} p-6`}>
        <h2 className="text-lg font-bold mb-4">Parcel Information</h2>
        {fields.map(([label, raw]) => <div key={label} className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 last:border-0 dark:border-night-line">
          <span className="text-sm text-[#999]">{label}</span>
          <span className="text-sm font-semibold text-right break-words">{label === "Delivery Status" ? <StatusBadge status={raw} /> : value(raw)}</span>
        </div>)}
      </section>
      <section className={`${panel} p-6`}>
        <h2 className="text-lg font-bold mb-4">Additional Details</h2>
        <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line"><span className="text-sm text-[#999]">Recipient</span><span className="text-sm font-semibold text-right">{value(parcel.receiver_name || parcel.recipient_name)}</span></div>
        <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line"><span className="text-sm text-[#999]">Contents</span><span className="text-sm font-semibold text-right">{value(parcel.contents || parcel.item)}</span></div>
        <div className="flex justify-between gap-4 border-b border-[#f1f1f1] py-3 dark:border-night-line"><span className="text-sm text-[#999]">Delivery Updated</span><span className="text-sm font-semibold text-right">{dateValue(parcel.delivered_at || parcel.updated_at)}</span></div>
        <div className="flex justify-between gap-4 py-3"><span className="text-sm text-[#999]">Assigned Rider</span><span className="text-sm font-semibold text-right">{value(parcel.rider_name || parcel.assigned_rider_name || parcel.rider?.name)}</span></div>
      </section>
    </div>}
  </>;
}
