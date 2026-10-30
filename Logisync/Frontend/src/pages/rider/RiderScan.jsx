import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import RecentScans from "../../components/rider/RecentScans.jsx";
import { DetailList, Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, panel } from "../../components/styles.js";
import { findParcel } from "../../services/parcelService.js";
import { logScan, useRiderScans } from "../../store/riderScans.js";
import { addToDeliver, findAssigned } from "../../store/riderDeliveries.js";
import { formatDate } from "../../utils/format.js";

// Ano ang ibig sabihin ng status para sa rider (galing lang sa status na ibinalik ng backend)
function readiness(status) {
  if (status === "VERIFIED") return { tone: "success", icon: "fa-circle-check", title: "Cleared for delivery", text: "The coordinator verified this parcel. You can proceed with the delivery." };
  if (status === "REJECTED") return { tone: "error", icon: "fa-ban", title: "Do not deliver", text: "This parcel was rejected by the coordinator. Message the coordinator before doing anything." };
  if (status === "REUPLOAD_REQUESTED") return { tone: "warn", icon: "fa-rotate-left", title: "On hold", text: "The seller must upload a new video. Do not take this parcel yet." };
  return { tone: "warn", icon: "fa-hourglass-half", title: "Not verified yet", text: "The coordinator has not verified this parcel. Do not take it until it is verified." };
}

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Rider: i-scan ang QR ng parcel. Kapag verified, napupunta agad sa "To Be Delivered".
// Galing sa dashboard: /rider/scan?expect=<parcel> = hinihintay ang QR ng partikular na assigned parcel.
export default function RiderScan() {
  const [params, setParams] = useSearchParams();
  const scans = useRiderScans();
  const [parcel, setParcel] = useState(null);
  const [outcome, setOutcome] = useState(""); // "added" | "exists" | "not_cleared"
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");
  const expect = params.get("expect");

  const lookup = async (value) => {
    setLooking(true);
    setError("");
    try {
      // Una sa mga assigned sa rider; kung wala, sa backend
      const local = findAssigned(value);
      const data = local ? { parcel: local } : await findParcel(value, "rider");
      const p = data.parcel;
      if (expect && !same(p.parcel_id, expect) && !same(p.transaction_number, expect)) {
        setParcel(null);
        setError(`That QR is for a different parcel. Please scan the QR of ${expect}.`);
        return;
      }
      setParcel(p);
      logScan(p, value);
      setOutcome(addToDeliver(p, value));
    } catch (err) {
      setParcel(null);
      setError(err.message);
    } finally {
      setLooking(false);
    }
  };

  // Galing sa Recent Scans ("Check again"): /rider/scan?txn=...
  useEffect(() => {
    const txn = params.get("txn");
    if (txn) lookup(txn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setParcel(null);
    setOutcome("");
    setError("");
    params.delete("txn");
    params.delete("expect");
    setParams(params, { replace: true });
  };

  const r = parcel && readiness(parcel.status);

  return (
    <>
      <Topbar title="Scan QR Code" subtitle="Scan the parcel's QR code. Cleared parcels go straight to your To Be Delivered list.">
        {parcel && (
          <button onClick={reset} className={btnGhost}>
            <i className="fa-solid fa-qrcode" /> Scan another parcel
          </button>
        )}
      </Topbar>

      {!parcel && (
        <section className={`${panel} mb-6 p-[30px] max-[600px]:p-5`}>
          {expect && (
            <div className="mb-5">
              <Notice tone="info" icon="fa-qrcode">
                Scanning for assigned parcel <strong>{expect}</strong>.{" "}
                <button onClick={reset} className="font-bold underline">Scan any parcel instead</button>
              </Notice>
            </div>
          )}
          <ScanPanel onValue={lookup} busy={looking} />
          {looking && <p className="mt-4 text-[14px] text-[#999]">Looking up parcel…</p>}
          {error && <div className="mt-4"><Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice></div>}
        </section>
      )}

      {parcel && (
        <section className={`${panel} mb-6 space-y-6 p-[30px] max-[600px]:p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">Parcel ID</p>
              <p className="font-mono text-[20px] font-bold">{parcel.parcel_id}</p>
            </div>
            <StatusBadge status={parcel.status} />
          </div>

          <Notice tone={r.tone} icon={r.icon} role="status">
            <strong className="block">{r.title}</strong>
            <span>{r.text}</span>
          </Notice>

          <DetailList
            rows={[
              ["Transaction number", parcel.transaction_number],
              ["Receiver", parcel.receiver],
              ["Receiver contact", parcel.receiver_contact],
              ["Address", parcel.address],
              ["Contents", parcel.contents],
              ["Seller", parcel.seller],
              ["Verification", parcel.verification_status?.replaceAll("_", " ")],
              ["Last updated", parcel.updated_at ? formatDate(parcel.updated_at) : ""],
            ]}
          />

          {outcome === "added" && (
            <Notice tone="success" icon="fa-truck-fast" role="status">
              <strong className="block">Added to To Be Delivered</strong>
              <span>Mark it as delivered (with proof) or failed (with a reason) once you reach the recipient.</span>
            </Notice>
          )}
          {outcome === "exists" && (
            <Notice tone="info" icon="fa-circle-info" role="status">This parcel is already in your delivery list.</Notice>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafafa] p-4 text-[13px] text-[#777] dark:bg-night-head dark:text-[#d1c9c2]">
            {outcome !== "not_cleared" ? (
              <Link to="/rider/deliveries" className={btnPrimary}>Go to Deliveries</Link>
            ) : (
              <span><i className="fa-solid fa-circle-info mr-2 text-brand" />This parcel was not added to your delivery list.</span>
            )}
            <Link to="/rider/messages" className="font-bold text-brand hover:underline">Message coordinator →</Link>
          </div>
        </section>
      )}

      <RecentScans scans={scans} limit={8} />
    </>
  );
}
