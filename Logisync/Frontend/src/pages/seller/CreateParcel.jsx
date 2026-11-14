import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel } from "../../components/styles.js";
import { createParcel, fetchSellerCustomers, listParcels } from "../../services/parcelService.js";
import {
  CONTENT_CATEGORIES,
  EMPTY_PARCEL,
  evaluateDeclarationFlags,
  formatFullAddress,
  isCategoryDiscreetEligible,
  trimParcel,
  validateParcel,
} from "../../utils/parcelForm.js";
import {
  CAVITE_PROVINCE,
  TRECE_MARTIRES_BARANGAYS,
  TRECE_MARTIRES_CITY,
  parseAddressString,
  searchTreceBarangays,
} from "../../data/phLocations.js";
import {
  MOBILE_NUMBER_MAX_LENGTH,
  sanitizeMobileNumber,
} from "../../utils/phone.js";
import ParcelCreated from "../../components/parcels/ParcelCreated.jsx";
import QrScanner from "../../components/qr/QrScanner.jsx";
import { isValidTransactionNumber, parseTransactionNumber } from "../../utils/qr.js";
import { findCustomerByName, searchCustomers, useCustomers } from "../../store/customers.js";

const STEPS = [
  ["fa-qrcode", "Scan or type", "Scan the Shopee QR on the parcel to fill in the transaction number."],
  ["fa-user-check", "Enter customer details", "Type an existing customer name to auto-fill their saved address and contact, or enter a new customer."],
  ["fa-map-location-dot", "Trece Martires address", "Province and city are fixed to Trece Martires City, Cavite. Select your barangay and enter house/unit & street."],
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
  const [scanned, setScanned] = useState(false);
  const [txnLookupMessage, setTxnLookupMessage] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    if (!instructionsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setInstructionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [instructionsOpen]);

  // Track customer auto-fill state
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [updateSavedCustomer, setUpdateSavedCustomer] = useState(false);
  const autoFilledRef = useRef({ address: false, contact: false });

  // Address autocomplete dropdown state
  const [barangaySuggestOpen, setBarangaySuggestOpen] = useState(false);

  // Element Refs for click-outside
  const nameWrapRef = useRef(null);
  const categoryWrapRef = useRef(null);
  const barangayWrapRef = useRef(null);

  const [existingTxns, setExistingTxns] = useState(new Set());

  const loadSellerParcels = useCallback(() => {
    listParcels()
      .then((list) => {
        const set = new Set(
          (Array.isArray(list) ? list : [])
            .map((p) => String(p.transaction_number || "").trim().toUpperCase())
            .filter(Boolean)
        );
        setExistingTxns(set);
      })
      .catch(() => {});
  }, []);

  // Retrieve seller's saved customers and existing parcels from the database on mount
  useEffect(() => {
    fetchSellerCustomers().catch(() => {});
    loadSellerParcels();
  }, [loadSellerParcels]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const onDown = (e) => {
      if (suggestOpen && !nameWrapRef.current?.contains(e.target)) {
        setSuggestOpen(false);
      }
      if (categoryOpen && !categoryWrapRef.current?.contains(e.target)) {
        setCategoryOpen(false);
      }
      if (barangaySuggestOpen && !barangayWrapRef.current?.contains(e.target)) {
        setBarangaySuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestOpen, categoryOpen, barangaySuggestOpen]);

  // Customer suggestions
  const customerSuggestions = useMemo(
    () => searchCustomers(values.receiver_name, 5),
    [values.receiver_name, customers] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Trece Martires City Barangay autocomplete suggestions
  const barangaySuggestions = useMemo(() => {
    return searchTreceBarangays(values.receiver_barangay);
  }, [values.receiver_barangay]);

  const selectedCategoryMeta = useMemo(
    () => CONTENT_CATEGORIES.find((c) => c.value === values.content_category) || null,
    [values.content_category]
  );

  const canRequestDiscreet = Boolean(selectedCategoryMeta?.discreetTypical);
  const liveWarnings = useMemo(() => evaluateDeclarationFlags(values), [values]);

  // Live preview of full delivery address
  const fullAddressPreview = useMemo(() => formatFullAddress(values), [values]);

  const applyCustomerMatch = (customer, nameValue) => {
    setMatchedCustomer(customer);
    setUpdateSavedCustomer(false);
    autoFilledRef.current = {
      address: Boolean(customer.address || customer.street || customer.city),
      contact: Boolean(customer.contact),
    };

    const parsed = parseAddressString(customer.address || "");
    const house = customer.house_number || parsed.house_number || "";
    const streetOnly = customer.street || parsed.street || "";
    const combinedStreet =
      house && !streetOnly.includes(house)
        ? `${house}, ${streetOnly}`
        : (streetOnly || house || customer.address || "");
    const brgy = customer.barangay || parsed.barangay || "";

    const fullAddr = formatFullAddress({
      receiver_street: combinedStreet,
      receiver_barangay: brgy,
      receiver_city: TRECE_MARTIRES_CITY,
      receiver_province: CAVITE_PROVINCE,
    });

    const cleanCustomerContact = customer.contact
      ? sanitizeMobileNumber(customer.contact)
      : "";

    setValues((v) => ({
      ...v,
      receiver_name: nameValue ?? customer.name,
      receiver_contact: cleanCustomerContact || v.receiver_contact,
      receiver_house_number: house,
      receiver_street: combinedStreet,
      receiver_barangay: brgy,
      receiver_city: TRECE_MARTIRES_CITY,
      receiver_province: CAVITE_PROVINCE,
      receiver_address: fullAddr,
    }));

    setErrors((er) => ({
      ...er,
      receiver_name: undefined,
      receiver_contact: cleanCustomerContact ? undefined : er.receiver_contact,
      receiver_street: combinedStreet ? undefined : er.receiver_street,
      receiver_barangay: brgy ? undefined : er.receiver_barangay,
      receiver_city: undefined,
      receiver_province: undefined,
    }));
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "transaction_number") {
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    } else if (name === "receiver_contact") {
      nextValue = sanitizeMobileNumber(value);
    }

    if (name === "transaction_number") {
      setScanned(false);
      setTxnLookupMessage("");
      setValues((v) => ({ ...v, transaction_number: nextValue }));
      if (existingTxns.has(nextValue)) {
        setErrors((er) => ({
          ...er,
          transaction_number: `You have already registered a parcel with this transaction number (${nextValue}). Duplicate submissions are not allowed.`
        }));
      } else {
        setErrors((er) => ({ ...er, transaction_number: undefined }));
      }
      return;
    }

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
        receiver_contact: clearContact ? "" : v.receiver_contact,
        receiver_house_number: clearAddr ? "" : v.receiver_house_number,
        receiver_street: clearAddr ? "" : v.receiver_street,
        receiver_barangay: clearAddr ? "" : v.receiver_barangay,
        receiver_city: TRECE_MARTIRES_CITY,
        receiver_province: CAVITE_PROVINCE,
        receiver_address: clearAddr ? "" : v.receiver_address,
      }));
      setErrors((er) => ({ ...er, receiver_name: undefined }));
      return;
    }

    if (name === "receiver_contact") {
      autoFilledRef.current.contact = false;
    }

    if (["receiver_street", "receiver_barangay"].includes(name)) {
      autoFilledRef.current.address = false;
    }

    const resetDiscreet =
      name === "content_category" && !isCategoryDiscreetEligible(nextValue);

    setValues((v) => {
      const updated = {
        ...v,
        [name]: nextValue,
        receiver_city: TRECE_MARTIRES_CITY,
        receiver_province: CAVITE_PROVINCE,
        ...(name === "content_category" && nextValue !== "Other"
          ? { other_category_description: "" }
          : {}),
        ...(resetDiscreet ? { discrete_item: false, discreet_reason: "" } : {}),
      };
      updated.receiver_address = formatFullAddress(updated);
      return updated;
    });

    setErrors((er) => ({
      ...er,
      [name]: undefined,
      ...(name === "content_category" && nextValue !== "Other"
        ? { other_category_description: undefined }
        : {}),
      ...(resetDiscreet ? { discreet_reason: undefined } : {}),
    }));
  };

  const onSelectBarangay = (barangayName) => {
    setBarangaySuggestOpen(false);
    autoFilledRef.current.address = false;
    setValues((v) => {
      const updated = {
        ...v,
        receiver_barangay: barangayName,
        receiver_city: TRECE_MARTIRES_CITY,
        receiver_province: CAVITE_PROVINCE,
      };
      updated.receiver_address = formatFullAddress(updated);
      return updated;
    });
    setErrors((er) => ({
      ...er,
      receiver_barangay: undefined,
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
    ((matchedCustomer.contact && values.receiver_contact.trim() !== matchedCustomer.contact) ||
      (values.receiver_street.trim() !== (matchedCustomer.street || "")) ||
      (values.receiver_barangay.trim() !== (matchedCustomer.barangay || "")) ||
      (matchedCustomer.address && fullAddressPreview !== matchedCustomer.address));

  const onSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    const found = validateParcel(values);
    const txnNorm = (values.transaction_number || "").trim().toUpperCase();
    if (txnNorm && existingTxns.has(txnNorm)) {
      found.transaction_number = `You have already registered a parcel with this transaction number (${txnNorm}). Duplicate submissions are not allowed.`;
    }
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
      const createdParcel = await createParcel(payload);
      setCreated(createdParcel);
      setExistingTxns((prev) => new Set([...prev, txnNorm]));
    } catch (err) {
      setApiError(err.message);
      if (err.message && err.message.toLowerCase().includes("transaction number")) {
        setErrors((er) => ({ ...er, transaction_number: err.message }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onLookUpTransaction = () => {
    const rawTxn = parseTransactionNumber(values.transaction_number || "").toUpperCase();
    if (!rawTxn) {
      setTxnLookupMessage("");
      setErrors((er) => ({
        ...er,
        transaction_number: "Enter a transaction number first (e.g. SPX272828381).",
      }));
      return;
    }
    setValues((v) => ({ ...v, transaction_number: rawTxn }));
    if (!isValidTransactionNumber(rawTxn)) {
      setTxnLookupMessage("");
      setErrors((er) => ({
        ...er,
        transaction_number: `Invalid format ("${rawTxn}"). Expected SPX followed by 9 digits (e.g. SPX272828381).`,
      }));
      return;
    }
    if (existingTxns.has(rawTxn)) {
      setTxnLookupMessage("");
      setErrors((er) => ({
        ...er,
        transaction_number: `You have already registered a parcel with this transaction number (${rawTxn}). Duplicate submissions are not allowed.`,
      }));
      return;
    }
    setErrors((er) => ({ ...er, transaction_number: undefined }));
    setApiError("");
    setTxnLookupMessage(`Transaction number ${rawTxn} is valid and ready to register.`);
  };

  const onScan = (text) => {
    const rawTxn = parseTransactionNumber(text).toUpperCase();
    if (!rawTxn) {
      setTxnLookupMessage("");
      setApiError("The QR code was empty. Try again or type the number.");
      return;
    }
    if (!isValidTransactionNumber(rawTxn)) {
      setTxnLookupMessage("");
      setApiError(`Invalid QR code content ("${rawTxn}"). Transaction number must follow SPX123456789 (SPX followed by exactly 9 digits).`);
      setErrors((er) => ({
        ...er,
        transaction_number: `Invalid QR code format ("${rawTxn}"). Expected SPX followed by 9 digits (e.g. SPX272828381).`
      }));
      return;
    }
    if (existingTxns.has(rawTxn)) {
      setTxnLookupMessage("");
      setApiError(`You have already registered a parcel with this transaction number (${rawTxn}).`);
      setErrors((er) => ({
        ...er,
        transaction_number: `You have already registered a parcel with this transaction number (${rawTxn}). Duplicate submissions are not allowed.`
      }));
      return;
    }
    setValues((v) => ({ ...v, transaction_number: rawTxn }));
    setErrors((er) => ({ ...er, transaction_number: undefined }));
    setApiError("");
    setTxnLookupMessage("");
    setScanned(true);
  };

  const reset = () => {
    setScanned(false);
    setTxnLookupMessage("");
    setMatchedCustomer(null);
    setSuggestOpen(false);
    setCategoryOpen(false);
    setBarangaySuggestOpen(false);
    setUpdateSavedCustomer(false);
    autoFilledRef.current = { address: false, contact: false };
    setValues(EMPTY_PARCEL);
    setErrors({});
    setApiError("");
    setCreated(null);
    fetchSellerCustomers().catch(() => {});
    loadSellerParcels();
  };

  const isAddressAutoFilled =
    matchedCustomer &&
    (values.receiver_street === matchedCustomer.street ||
      values.receiver_barangay === matchedCustomer.barangay ||
      fullAddressPreview === matchedCustomer.address);

  const isContactAutoFilled =
    matchedCustomer?.contact && values.receiver_contact === matchedCustomer.contact;

  return (
    <div className="w-full">
      <Topbar
        title="Create Parcel"
        subtitle="Register a parcel so the coordinator can verify it. The system generates the parcel ID."
      />

      {created ? (
        <ParcelCreated parcel={created} onReset={reset} />
      ) : (
        <form onSubmit={onSubmit} noValidate className={`${panel} w-full shadow-sm dark:shadow-none`}>
          {/* Parcel Details Card Header (with Instructions button aligned on the right) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-[#f3e4da] bg-[#fff5ee] px-6 py-3.5 dark:border-night-line dark:bg-night-head max-[600px]:px-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[12px] text-white">
                <i className="fa-solid fa-plus" />
              </span>
              <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                Parcel Details
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              {scanned && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f7f4a] dark:bg-[#29945a]/20 dark:text-[#8fd6ae]">
                  <i className="fa-solid fa-circle-check text-[10px]" /> QR Scanned
                </span>
              )}
              <button
                type="button"
                onClick={() => setInstructionsOpen(true)}
                className={`${btnGhost} !border-[#f1d5c4] !bg-[#fffaf7] !px-3 !py-1.5 !text-[12.5px] !text-brand shadow-xs hover:!border-brand hover:!bg-[#fff2ea] dark:!border-night-line dark:!bg-night-head dark:!text-[#ffb58a]`}
              >
                <i className="fa-regular fa-circle-question text-brand" /> Instructions
              </button>
            </div>
          </div>

          <div className="space-y-5 p-6 max-[600px]:p-4">
            {apiError && (
              <Notice tone="error" icon="fa-circle-exclamation" role="alert">
                {apiError}
              </Notice>
            )}

            {/* Centered 360x360 Cube QR Scanner & Manual Transaction Number Lookup (Matching ScanPanel Format) */}
            <div className="border-b border-[#f1f1f1] pb-6 dark:border-night-line">
              <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-5">
                <div className="w-full">
                  <QrScanner
                    onScan={onScan}
                    startLabel="Scan with camera"
                  />
                </div>

                {/* "OR ENTER MANUALLY" Divider */}
                <div className="relative flex w-full items-center py-0.5">
                  <div className="flex-grow border-t border-[#eaeaea] dark:border-night-line" />
                  <span className="mx-3 shrink-0 rounded-full bg-[#f8fafc] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] dark:bg-night-head dark:text-[#8b837d]">
                    Or enter manually
                  </span>
                  <div className="flex-grow border-t border-[#eaeaea] dark:border-night-line" />
                </div>

                <div className="w-full">
                  <div className="mb-2.5 text-center">
                    <p className="text-[14.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                      Can&apos;t scan? Type it instead
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#b8b0a8]">
                      Enter the transaction number printed on the parcel.
                    </p>
                  </div>

                  <label htmlFor="transaction_number" className="sr-only">
                    Transaction number
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <i className="fa-solid fa-hashtag pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[#999]" />
                      <input
                        id="transaction_number"
                        name="transaction_number"
                        type="text"
                        value={values.transaction_number}
                        onChange={onChange}
                        placeholder="Transaction number..."
                        maxLength={12}
                        aria-invalid={!!errors.transaction_number}
                        className={`${inputCls} pl-7 font-mono ${errors.transaction_number ? "!border-[#d94747]" : ""}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onLookUpTransaction}
                      className="h-[42px] shrink-0 rounded-lg bg-brand px-4 text-[13px] font-bold text-white transition hover:bg-brand-dark"
                    >
                      Look up
                    </button>
                  </div>
                  {(errors.transaction_number || scanned || txnLookupMessage) && (
                    <p
                      className={`mt-2 text-center text-[12px] font-medium ${
                        errors.transaction_number
                          ? "text-[#d94747]"
                          : "text-[#1f7f4a] dark:text-[#8fd6ae]"
                      }`}
                    >
                      {errors.transaction_number ||
                        (scanned
                          ? `Transaction number ${values.transaction_number} scanned from QR code.`
                          : txnLookupMessage)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Receiver Name & Contact Number side by side */}
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {/* 2. Customer / Receiver Name with Autocomplete */}
            <div ref={nameWrapRef} className="relative">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="receiver_name" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                  Customer / Receiver name <span className="text-brand">*</span>
                </label>
                {matchedCustomer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f7f4a] dark:bg-[#29945a]/20 dark:text-[#8fd6ae]">
                    <i className="fa-solid fa-user-check text-[10px]" /> Existing customer found
                  </span>
                )}
                {!matchedCustomer && values.receiver_name.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#3a6ea5] dark:bg-[#4285c5]/20 dark:text-[#9cc3ea]">
                    <i className="fa-solid fa-user-plus text-[10px]" /> New customer
                  </span>
                )}
              </div>

              <input
                id="receiver_name"
                name="receiver_name"
                type="text"
                autoComplete="off"
                value={values.receiver_name}
                onFocus={() => setSuggestOpen(true)}
                onChange={(e) => {
                  setSuggestOpen(true);
                  onChange(e);
                }}
                placeholder="e.g. Juan Dela Cruz"
                maxLength={100}
                aria-invalid={!!errors.receiver_name}
                className={`${inputCls} ${errors.receiver_name ? "!border-[#d94747]" : ""}`}
              />

              {/* Autocomplete customer suggestions dropdown */}
              {suggestOpen && customerSuggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Saved customers"
                  className="absolute left-0 right-0 top-[68px] z-50 max-h-60 overflow-y-auto rounded-xl border border-[#e5e5e5] bg-white shadow-xl dark:border-night-line dark:bg-night-panel"
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
                  {customerSuggestions.map((c) => {
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
                            {c.address || `${c.street || ""}, ${c.barangay || ""}, ${c.city || ""}` || "No saved address"}
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

              <p className={`mt-1 min-h-[16px] text-[12px] ${errors.receiver_name ? "text-[#d94747]" : "text-[#999]"}`}>
                {errors.receiver_name || "Enter an existing customer name to auto-fill their saved address and contact number."}
              </p>

              {matchedCustomer && (
                <div className="mt-2 rounded-xl border border-[#cbead8] bg-[#f3fbf6] px-3.5 py-2.5 text-[12.5px] text-[#1f7f4a] dark:border-[#29945a]/30 dark:bg-[#29945a]/10 dark:text-[#8fd6ae]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <i className="fa-solid fa-circle-check mr-1.5" />
                      Saved details for <strong>{matchedCustomer.name}</strong> were populated automatically. You can review and edit any address field below.
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
                        Update saved customer profile with these edited details for future parcels (otherwise existing saved details remain unchanged)
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* 3. Customer / Receiver Contact Number */}
            <div className="relative">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="receiver_contact" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                  Customer / Receiver contact number <span className="text-brand">*</span>
                </label>
                {isContactAutoFilled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand dark:bg-night-head">
                    <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> Auto-filled (editable)
                  </span>
                )}
              </div>
              <input
                id="receiver_contact"
                name="receiver_contact"
                type="tel"
                inputMode="numeric"
                pattern="09[0-9]{9}"
                value={values.receiver_contact}
                onChange={onChange}
                placeholder="e.g. 09171234567"
                maxLength={MOBILE_NUMBER_MAX_LENGTH}
                aria-invalid={!!errors.receiver_contact}
                className={`${inputCls} ${errors.receiver_contact ? "!border-[#d94747]" : isContactAutoFilled ? "border-brand/40 bg-[#fffaf7] dark:bg-night-head" : ""}`}
              />
              <p className={`mt-1 min-h-[16px] text-[12px] ${errors.receiver_contact ? "text-[#d94747]" : "text-[#999]"}`}>
                {errors.receiver_contact || "Enter an 11-digit mobile number starting with 09 (numbers only)."}
              </p>
            </div>
            </div>

            {/* 4. Structured Delivery Address Section */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4 dark:border-night-line dark:bg-night-panel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-night-line">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <i className="fa-solid fa-location-dot text-sm" />
                  </span>
                  <div>
                    <h3 className="text-[14.5px] font-bold text-slate-800 dark:text-white leading-tight">
                      Customer / Receiver Delivery Address
                    </h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      Covering Trece Martires City, Cavite Service Hub.
                    </p>
                  </div>
                </div>
                {isAddressAutoFilled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand dark:bg-night-head">
                    <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> Auto-filled (editable)
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {/* 1. Province (Pre-filled / Read-only) */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="receiver_province" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                      1. Province <i className="fa-solid fa-lock text-[10px] text-slate-400 ml-1" title="Fixed service hub province" />
                    </label>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide dark:bg-night-head dark:text-slate-400">
                      Pre-filled &bull; Read-only
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="receiver_province"
                      name="receiver_province"
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={values.receiver_province || CAVITE_PROVINCE}
                      className={`${inputCls} !bg-[#f8fafc] !text-slate-700 !font-medium !cursor-not-allowed !border-slate-200 select-none pr-9 dark:!bg-night-head dark:!border-night-line dark:!text-slate-200`}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                      <i className="fa-solid fa-lock text-xs" />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Automatically set to Cavite (service hub coverage area).
                  </p>
                </div>

                {/* 2. Municipality / City (Pre-filled / Read-only) */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="receiver_city" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                      2. Municipality / City <i className="fa-solid fa-lock text-[10px] text-slate-400 ml-1" title="Fixed service hub municipality" />
                    </label>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide dark:bg-night-head dark:text-slate-400">
                      Pre-filled &bull; Read-only
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="receiver_city"
                      name="receiver_city"
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={values.receiver_city || TRECE_MARTIRES_CITY}
                      className={`${inputCls} !bg-[#f8fafc] !text-slate-700 !font-medium !cursor-not-allowed !border-slate-200 select-none pr-9 dark:!bg-night-head dark:!border-night-line dark:!text-slate-200`}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                      <i className="fa-solid fa-lock text-xs" />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Automatically set to Trece Martires City (service hub coverage area).
                  </p>
                </div>
                </div>

                {/* 3 & 4. Barangay and House/Unit + Street side by side */}
                <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
                {/* 3. Barangay (Autocomplete dropdown strictly containing Trece Martires City barangays) */}
                <div ref={barangayWrapRef} className="relative">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="receiver_barangay" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                      3. Barangay <span className="text-brand">*</span>
                    </label>
                    <span className="text-[10.5px] font-bold text-brand uppercase tracking-wide">
                      Required &bull; Trece Martires City
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="receiver_barangay"
                      name="receiver_barangay"
                      type="text"
                      autoComplete="off"
                      value={values.receiver_barangay}
                      onFocus={() => setBarangaySuggestOpen(true)}
                      onChange={(e) => {
                        setBarangaySuggestOpen(true);
                        onChange(e);
                      }}
                      placeholder="Select or type barangay (e.g. San Agustin, Hugo Perez, Inocencio)"
                      maxLength={150}
                      aria-invalid={!!errors.receiver_barangay}
                      className={`${inputCls} pr-9 ${errors.receiver_barangay ? "!border-[#d94747]" : ""}`}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                      <i className="fa-solid fa-chevron-down text-xs" />
                    </div>
                  </div>

                  {/* Autocomplete Dropdown: Trece Martires City Barangays */}
                  {barangaySuggestOpen && (
                    <div
                      role="listbox"
                      aria-label="Trece Martires City Barangays"
                      className="absolute left-0 right-0 top-[68px] z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-night-line dark:bg-night-panel"
                    >
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm dark:border-night-line dark:bg-night-head/95 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <i className="fa-solid fa-map-pin text-brand text-xs" />
                          Trece Martires City Barangays ({barangaySuggestions.length} found)
                        </span>
                        <button
                          type="button"
                          onClick={() => setBarangaySuggestOpen(false)}
                          className="text-slate-400 hover:text-brand transition"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {barangaySuggestions.length > 0 ? (
                        barangaySuggestions.map((brgy) => {
                          const isSelected =
                            values.receiver_barangay.trim().toLowerCase() === brgy.toLowerCase();
                          return (
                            <button
                              key={brgy}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => onSelectBarangay(brgy)}
                              className={`flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3.5 py-2.5 text-left text-[13px] transition last:border-b-0 hover:bg-[#fff6ef] dark:border-night-line dark:hover:bg-night-head ${
                                isSelected
                                  ? "bg-[#fff6ef] font-semibold text-brand dark:bg-night-head"
                                  : "text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <i className={`fa-solid fa-location-dot text-xs ${isSelected ? "text-brand" : "text-slate-400"}`} />
                                <span>{brgy}</span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                                Trece Martires City
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
                          <p>No barangay matching &ldquo;{values.receiver_barangay}&rdquo; in Trece Martires City.</p>
                          <p className="mt-1 text-[11.5px] text-slate-400">
                            Only the 13 official barangays of Trece Martires City are served by this hub.
                          </p>
                          <button
                            type="button"
                            onClick={() => onSelectBarangay("")}
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                          >
                            Show all 13 Trece Martires barangays
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <p className={`mt-1 text-[11px] ${errors.receiver_barangay ? "text-[#d94747]" : "text-slate-400"}`}>
                    {errors.receiver_barangay || "Type the first letter (e.g. 'S', 'H') or select from the 13 official barangays of Trece Martires City."}
                  </p>
                </div>

                {/* 4. House / Unit Number and Street Name (Combined input field) */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="receiver_street" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                      4. House / Unit Number and Street Name <span className="text-brand">*</span>
                    </label>
                    <span className="text-[10.5px] font-bold text-brand uppercase tracking-wide">
                      Required
                    </span>
                  </div>
                  <input
                    id="receiver_street"
                    name="receiver_street"
                    type="text"
                    value={values.receiver_street}
                    onChange={onChange}
                    placeholder="e.g. Blk 5 Lot 10, Mabini Street"
                    maxLength={150}
                    aria-invalid={!!errors.receiver_street}
                    className={`${inputCls} ${errors.receiver_street ? "!border-[#d94747]" : ""}`}
                  />
                  <p className={`mt-1 text-[11px] ${errors.receiver_street ? "text-[#d94747]" : "text-slate-400"}`}>
                    {errors.receiver_street || "Enter the complete house or unit number, building, subdivision, and street name."}
                  </p>
                </div>
                </div>
              </div>

              {/* Complete Delivery Address Preview Box */}
              <div className="rounded-xl border border-slate-200/90 bg-[#fafafa] p-3.5 dark:border-night-line dark:bg-night-head/70">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <i className="fa-solid fa-map-location-dot text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Complete Delivery Address Preview
                      </span>
                      {fullAddressPreview && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <i className="fa-solid fa-circle-check mr-1" /> Formatted for Waybill & Rider Dispatch
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100 break-words leading-snug">
                      {fullAddressPreview || (
                        <span className="italic font-normal text-slate-400">
                          Enter house/unit & street and select a barangay to preview the complete Trece Martires delivery address.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5 & 6. Item Description & Content Category side by side */}
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {/* 5. Parcel Item Description / Contents */}
            <div className="relative">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="contents" className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                  Parcel item description / contents <span className="text-brand">*</span>
                </label>
              </div>
              <input
                id="contents"
                name="contents"
                type="text"
                value={values.contents}
                onChange={onChange}
                placeholder="e.g. 2x Cotton T-Shirt (Black, Medium)"
                maxLength={255}
                aria-invalid={!!errors.contents}
                className={`${inputCls} ${errors.contents ? "!border-[#d94747]" : ""}`}
              />
              <p className={`mt-1 min-h-[16px] text-[12px] ${errors.contents ? "text-[#d94747]" : "text-[#999]"}`}>
                {errors.contents || "Provide an accurate description of the physical item(s) inside the parcel."}
              </p>
            </div>

            {/* 6. Parcel Content Category Declaration */}
            <div className="space-y-3">
              <div ref={categoryWrapRef} className="relative">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label
                    id="content_category_label"
                    htmlFor="content_category"
                    className="text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]"
                  >
                    Parcel content category declaration <span className="text-brand">*</span>
                  </label>
                </div>

                <button
                  type="button"
                  id="content_category"
                  aria-labelledby="content_category_label"
                  aria-haspopup="listbox"
                  aria-expanded={categoryOpen}
                  onClick={() => setCategoryOpen((v) => !v)}
                  className={`flex h-[42px] w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-[13px] text-ink outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/10 dark:bg-night-head dark:text-[#f1eeeb] ${
                    errors.content_category
                      ? "!border-[#d94747]"
                      : categoryOpen
                      ? "border-brand ring-[3px] ring-brand/10"
                      : "border-[#e5e5e5] dark:border-night-line"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedCategoryMeta ? (
                      <>
                        <i className={`fa-solid ${CATEGORY_ICONS[selectedCategoryMeta.value] || "fa-box"} text-brand shrink-0`} />
                        <strong className="truncate font-medium">{selectedCategoryMeta.label}</strong>
                      </>
                    ) : (
                      <span className="text-[#999]">— Select parcel content category —</span>
                    )}
                  </span>
                  <i className={`fa-solid fa-chevron-down text-[11px] text-[#999] transition-transform ${categoryOpen ? "rotate-180 text-brand" : ""}`} />
                </button>

                {categoryOpen && (
                  <div
                    role="listbox"
                    aria-label="Parcel content categories"
                    className="absolute left-0 right-0 top-[70px] z-50 max-h-72 overflow-y-auto rounded-2xl border border-brand/25 bg-white p-1.5 shadow-[0_18px_45px_rgba(238,77,45,0.12)] animate-popup dark:border-night-line dark:bg-night-panel"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#999]">
                      Select parcel content category
                    </div>
                    {CONTENT_CATEGORIES.map((cat) => {
                      const isSelected = values.content_category === cat.value;
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
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            isSelected
                              ? "bg-brand text-white shadow-sm"
                              : "text-[#27364f] hover:bg-[#fff4ec] dark:text-[#f1eeeb] dark:hover:bg-night-head"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-brand/10 text-brand dark:bg-brand/20"
                            }`}
                          >
                            <i className={`fa-solid ${CATEGORY_ICONS[cat.value] || "fa-box"} text-[14px]`} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold leading-snug">
                              {cat.label}
                            </span>
                            <small
                              className={`block truncate text-[11px] ${
                                isSelected ? "text-white/85" : "text-[#888] dark:text-[#aaa]"
                              }`}
                            >
                              {cat.subtitle}
                            </small>
                          </div>
                          {isSelected && (
                            <i className="fa-solid fa-check text-[13px] text-white shrink-0 pr-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className={`mt-1 min-h-[16px] text-[12px] ${errors.content_category ? "text-[#d94747]" : "text-[#999]"}`}>
                  {errors.content_category || "Accurate category declaration is required."}
                </p>
              </div>

              {values.content_category === "Other" && (
                <div className="relative pt-1">
                  <label htmlFor="other_category_description" className="mb-1.5 block text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]">
                    Specify item category / short description <span className="text-brand">*</span>
                  </label>
                  <input
                    id="other_category_description"
                    name="other_category_description"
                    type="text"
                    value={values.other_category_description}
                    onChange={onChange}
                    placeholder="e.g. Handmade ceramic mugs, auto parts, dry packaged food"
                    maxLength={255}
                    aria-invalid={!!errors.other_category_description}
                    className={`${inputCls} ${errors.other_category_description ? "!border-[#d94747]" : ""}`}
                  />
                  <p className={`mt-1 min-h-[16px] text-[12px] ${errors.other_category_description ? "text-[#d94747]" : "text-[#999]"}`}>
                    {errors.other_category_description || "Required for 'Other' category declarations."}
                  </p>
                </div>
              )}
            </div>
            </div>

            {/* 7. Discreet Handling Section */}
            <div className="space-y-3 border-t border-[#f1f1f1] pt-4 dark:border-night-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-[13px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Discreet Handling Requested
                  </span>
                  <small className="text-[12px] text-[#777] dark:text-[#b8b0a8]">
                    {canRequestDiscreet
                      ? "Discreet handling masks sensitive item descriptions on rider delivery views after Coordinator approval."
                      : "Available for Clothing and Accessories or Personal / Intimate Products categories."}
                  </small>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDiscreetOption(false)}
                  aria-pressed={!values.discrete_item}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    !values.discrete_item
                      ? "border border-brand bg-[#fff5ee] text-brand dark:bg-brand/15 dark:text-[#ffb58a]"
                      : "border border-[#e5e5e5] bg-white text-[#666] hover:border-brand/50 dark:border-night-line dark:bg-night-head dark:text-[#d1c9c2]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      !values.discrete_item ? "border-brand bg-brand text-white" : "border-[#ccc]"
                    }`}
                  >
                    {!values.discrete_item && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  No
                </button>
                <button
                  type="button"
                  disabled={!canRequestDiscreet}
                  onClick={() => canRequestDiscreet && setDiscreetOption(true)}
                  aria-pressed={values.discrete_item}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    values.discrete_item
                      ? "border border-brand bg-brand text-white shadow-sm"
                      : "border border-[#e5e5e5] bg-white text-[#666] hover:border-brand/50 dark:border-night-line dark:bg-night-head dark:text-[#d1c9c2]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      values.discrete_item ? "border-white bg-white text-brand" : "border-[#ccc]"
                    }`}
                  >
                    {values.discrete_item && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                  </span>
                  Yes
                </button>
              </div>

              {canRequestDiscreet && values.discrete_item && (
                <div className="space-y-3 rounded-xl border border-brand/30 bg-[#fff5ee] p-4 animate-popup dark:border-brand/40 dark:bg-brand/10">
                  <div>
                    <label htmlFor="discreet_reason" className="block text-[12px] font-bold text-brand">
                      Reason for requesting discreet handling <span className="text-brand">*</span>
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-[#888] dark:text-[#c4b9b0]">
                      Explain why this parcel requires recipient privacy (e.g. personal health/intimate product, surprise gift). Vague or evasive answers will be rejected by the Coordinator.
                    </p>
                  </div>

                  <textarea
                    id="discreet_reason"
                    name="discreet_reason"
                    rows={3}
                    value={values.discreet_reason}
                    onChange={onChange}
                    placeholder="e.g. Contains sensitive personal health/intimate hygiene items. Recipient requested discrete packaging and masked descriptions on delivery."
                    maxLength={500}
                    aria-invalid={!!errors.discreet_reason}
                    className={`w-full rounded-xl border bg-white p-3 text-[13px] text-ink outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/10 dark:bg-night-head dark:text-[#f1eeeb] ${
                      errors.discreet_reason ? "!border-[#d94747]" : "border-brand/30 dark:border-night-line"
                    }`}
                  />

                  <div className="flex items-center justify-between text-[11px] text-[#999]">
                    <span className={errors.discreet_reason ? "text-[#d94747] font-semibold" : ""}>
                      {errors.discreet_reason || "Minimum 10 characters required."}
                    </span>
                    <span>{values.discreet_reason.length}/500</span>
                  </div>

                  <div className="rounded-lg border border-amber-300/80 bg-amber-50 p-2.5 text-[12px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <i className="fa-solid fa-shield-halved mr-1.5 text-amber-600" />
                    <strong>Coordinator Inspection Notice:</strong> Discreet handling only masks item names from rider view. You must still provide a complete packaging video proof. If contents conflict with the declaration, the parcel will be rejected.
                  </div>
                </div>
              )}
            </div>

            {/* Live Flag Warnings */}
            {liveWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-[12.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <strong className="flex items-center gap-1.5 font-bold">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                  Declaration Review Notice
                </strong>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[12px]">
                  {liveWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-3 text-[14px]`}>
              <i className="fa-solid fa-check" />
              {submitting ? "Registering parcel..." : "Register Parcel"}
            </button>
          </div>
        </form>
      )}

      {/* Instructions Modal */}
      {instructionsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-parcel-instructions-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInstructionsOpen(false);
          }}
        >
          <div className={`${panel} w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 shadow-2xl max-[600px]:p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#eee] pb-3 dark:border-night-line">
              <h2 id="create-parcel-instructions-title" className="text-[16px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                <i className="fa-regular fa-circle-question mr-2 text-brand" />
                How parcel creation works
              </h2>
              <button
                type="button"
                onClick={() => setInstructionsOpen(false)}
                aria-label="Close instructions"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777] transition hover:bg-[#f5f5f5] hover:text-[#222] dark:text-[#b8b0a8] dark:hover:bg-night-head dark:hover:text-white"
              >
                <i className="fa-solid fa-xmark text-base" />
              </button>
            </div>

            <ol className="space-y-4">
              {STEPS.map(([icon, title, desc], i) => (
                <li key={title} className="flex gap-3 text-[13px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-[12px] font-bold text-brand dark:bg-night-head">
                    {i + 1}
                  </span>
                  <div>
                    <strong className="block text-[13.5px] leading-snug text-[#27364f] dark:text-[#f1eeeb]">
                      <i className={`fa-solid ${icon} mr-1.5 text-brand`} />
                      {title}
                    </strong>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[#777] dark:text-[#b8b0a8]">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex justify-end border-t border-[#eee] pt-4 dark:border-night-line">
              <button
                type="button"
                onClick={() => setInstructionsOpen(false)}
                className={btnPrimary}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
