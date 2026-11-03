import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { Notice, PanelTitle } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel } from "../../components/styles.js";
import { createParcel, fetchSellerCustomers } from "../../services/parcelService.js";
import {
  CONTENT_CATEGORIES,
  EMPTY_PARCEL,
  PARCEL_FIELDS,
  evaluateDeclarationFlags,
  isCategoryDiscreetEligible,
  trimParcel,
  validateParcel,
} from "../../utils/parcelForm.js";
import ParcelCreated from "../../components/parcels/ParcelCreated.jsx";
import QrScanner from "../../components/qr/QrScanner.jsx";
import { parseTransactionNumber } from "../../utils/qr.js";
import { findCustomerByName, searchCustomers, useCustomers } from "../../store/customers.js";

const STEPS = [
  ["fa-qrcode", "Scan or type", "Scan the Shopee QR on the parcel to fill in the transaction number."],
  ["fa-user-check", "Enter customer details", "Type an existing customer name to auto-fill their saved address and contact, or enter a new customer."],
  ["fa-clipboard-check", "Declare contents & privacy", "Select the accurate content category and provide a valid reason if discreet handling is needed."],
  ["fa-video", "Upload video proof", "Record the packing of the parcel and upload it for Coordinator verification."],
  ["fa-circle-check", "Coordinator verifies", "The coordinator reviews your declaration, discreet request, and video proof before approving."],
];

const CATEGORY_ICONS = {
  "Clothing and Accessories": "fa-shirt",
  "Beauty and Personal Care": "fa-spray-can-sparkles",
  "Health and Wellness Products": "fa-heart-pulse",
  "Personal or Intimate Products": "fa-user-shield",
  "Electronics and Gadgets": "fa-mobile-screen-button",
  "Household Items": "fa-house-chimney",
  Other: "fa-box-open",
};

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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [updateSavedCustomer, setUpdateSavedCustomer] = useState(false);
  const autoFilledRef = useRef({ address: false, contact: false });
  const nameWrapRef = useRef(null);
  const categoryWrapRef = useRef(null);

  // Retrieve seller's saved customers from the database on mount
  useEffect(() => {
    fetchSellerCustomers().catch(() => {});
  }, []);

  // Close customer suggestions dropdown when clicking outside
  useEffect(() => {
    if (!suggestOpen) return;
    const onDown = (e) => {
      if (!nameWrapRef.current?.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestOpen]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!categoryOpen) return;
    const onDown = (e) => {
      if (!categoryWrapRef.current?.contains(e.target)) setCategoryOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [categoryOpen]);

  const suggestions = useMemo(
    () => searchCustomers(values.receiver_name, 5),
    [values.receiver_name, customers] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const selectedCategoryMeta = useMemo(
    () => CONTENT_CATEGORIES.find((c) => c.value === values.content_category) || null,
    [values.content_category]
  );

  const canRequestDiscreet = Boolean(selectedCategoryMeta?.discreetTypical);

  const liveWarnings = useMemo(() => evaluateDeclarationFlags(values), [values]);

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

    const resetDiscreet =
      name === "content_category" && !isCategoryDiscreetEligible(nextValue);

    setValues((v) => ({
      ...v,
      [name]: nextValue,
      ...(name === "content_category" && nextValue !== "Other"
        ? { other_category_description: "" }
        : {}),
      ...(resetDiscreet ? { discrete_item: false, discreet_reason: "" } : {}),
    }));
    setErrors((er) => ({
      ...er,
      [name]: undefined,
      ...(name === "content_category" && nextValue !== "Other"
        ? { other_category_description: undefined }
        : {}),
      ...(resetDiscreet ? { discreet_reason: undefined } : {}),
    }));
  };

  const setDiscreetOption = (requiresDiscreet) => {
    setValues((v) => ({
      ...v,
      discrete_item: requiresDiscreet,
      discreet_reason: requiresDiscreet ? v.discreet_reason : "",
    }));
    setErrors((er) => ({
      ...er,
      discreet_reason: undefined,
    }));
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
    setSuggestOpen(false);
    setCategoryOpen(false);
    setUpdateSavedCustomer(false);
    autoFilledRef.current = { address: false, contact: false };
    setValues(EMPTY_PARCEL);
    setErrors({});
    setApiError("");
    setCreated(null);
    fetchSellerCustomers().catch(() => {});
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

            {/* 1. Parcel Content Category Declaration */}
            <div className="space-y-4 rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-5 dark:border-night-line dark:bg-night-head">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="flex items-center gap-2 text-[14.5px] text-[#27364f] dark:text-[#f1eeeb]">
                    <i className="fa-solid fa-clipboard-list text-brand" />
                    Parcel Content Category Declaration
                  </strong>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#777] dark:text-[#b8b0a8]">
                    Select the actual category of the parcel contents. Accurate declaration is required for Coordinator verification.
                  </p>
                </div>
                <span className="rounded-full bg-[#fff0df] px-2.5 py-0.5 text-[11px] font-semibold text-[#a84d0b] dark:bg-brand/20 dark:text-[#ffb58a]">
                  Required
                </span>
              </div>

              <div ref={categoryWrapRef} className="relative">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label
                    id="content_category_label"
                    htmlFor="content_category"
                    className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]"
                  >
                    Declared content category
                  </label>
                  {selectedCategoryMeta && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand dark:bg-night-panel">
                      <i className={`fa-solid ${CATEGORY_ICONS[selectedCategoryMeta.value] || "fa-box"} text-[10px]`} />
                      {selectedCategoryMeta.discreetTypical ? "Discreet-eligible" : "Standard handling"}
                    </span>
                  )}
                </div>

                {/* Custom Styled Dropdown Trigger matching the Customer Input & Dropdown design */}
                <button
                  id="content_category"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={categoryOpen}
                  aria-labelledby="content_category_label"
                  aria-invalid={!!errors.content_category}
                  onClick={() => setCategoryOpen((prev) => !prev)}
                  className={`${inputCls} flex items-center justify-between gap-3 text-left transition ${
                    categoryOpen
                      ? "!border-brand ring-2 ring-brand/15"
                      : errors.content_category
                      ? "!border-[#d94747]"
                      : ""
                  }`}
                >
                  {selectedCategoryMeta ? (
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[12px] text-brand dark:bg-night-head">
                        <i className={`fa-solid ${CATEGORY_ICONS[selectedCategoryMeta.value] || "fa-box"}`} />
                      </span>
                      <span className="truncate font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                        {selectedCategoryMeta.label}
                      </span>
                    </span>
                  ) : (
                    <span className="truncate text-[#9ca3af]">
                      e.g. Select parcel content category...
                    </span>
                  )}
                  <i
                    className={`fa-solid fa-chevron-down text-[12px] text-[#888] transition-transform duration-150 ${
                      categoryOpen ? "rotate-180 text-brand" : ""
                    }`}
                  />
                </button>

                {/* Custom Styled Dropdown Menu matching "SAVED CUSTOMERS (TAP TO AUTO-FILL)" */}
                {categoryOpen && (
                  <div
                    role="listbox"
                    aria-label="Parcel content categories"
                    className="absolute left-0 right-0 top-[68px] z-30 max-h-72 overflow-y-auto rounded-xl border border-[#e5e5e5] bg-white shadow-lg dark:border-night-line dark:bg-night-panel"
                  >
                    <div className="flex items-center justify-between border-b border-[#f1f1f1] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#999] dark:border-night-line">
                      <span>Parcel content categories (tap to select)</span>
                      <button
                        type="button"
                        onClick={() => setCategoryOpen(false)}
                        className="text-[#999] hover:text-brand"
                      >
                        Close
                      </button>
                    </div>
                    {CONTENT_CATEGORIES.map((cat) => {
                      const isSelected = values.content_category === cat.value;
                      const icon = CATEGORY_ICONS[cat.value] || "fa-box";
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange({ target: { name: "content_category", value: cat.value } });
                            setCategoryOpen(false);
                          }}
                          className={`flex w-full items-start justify-between gap-3 border-b border-[#f7f7f7] px-3.5 py-2.5 text-left text-[13px] transition last:border-b-0 hover:bg-[#fff6ef] dark:border-night-line dark:hover:bg-night-head ${
                            isSelected ? "bg-[#fff6ef] dark:bg-night-head" : ""
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span
                              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] ${
                                isSelected
                                  ? "bg-brand text-white"
                                  : "bg-[#fff3eb] text-brand dark:bg-night-head"
                              }`}
                            >
                              <i className={`fa-solid ${icon}`} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate text-[#27364f] dark:text-[#f1eeeb]">
                                {cat.label}
                              </strong>
                              <span className="block truncate text-[12px] text-[#888]">
                                {cat.subtitle}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-[11.5px] font-semibold ${
                              isSelected || cat.discreetTypical ? "text-brand" : "text-[#999]"
                            }`}
                          >
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1">
                                <i className="fa-solid fa-circle-check text-[12px]" /> Selected
                              </span>
                            ) : cat.discreetTypical ? (
                              "Discreet-eligible"
                            ) : (
                              "Standard"
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <p
                  className={`mt-1 min-h-[16px] text-[12px] ${
                    errors.content_category ? "text-[#d94747]" : "text-[#999]"
                  }`}
                >
                  {errors.content_category ||
                    (selectedCategoryMeta
                      ? selectedCategoryMeta.subtitle
                      : "Tap to choose the category that best describes the item(s) inside this parcel.")}
                </p>
              </div>

              {/* Conditional "Other" category description */}
              {values.content_category === "Other" && (
                <div className="rounded-xl border border-[#e7dcd4] bg-white p-3.5 dark:border-night-line dark:bg-night-panel">
                  <label
                    htmlFor="other_category_description"
                    className="mb-1.5 block text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]"
                  >
                    Specify &ldquo;Other&rdquo; content category <span className="text-[#d94747]">*</span>
                  </label>
                  <input
                    id="other_category_description"
                    name="other_category_description"
                    type="text"
                    maxLength={255}
                    value={values.other_category_description}
                    onChange={onChange}
                    placeholder="e.g. Collectible books, pet grooming supplies, art materials"
                    aria-invalid={!!errors.other_category_description}
                    className={`${inputCls} ${errors.other_category_description ? "!border-[#d94747]" : ""}`}
                  />
                  <p
                    className={`mt-1 text-[12px] ${
                      errors.other_category_description ? "text-[#d94747]" : "text-[#888]"
                    }`}
                  >
                    {errors.other_category_description ||
                      "Required when 'Other' is selected so the Coordinator can verify the exact item classification."}
                  </p>
                </div>
              )}

              {/* 2. Separate Discreet Handling Option — ONLY shown for Discreet-eligible categories (Clothing, Personal/Intimate, Other) */}
              {canRequestDiscreet && (
                <div className="border-t border-[#eadfd8] pt-4 dark:border-night-line">
                  <span className="block text-[13.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Does this parcel require discreet handling?
                  </span>
                  <p className="mt-0.5 text-[12px] text-[#777] dark:text-[#b8b0a8]">
                    Discreet handling masks sensitive item descriptions on rider delivery views after Coordinator approval.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!values.discrete_item}
                      onClick={() => setDiscreetOption(false)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition ${
                        !values.discrete_item
                          ? "border-[#27364f] bg-[#27364f] text-white dark:border-brand dark:bg-brand"
                          : "border-[#e0d3ca] bg-white text-[#555] hover:border-[#27364f]/40 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
                      }`}
                    >
                      <i className="fa-solid fa-box" />
                      No (Standard)
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={Boolean(values.discrete_item)}
                      onClick={() => setDiscreetOption(true)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition ${
                        values.discrete_item
                          ? "border-brand bg-brand text-white shadow-sm"
                          : "border-[#e0d3ca] bg-white text-[#555] hover:border-brand/50 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
                      }`}
                    >
                      <i className="fa-solid fa-user-shield" />
                      Yes (Discreet)
                    </button>
                  </div>

                  {values.discrete_item && (
                    <div className="mt-4 space-y-3 rounded-xl border border-[#f0d8c4] bg-white p-4 dark:border-night-line dark:bg-night-panel">
                      <div>
                        <label
                          htmlFor="discreet_reason"
                          className="mb-1.5 block text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]"
                        >
                          Reason for requesting discreet handling <span className="text-[#d94747]">*</span>
                        </label>
                        <textarea
                          id="discreet_reason"
                          name="discreet_reason"
                          rows={3}
                          maxLength={500}
                          value={values.discreet_reason}
                          onChange={onChange}
                          placeholder="Briefly explain why this parcel requires discreet handling (e.g., personal/intimate product, customer requested privacy on delivery label)..."
                          aria-invalid={!!errors.discreet_reason}
                          className={`${inputCls} resize-y py-2.5 ${
                            errors.discreet_reason ? "!border-[#d94747]" : ""
                          }`}
                        />
                        <p
                          className={`mt-1 text-[12px] ${
                            errors.discreet_reason ? "text-[#d94747]" : "text-[#888]"
                          }`}
                        >
                          {errors.discreet_reason ||
                            "Your explanation will be reviewed by the Coordinator alongside your packing video proof."}
                        </p>
                      </div>

                      {/* Verification & Anti-Fraud Reminder Banner */}
                      <div className="rounded-xl border border-[#f5d0a9] bg-[#fff8f0] p-3.5 text-[12.5px] leading-relaxed text-[#8a4b14] dark:border-[#c97c10]/40 dark:bg-[#c97c10]/10 dark:text-[#f2c278]">
                        <div className="flex items-start gap-2.5">
                          <i className="fa-solid fa-shield-halved mt-0.5 text-[14px] text-[#c97c10]" />
                          <div>
                            <strong className="block font-semibold">
                              Verification &amp; Shipping Compliance Reminder
                            </strong>
                            <span className="mt-0.5 block">
                              Selecting discreet handling <strong>does not exempt this parcel from packing video verification</strong> or applicable shipping rules. The Coordinator will inspect your declared category, explanation, and video proof before approving discreet handling. Misdeclared, prohibited, or fraudulent items will be rejected.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {liveWarnings.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#f2c97d] bg-[#fffbeb] p-3.5 text-[12px] text-[#92580a] dark:border-[#c97c10]/40 dark:bg-[#c97c10]/10 dark:text-[#f2c278]">
                  <strong className="mb-1 flex items-center gap-1.5 font-semibold">
                    <i className="fa-solid fa-triangle-exclamation text-[#d97706]" />
                    Coordinator Review Notice
                  </strong>
                  <ul className="list-disc space-y-1 pl-4">
                    {liveWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
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
