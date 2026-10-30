import { useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { Notice, PanelTitle } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel } from "../../components/styles.js";
import { createParcel } from "../../services/parcelService.js";
import { EMPTY_PARCEL, PARCEL_FIELDS, trimParcel, validateParcel } from "../../utils/parcelForm.js";
import ParcelCreated from "../../components/parcels/ParcelCreated.jsx";
import QrScanner from "../../components/qr/QrScanner.jsx";
import { parseTransactionNumber } from "../../utils/qr.js";

const STEPS = [
  ["fa-qrcode", "Scan or type", "Scan the Shopee QR on the parcel to fill in the transaction number."],
  ["fa-pen", "Enter receiver details", "Name, contact number and what is inside the parcel."],
  ["fa-video", "Upload video proof", "Record the packing of the parcel and upload it for verification."],
  ["fa-circle-check", "Coordinator verifies", "The coordinator reviews your video and approves the parcel."],
];

export default function CreateParcel() {
  const [values, setValues] = useState(EMPTY_PARCEL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "transaction_number" ? value.replace(/\D/g, "").slice(0, 11) : value;
    setValues((v) => ({ ...v, [name]: nextValue }));
    setErrors((er) => ({ ...er, [name]: undefined })); // burahin ang error ng field na ito
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    const found = validateParcel(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    try {
      setCreated(await createParcel(trimParcel(values)));
    } catch (err) {
      setApiError(err.message); // hal. "This transaction number is already registered."
    } finally {
      setSubmitting(false);
    }
  };

  // Galing sa Shopee QR: ilagay agad sa transaction number field
  const onScan = (text) => {
    const txn = parseTransactionNumber(text);
    setScanning(false);
    if (!txn) return setApiError("The QR code was empty. Try again or type the number.");
    setValues((v) => ({ ...v, transaction_number: txn.replace(/\D/g, "").slice(0, 11) }));
    setErrors((er) => ({ ...er, transaction_number: undefined }));
    setApiError("");
    setScanned(true);
  };

  const reset = () => {
    setScanning(false);
    setScanned(false);
    setValues(EMPTY_PARCEL);
    setErrors({});
    setApiError("");
    setCreated(null);
  };

  return (
    <>
      <Topbar title="Create Parcel" subtitle="Register a parcel so the coordinator can verify it. The system generates the parcel ID." />

      {created ? (
        <ParcelCreated parcel={created} onReset={reset} />
      ) : (
        <div className="grid grid-cols-[1.6fr_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
          <form onSubmit={onSubmit} noValidate className={`${panel} space-y-5 p-[30px] max-[600px]:p-5`}>
            <PanelTitle icon="fa-square-plus">Parcel Details</PanelTitle>

            {apiError && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{apiError}</Notice>}

            <div className="rounded-xl border border-dashed border-[#e0d3ca] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px]">
                  <i className={`fa-solid ${scanned ? "fa-circle-check text-[#29945a]" : "fa-qrcode text-brand"} mr-2`} />
                  {scanned ? "Transaction number scanned from the QR code." : "Scan the Shopee QR code on the parcel."}
                </p>
                <button type="button" onClick={() => setScanning((v) => !v)} className={btnGhost}>
                  {scanning ? "Close scanner" : scanned ? "Scan again" : "Open scanner"}
                </button>
              </div>
              {scanning && (
                <div className="mt-4">
                  <QrScanner onScan={onScan} />
                </div>
              )}
            </div>

            {PARCEL_FIELDS.map((f) => (
              <div key={f.name}>
                <label htmlFor={f.name} className={labelCls}>{f.label}</label>
                <input
                  id={f.name}
                  name={f.name}
                  type={f.name === "transaction_number" ? "text" : (f.type || "text")}
                  inputMode={f.name === "transaction_number" ? "numeric" : undefined}
                  pattern={f.name === "transaction_number" ? "[0-9]{11}" : undefined}
                  value={values[f.name]}
                  onChange={onChange}
                  placeholder={f.placeholder}
                  maxLength={f.max}
                  aria-invalid={!!errors[f.name]}
                  aria-describedby={`${f.name}-note`}
                  className={`${inputCls} ${errors[f.name] ? "!border-[#d94747]" : ""}`}
                />
                <p id={`${f.name}-note`} className={`mt-1 min-h-[16px] text-[12px] ${errors[f.name] ? "text-[#d94747]" : "text-[#999]"}`}>
                  {errors[f.name] || f.help || ""}
                </p>
              </div>
            ))}

            <div className="rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
              <label htmlFor="discrete_item" className="flex cursor-pointer items-start gap-3">
                <input
                  id="discrete_item"
                  name="discrete_item"
                  type="checkbox"
                  checked={Boolean(values.discrete_item)}
                  onChange={(e) => setValues((v) => ({ ...v, discrete_item: e.target.checked }))}
                  className="mt-1 h-4 w-4 accent-[#e87524]"
                />
                <span>
                  <strong className="block text-[14px]">Discrete item</strong>
                  <span className="mt-1 block text-[12px] leading-relaxed text-[#888]">Mark this parcel as requiring discreet handling. The selected label will be included with the parcel details when supported by the server.</span>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${values.discrete_item ? "bg-[#fff0df] text-[#a84d0b]" : "bg-[#f0f0f0] text-[#777]"}`}>
                    {values.discrete_item ? "Discrete item: Enabled" : "Discrete item: Not enabled"}
                  </span>
                </span>
              </label>
            </div>

            <button type="submit" disabled={submitting} className={`${btnPrimary} w-full sm:w-auto sm:px-8`}>
              <i className="fa-solid fa-check" /> {submitting ? "Registering..." : "Register parcel"}
            </button>
          </form>

          <aside className={`${panel} p-[30px] max-[600px]:p-5`}>
            <PanelTitle icon="fa-list-check">What happens next</PanelTitle>
            <ol className="space-y-5">
              {STEPS.map(([icon, title, text], i) => (
                <li key={title} className="flex gap-3.5">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-night-head">
                    <i className={`fa-solid ${icon}`} />
                  </span>
                  <div>
                    <strong className="block text-[14px]">{i + 1}. {title}</strong>
                    <p className="text-[13px] leading-relaxed text-[#888]">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </>
  );
}
