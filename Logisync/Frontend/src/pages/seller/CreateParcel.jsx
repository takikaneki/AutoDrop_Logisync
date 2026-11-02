import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { Notice, PanelTitle } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel } from "../../components/styles.js";
import { createParcel, listParcels } from "../../services/parcelService.js";
import { EMPTY_PARCEL, PARCEL_FIELDS, trimParcel, validateParcel } from "../../utils/parcelForm.js";
import ParcelCreated from "../../components/parcels/ParcelCreated.jsx";
import QrScanner from "../../components/qr/QrScanner.jsx";
import { parseTransactionNumber } from "../../utils/qr.js";
import { findCustomerByName, searchCustomers, useCustomers } from "../../store/customers.js";

const STEPS = [
  ["fa-qrcode", "Scan or type", "Scan the Shopee QR on the parcel to fill in the transaction number."],
  ["fa-user-check", "Enter customer details", "Type an existing customer name to auto-fill their saved address and contact, or enter a new customer."],
  ["fa-video", "Upload video proof", "Record the packing of the parcel and upload it for verification."],
  ["fa-circle-check", "Coordinator verifies", "The coordinator reviews your video and approves the parcel."],
];

export default function CreateParcel() {
  const customers = useCustomers();
  const [values, setValues] = useState(EMPTY_PARCEL);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Track customer auto-fill state so we never overwrite manual edits unintentionally
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [updateSavedCustomer, setUpdateSavedCustomer] = useState(false);
  const autoFilledRef = useRef({ address: false, contact: false });
  const nameWrapRef = useRef(null);

  // Sync seller's existing parcels from backend on mount so all previous customers are available
  useEffect(() => {
    listParcels().catch(() => {});
  }, []);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    if (!suggestOpen) return;
    const onDown = (e) => {
      if (!nameWrapRef.current?.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestOpen]);

  const suggestions = useMemo(
    () => searchCustomers(values.receiver_name, 5),
    [values.receiver_name, customers] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const applyCustomerMatch = (customer, nameValue) => {
    setMatchedCustomer(customer);
    setUpdateSavedCustomer(false);
    autoFilledRef.current = {
      address: Boolean(customer.address),
      contact: Boolean(customer.contact),
    };
    setValues((v) => ({
      ...v,
      receiver_name: nameValue ?? customer.name,
      receiver_address: customer.address || v.receiver_address,
      receiver_contact: customer.contact || v.receiver_contact,
    }));
    setErrors((er) => ({
      ...er,
      receiver_name: undefined,
      ...(customer.address ? { receiver_address: undefined } : {}),
      ...(customer.contact ? { receiver_contact: undefined } : {}),
    }));
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "transaction_number" ? value.replace(/\D/g, "").slice(0, 11) : value;

    if (name === "receiver_name") {
      const found = findCustomerByName(nextValue);
      if (found) {
        applyCustomerMatch(found, nextValue);
        return;
      }

      // Customer name is new / no longer matches an existing customer:
      // Clear fields that were auto-filled from a previous match so seller can type new details cleanly,
      // while preserving any value the seller manually entered.
      const clearAddr = autoFilledRef.current.address;
      const clearContact = autoFilledRef.current.contact;
      setMatchedCustomer(null);
      setUpdateSavedCustomer(false);
      autoFilledRef.current = { address: false, contact: false };

      setValues((v) => ({
        ...v,
        receiver_name: nextValue,
        receiver_address: clearAddr ? "" : v.receiver_address,
        receiver_contact: clearContact ? "" : v.receiver_contact,
      }));
      setErrors((er) => ({ ...er, receiver_name: undefined }));
      return;
    }

    if (name === "receiver_address") {
      autoFilledRef.current.address = false;
    }
    if (name === "receiver_contact") {
      autoFilledRef.current.contact = false;
    }

    setValues((v) => ({ ...v, [name]: nextValue }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const hasEditedMatchedDetails =
    matchedCustomer &&
    ((matchedCustomer.address && values.receiver_address.trim() !== matchedCustomer.address) ||
      (matchedCustomer.contact && values.receiver_contact.trim() !== matchedCustomer.contact));

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
      const payload = {
        ...trimParcel(values),
        updateExistingCustomer: Boolean(updateSavedCustomer),
      };
      setCreated(await createParcel(payload));
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
    setMatchedCustomer(null);
    setUpdateSavedCustomer(false);
    autoFilledRef.current = { address: false, contact: false };
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

            {PARCEL_FIELDS.map((f) => {
              const isNameField = f.name === "receiver_name";
              const isAutoField = f.name === "receiver_address" || f.name === "receiver_contact";
              const isAutoFilled =
                (f.name === "receiver_address" && matchedCustomer?.address && values.receiver_address === matchedCustomer.address) ||
                (f.name === "receiver_contact" && matchedCustomer?.contact && values.receiver_contact === matchedCustomer.contact);

              return (
                <div key={f.name} ref={isNameField ? nameWrapRef : undefined} className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={f.name} className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                      {f.label}
                    </label>
                    {isNameField && matchedCustomer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f7f4a] dark:bg-[#29945a]/20 dark:text-[#8fd6ae]">
                        <i className="fa-solid fa-user-check text-[10px]" /> Existing customer found
                      </span>
                    )}
                    {isNameField && !matchedCustomer && values.receiver_name.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#3a6ea5] dark:bg-[#4285c5]/20 dark:text-[#9cc3ea]">
                        <i className="fa-solid fa-user-plus text-[10px]" /> New customer
                      </span>
                    )}
                    {isAutoField && isAutoFilled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand dark:bg-night-head">
                        <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> Auto-filled (editable)
                      </span>
                    )}
                  </div>

                  <input
                    id={f.name}
                    name={f.name}
                    type={f.name === "transaction_number" ? "text" : (f.type || "text")}
                    inputMode={f.name === "transaction_number" ? "numeric" : undefined}
                    pattern={f.name === "transaction_number" ? "[0-9]{11}" : undefined}
                    autoComplete={isNameField ? "off" : undefined}
                    value={values[f.name]}
                    onFocus={isNameField ? () => setSuggestOpen(true) : undefined}
                    onChange={(e) => {
                      if (isNameField) setSuggestOpen(true);
                      onChange(e);
                    }}
                    placeholder={f.placeholder}
                    maxLength={f.max}
                    aria-invalid={!!errors[f.name]}
                    aria-describedby={`${f.name}-note`}
                    className={`${inputCls} ${errors[f.name] ? "!border-[#d94747]" : isAutoFilled ? "border-brand/50 bg-[#fffaf7] dark:bg-night-head" : ""}`}
                  />

                  {/* Autocomplete customer suggestions dropdown */}
                  {isNameField && suggestOpen && suggestions.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="Saved customers"
                      className="absolute left-0 right-0 top-[68px] z-30 max-h-60 overflow-y-auto rounded-xl border border-[#e5e5e5] bg-white shadow-lg dark:border-night-line dark:bg-night-panel"
                    >
                      <div className="flex items-center justify-between border-b border-[#f1f1f1] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#999] dark:border-night-line">
                        <span>Saved customers (tap to auto-fill)</span>
                        <button
                          type="button"
                          onClick={() => setSuggestOpen(false)}
                          className="text-[#999] hover:text-brand"
                        >
                          Close
                        </button>
                      </div>
                      {suggestions.map((c) => {
                        const isSelected = matchedCustomer?.name.toLowerCase() === c.name.toLowerCase();
                        return (
                          <button
                            key={c.name}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              applyCustomerMatch(c, c.name);
                              setSuggestOpen(false);
                            }}
                            className={`flex w-full items-start justify-between gap-3 border-b border-[#f7f7f7] px-3.5 py-2.5 text-left text-[13px] transition last:border-b-0 hover:bg-[#fff6ef] dark:border-night-line dark:hover:bg-night-head ${
                              isSelected ? "bg-[#fff6ef] dark:bg-night-head" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate text-[#27364f] dark:text-[#f1eeeb]">{c.name}</strong>
                              <span className="block truncate text-[12px] text-[#888]">
                                {c.address || "No saved address"}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-[12px] font-semibold text-brand">
                              {c.contact || "—"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p id={`${f.name}-note`} className={`mt-1 min-h-[16px] text-[12px] ${errors[f.name] ? "text-[#d94747]" : "text-[#999]"}`}>
                    {errors[f.name] || f.help || ""}
                  </p>

                  {isNameField && matchedCustomer && (
                    <div className="mt-2 rounded-xl border border-[#cbead8] bg-[#f3fbf6] px-3.5 py-2.5 text-[12.5px] text-[#1f7f4a] dark:border-[#29945a]/30 dark:bg-[#29945a]/10 dark:text-[#8fd6ae]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <i className="fa-solid fa-circle-check mr-1.5" />
                          Saved details for <strong>{matchedCustomer.name}</strong> were populated automatically. You can still review and edit the address or contact number below.
                        </span>
                      </div>
                      {hasEditedMatchedDetails && (
                        <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-[#cbead8]/70 pt-2 text-[12px] font-medium dark:border-[#29945a]/25">
                          <input
                            type="checkbox"
                            checked={updateSavedCustomer}
                            onChange={(e) => setUpdateSavedCustomer(e.target.checked)}
                            className="h-3.5 w-3.5 accent-[#1f7f4a]"
                          />
                          <span>
                            Update saved customer profile with these edited details for future parcels (otherwise existing saved customer details remain unchanged)
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

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
