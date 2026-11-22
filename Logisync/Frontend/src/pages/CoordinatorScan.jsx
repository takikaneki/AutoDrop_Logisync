import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import ScanPanel from "../components/qr/ScanPanel.jsx";
import CoordinatorRthModal from "../components/coordinator/CoordinatorRthModal.jsx";
import { panel } from "../components/styles.js";
import { findParcel } from "../services/parcelService.js";

export default function CoordinatorScan() {
  const navigate = useNavigate();
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");
  const [rthParcel, setRthParcel] = useState(null);

  const handleLookup = async (value) => {
    const code = String(value || "").trim();
    if (!code) return;
    setLooking(true);
    setError("");
    try {
      const res = await findParcel(code, "coordinator");
      const p = res?.parcel || res;
      if (!p) {
        setError("Parcel not found.");
        return;
      }
      const rthStatus = String(p.rth_status || "").toUpperCase();
      const status = String(p.status || "").toUpperCase();
      if (rthStatus === "PENDING" || rthStatus === "PENDING_CONFIRMATION" || status === "RTH_PENDING" || status === "RETURN_TO_HUB") {
        setRthParcel(p);
        return;
      }
      const txn = p.transaction_number || p.parcel_id || code;
      navigate(`/verification?txn=${encodeURIComponent(txn)}`);
    } catch (err) {
      setError(err?.message || "Could not find parcel.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <>
      <Topbar
        title="Scan QR"
        subtitle="Scan a parcel QR code or enter its transaction number to verify packing proof or confirm Return to Hub arrival."
      />

      <section className={`${panel} mx-auto max-w-[780px] p-6 max-[600px]:p-4`}>
        <ScanPanel
          onResult={handleLookup}
          busy={looking}
          error={error}
          placeholder="Transaction number or parcel ID…"
          btnClass="bg-brand hover:bg-brand-dark"
        />
      </section>

      {rthParcel && (
        <CoordinatorRthModal
          parcel={rthParcel}
          open={!!rthParcel}
          onClose={() => setRthParcel(null)}
          onConfirmed={() => {
            setRthParcel(null);
            navigate("/parcels");
          }}
        />
      )}
    </>
  );
}
