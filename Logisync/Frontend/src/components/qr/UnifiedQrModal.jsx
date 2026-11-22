import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "../ui.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { btnGhost, btnPrimary } from "../styles.js";
import { toast } from "../../store/toast.js";
import Icon from "../Icon.jsx";

export default function UnifiedQrModal({ parcel, open, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!parcel) return null;

  const txn = String(parcel.transaction_number || parcel.parcel_id || "").trim();
  const parcelId = String(parcel.parcel_id || "").trim();
  const receiver = parcel.receiver_name || parcel.receiver || parcel.recipient || "—";
  const address = parcel.receiver_address || parcel.address || "—";
  const seller = parcel.seller_name || parcel.seller || "—";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(txn);
      setCopied(true);
      toast(`Transaction Number ${txn} copied.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Unable to copy.", "error");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      z="z-[3500]"
      className="w-full max-w-[440px] p-6 text-center dark:bg-night-panel"
    >
      <div className="flex items-center justify-between border-b border-[#eee] pb-3 text-left dark:border-night-line">
        <div>
          <h3 className="text-[17px] font-bold text-[#1e293b] dark:text-white">Unified Parcel QR Code</h3>
          <p className="text-[12px] text-[#64748b] dark:text-[#9c948c]">Permanent barcode for delivery & hub verification</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] hover:text-[#1e293b] dark:bg-night-line dark:hover:text-white"
        >
          <Icon name="x" className="text-sm" />
        </button>
      </div>

      <div className="my-5 flex flex-col items-center">
        <div className="rounded-2xl border-2 border-[#ff6b00]/30 bg-white p-4 shadow-md dark:border-brand/40">
          <QRCodeSVG
            value={txn}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
        <p className="mt-3 font-mono text-[16px] font-bold tracking-wider text-[#1e293b] dark:text-white">
          {txn}
        </p>
        {parcelId && parcelId !== txn && (
          <p className="text-[12px] text-[#64748b] dark:text-[#9c948c]">
            Parcel ID: <span className="font-mono font-medium">{parcelId}</span>
          </p>
        )}
        <div className="mt-2">
          <StatusBadge status={parcel.status} />
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3 text-left text-[12.5px] dark:border-night-line dark:bg-night-soft">
        <div className="grid grid-cols-[80px_1fr] gap-1.5">
          <span className="text-[#64748b] dark:text-[#9c948c]">Recipient:</span>
          <span className="font-medium text-[#1e293b] dark:text-white">{receiver}</span>
          <span className="text-[#64748b] dark:text-[#9c948c]">Address:</span>
          <span className="break-words font-medium text-[#1e293b] dark:text-white">{address}</span>
          <span className="text-[#64748b] dark:text-[#9c948c]">Seller:</span>
          <span className="font-medium text-[#1e293b] dark:text-white">{seller}</span>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-orange-50 p-2 text-left text-[11.5px] text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
        <Icon name="info" className="mr-1.5" />
        <strong>Permanent QR:</strong> Used for Rider Delivery, Rider Return to Hub, and Coordinator Physical Verification. Does not change with status updates.
      </div>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <button type="button" onClick={handleCopy} className={btnGhost}>
          <Icon name={copied ? "check" : "copy"} />
          {copied ? "Copied" : "Copy Code"}
        </button>
        <button type="button" onClick={handlePrint} className={btnPrimary}>
          <Icon name="printer" /> Print Waybill
        </button>
      </div>
    </Modal>
  );
}
