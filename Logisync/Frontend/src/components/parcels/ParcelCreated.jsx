import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../StatusBadge.jsx";
import { DetailList, Notice } from "../portal.jsx";
import { btnGhost, btnPrimary, panel } from "../styles.js";
import { getParcelAddress } from "../../store/customers.js";

// Ipinapakita pagkatapos matagumpay na ma-register ang parcel.
// Lahat ng laman ay galing sa sagot ng backend (+ saved address).
export default function ParcelCreated({ parcel, onReset }) {
  const [copied, setCopied] = useState(false);
  const address = getParcelAddress(parcel);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(parcel.parcel_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* hindi pinayagan ng browser ang clipboard */
    }
  };

  const categoryDisplay = parcel.content_category
    ? parcel.content_category === "Other" && parcel.other_category_description
      ? `Other (${parcel.other_category_description})`
      : parcel.content_category
    : "Unspecified";

  const discreetDisplay = parcel.discrete_item
    ? `Yes — Pending Coordinator Review`
    : "No (Standard Handling)";

  return (
    <section className={`${panel} max-w-4xl space-y-6 p-[30px] max-[600px]:p-5`}>
      <Notice tone="success" icon="fa-circle-check" role="status">
        <strong>Parcel registered successfully.</strong> Next step: upload the packing video proof so the Coordinator can verify your parcel and declaration.
      </Notice>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">Parcel ID</p>
          <p className="font-mono text-[20px] font-bold" title={parcel.parcel_id}>
            {parcel.parcel_id && parcel.parcel_id.length > 10
              ? `${parcel.parcel_id.slice(0, 2)}-${parcel.parcel_id.slice(-6)}`
              : parcel.parcel_id}
          </p>
        </div>
        <StatusBadge status={parcel.status} />
      </div>

      <DetailList
        rows={[
          ["Transaction number", parcel.transaction_number],
          ["Receiver", parcel.receiver_name],
          ["Address", address],
          ["Contact", parcel.receiver_contact],
          ["Declared category", categoryDisplay],
          ["Item description", parcel.contents],
          ["Discreet handling requested", discreetDisplay],
          ...(parcel.discrete_item && parcel.discreet_reason
            ? [["Seller's explanation", parcel.discreet_reason]]
            : []),
        ]}
      />

      {parcel.discrete_item && (
        <div className="rounded-xl border border-[#f5d0a9] bg-[#fff8f0] p-3.5 text-[12.5px] leading-relaxed text-[#8a4b14] dark:border-[#c97c10]/40 dark:bg-[#c97c10]/10 dark:text-[#f2c278]">
          <i className="fa-solid fa-user-shield mr-2 text-[#c97c10]" />
          <strong>Discreet handling is pending Coordinator verification.</strong> Please upload a clear packing video showing the declared item ({categoryDisplay}) before sealing the parcel.
        </div>
      )}

      <p className="rounded-xl bg-[#fafafa] p-3.5 text-[13px] text-[#777] dark:bg-night-head dark:text-[#d1c9c2]">
        <i className="fa-solid fa-qrcode mr-2 text-brand" />
        Use the Shopee QR already on the parcel. SPX Express / LogiSync uses the parcel&apos;s existing transaction QR.
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
