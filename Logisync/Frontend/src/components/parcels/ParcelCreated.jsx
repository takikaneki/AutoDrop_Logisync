import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import { DetailList, Notice } from "../portal.jsx";
import { btnGhost, btnPrimary, panel } from "../styles.js";

// Ipinapakita pagkatapos matagumpay na ma-register ang parcel.
// Lahat ng laman ay galing sa sagot ng backend.
export default function ParcelCreated({ parcel, onReset }) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(parcel.parcel_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* hindi pinayagan ng browser ang clipboard */
    }
  };

  return (
    <section className={`${panel} max-w-4xl space-y-6 p-[30px] max-[600px]:p-5`}>
      <Notice tone="success" icon="fa-circle-check" role="status">
        <strong>Parcel registered successfully.</strong> Next step: upload the video proof.
      </Notice>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">Parcel ID</p>
          <p className="font-mono text-[20px] font-bold">{parcel.parcel_id}</p>
        </div>
        <StatusBadge status={parcel.status} />
      </div>

      <DetailList
        rows={[
          ["Transaction number", parcel.transaction_number],
          ["Receiver", parcel.receiver_name],
          ["Contact", parcel.receiver_contact],
          ["Contents", parcel.contents],
        ]}
      />

      <p className="rounded-xl bg-[#fafafa] p-3.5 text-[13px] text-[#777] dark:bg-night-head dark:text-[#d1c9c2]">
        <i className="fa-solid fa-qrcode mr-2 text-brand" />
        Use the Shopee QR already on the parcel. LogiSync does not make its own QR.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link to={`/seller/scan?txn=${encodeURIComponent(parcel.transaction_number)}`} className={btnPrimary}>
          <i className="fa-solid fa-video" /> Upload video now
        </Link>
        <button type="button" onClick={copyId} className={btnGhost}>
          <i className="fa-regular fa-copy" /> {copied ? "Copied!" : "Copy parcel ID"}
        </button>
        <button type="button" onClick={onReset} className={btnGhost}>Register another parcel</button>
      </div>
    </section>
  );
}
