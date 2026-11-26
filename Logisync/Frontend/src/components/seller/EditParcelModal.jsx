import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon.jsx";
import { FilterSelect } from "../SearchFilterBar.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls } from "../styles.js";
import {
  CONTENT_CATEGORIES,
  evaluateDeclarationFlags,
  formatFullAddress,
  isCategoryDiscreetEligible,
  validateParcel,
} from "../../utils/parcelForm.js";
import {
  CAVITE_PROVINCE,
  TRECE_MARTIRES_BARANGAYS,
  TRECE_MARTIRES_CITY,
} from "../../data/phLocations.js";
import { sanitizeMobileNumber } from "../../utils/phone.js";
import { updateSellerParcel } from "../../services/parcelService.js";

function buildInitialForm(parcel) {
  if (!parcel) return null;
  const isCod =
    Boolean(parcel.is_cod) ||
    String(parcel.payment_method || "").toUpperCase() === "COD";

  return {
    transaction_number: parcel.transaction_number || "",
    receiver_name: parcel.receiver_name || "",
    receiver_contact: sanitizeMobileNumber(parcel.receiver_contact || ""),
    receiver_house_number: parcel.receiver_house_number || "",
    receiver_street: parcel.receiver_street || "",
    receiver_barangay: parcel.receiver_barangay || "",
    receiver_city: parcel.receiver_city || TRECE_MARTIRES_CITY,
    receiver_province: parcel.receiver_province || CAVITE_PROVINCE,
    receiver_address: parcel.receiver_address || "",
    contents: parcel.contents || "",
    quantity: Math.max(1, parseInt(parcel.quantity, 10) || 1),
    content_category: parcel.content_category || "",
    other_category_description: parcel.other_category_description || "",
    discrete_item: Boolean(parcel.discrete_item),
    discreet_reason: parcel.discreet_reason || "",
    is_cod: isCod,
    payment_method: isCod ? "COD" : "NON_COD",
  };
}

export default function EditParcelModal({ parcel, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildInitialForm(parcel));
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildInitialForm(parcel));
    setErrors({});
    setApiError("");
  }, [parcel]);

  useEffect(() => {
    if (!parcel) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [parcel, saving, onClose]);

  const discreetEligible = useMemo(
    () => isCategoryDiscreetEligible(form?.content_category || ""),
    [form?.content_category]
  );

  const declarationWarnings = useMemo(
    () => (form ? evaluateDeclarationFlags(form) : []),
    [form]
  );

  if (!parcel || !form) return null;

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "content_category" && !isCategoryDiscreetEligible(value)) {
        next.discrete_item = false;
        next.discreet_reason = "";
      }
      if (key === "content_category" && value !== "Other") {
        next.other_category_description = "";
      }
      if (key === "payment_method") {
        next.is_cod = value === "COD";
      }
      return next;
    });
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
    if (apiError) setApiError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateParcel(form);
    // Transaction number is immutable and not edited here
    delete validationErrors.transaction_number;

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setApiError("");
    try {
      const category = (form.content_category || "").trim();
      const isDiscrete =
        Boolean(form.discrete_item) && isCategoryDiscreetEligible(category);
      const isCod = form.payment_method === "COD";

      const payload = {
        receiver_name: (form.receiver_name || "").trim(),
        receiver_contact: sanitizeMobileNumber(form.receiver_contact),
        receiver_house_number: (form.receiver_house_number || "").trim(),
        receiver_street: (form.receiver_street || "").trim(),
        receiver_barangay: (form.receiver_barangay || "").trim(),
        receiver_city: (form.receiver_city || "").trim(),
        receiver_province: (form.receiver_province || "").trim(),
        receiver_address: formatFullAddress(form),
        contents: (form.contents || "").trim(),
        quantity: Math.max(1, parseInt(form.quantity, 10) || 1),
        content_category: category,
        other_category_description:
          category === "Other" ? (form.other_category_description || "").trim() : "",
        discrete_item: isDiscrete,
        discreet_reason: isDiscrete ? (form.discreet_reason || "").trim() : "",
        is_cod: isCod,
        payment_method: isCod ? "COD" : "NON_COD",
      };

      const updated = await updateSellerParcel(parcel.parcel_id, payload);
      onSaved?.(updated);
      onClose?.();
    } catch (err) {
      setApiError(err?.message || "Failed to update parcel details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-parcel-modal-title"
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-[#ececec] bg-white shadow-2xl dark:border-night-line dark:bg-night-panel"
      >
        <div className="flex items-center justify-between border-b border-[#eee] px-5 py-4 dark:border-night-line">
          <div className="min-w-0">
            <h2
              id="edit-parcel-modal-title"
              className="text-[17px] font-bold text-[#222] dark:text-[#f1eeeb]"
            >
              Edit Parcel Details
            </h2>
            <p className="mt-0.5 text-[12px] text-[#777] dark:text-[#b8b0a8]">
              Editable until a verification video is uploaded.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose?.()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777] transition hover:bg-[#f5f5f5] hover:text-[#222] disabled:opacity-50 dark:text-[#b8b0a8] dark:hover:bg-night-head"
            aria-label="Close edit parcel modal"
          >
            <Icon name="x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#eee] bg-[#fafafa] px-3.5 py-2.5 text-[12.5px] dark:border-night-line dark:bg-night-head/60 max-[480px]:grid-cols-1">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Parcel ID (Locked)
                </span>
                <span className="font-mono font-bold text-brand">{parcel.parcel_id}</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  Transaction Number (Locked)
                </span>
                <span className="font-mono font-semibold text-[#222] dark:text-[#f1eeeb]">
                  {parcel.transaction_number || "—"}
                </span>
              </div>
            </div>

            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#f5c2c2] bg-[#fff1f1] px-3.5 py-2.5 text-[13px] text-[#c53030] dark:border-[#6e2424] dark:bg-[#3a1616] dark:text-[#fda4a4]"
              >
                <Icon name="triangle-alert" className="mt-0.5 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <div>
                <label className={labelCls}>Customer / Receiver Name *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.receiver_name}
                  onChange={(e) => setField("receiver_name", e.target.value)}
                  maxLength={100}
                  required
                />
                {errors.receiver_name && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_name}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Receiver Contact Number *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  className={inputCls}
                  value={form.receiver_contact}
                  onChange={(e) =>
                    setField("receiver_contact", sanitizeMobileNumber(e.target.value))
                  }
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  required
                />
                {errors.receiver_contact && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_contact}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <div>
                <label className={labelCls}>House / Unit &amp; Street *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.receiver_street}
                  onChange={(e) => setField("receiver_street", e.target.value)}
                  maxLength={150}
                  required
                />
                {errors.receiver_street && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_street}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Barangay *</label>
                <input
                  type="text"
                  list="edit-parcel-barangays"
                  className={inputCls}
                  value={form.receiver_barangay}
                  onChange={(e) => setField("receiver_barangay", e.target.value)}
                  maxLength={150}
                  required
                />
                <datalist id="edit-parcel-barangays">
                  {TRECE_MARTIRES_BARANGAYS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                {errors.receiver_barangay && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_barangay}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <div>
                <label className={labelCls}>City / Municipality *</label>
                <input
                  type="text"
                  className={`${inputCls} cursor-not-allowed bg-[#f5f5f5] text-[#666] dark:bg-night-head dark:text-[#b8b0a8]`}
                  value={form.receiver_city || TRECE_MARTIRES_CITY}
                  readOnly
                  aria-readonly="true"
                  maxLength={150}
                  required
                />
                {errors.receiver_city && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_city}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Province *</label>
                <input
                  type="text"
                  className={`${inputCls} cursor-not-allowed bg-[#f5f5f5] text-[#666] dark:bg-night-head dark:text-[#b8b0a8]`}
                  value={form.receiver_province || CAVITE_PROVINCE}
                  readOnly
                  aria-readonly="true"
                  maxLength={150}
                  required
                />
                {errors.receiver_province && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.receiver_province}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <div>
                <label className={labelCls}>Content Category *</label>
                <FilterSelect
                  value={form.content_category}
                  onChange={(e) => setField("content_category", e.target.value)}
                  icon="tag"
                  fullWidth
                  inline
                  ariaLabel="Content Category"
                >
                  <option value="">Select category…</option>
                  {CONTENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </FilterSelect>
                {errors.content_category && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.content_category}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className={inputCls}
                    value={form.quantity}
                    onChange={(e) => setField("quantity", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment *</label>
                  <FilterSelect
                    value={form.payment_method}
                    onChange={(e) => setField("payment_method", e.target.value)}
                    icon={null}
                    fullWidth
                    inline
                    ariaLabel="Payment"
                  >
                    <option value="NON_COD">Non-COD</option>
                    <option value="COD">COD</option>
                  </FilterSelect>
                </div>
              </div>
            </div>

            {form.content_category === "Other" && (
              <div>
                <label className={labelCls}>Specify &quot;Other&quot; Category *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.other_category_description}
                  onChange={(e) => setField("other_category_description", e.target.value)}
                  maxLength={255}
                  placeholder="Describe the item category"
                />
                {errors.other_category_description && (
                  <p className="mt-1 text-[11.5px] text-[#d94a4a]">
                    {errors.other_category_description}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>Parcel Contents / Item Description *</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.contents}
                onChange={(e) => setField("contents", e.target.value)}
                maxLength={255}
                required
              />
              {errors.contents && (
                <p className="mt-1 text-[11.5px] text-[#d94a4a]">{errors.contents}</p>
              )}
            </div>

            {discreetEligible && (
              <div className="rounded-xl border border-[#eee] bg-[#fafafa] p-3.5 dark:border-night-line dark:bg-night-head/50">
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-[#222] dark:text-[#f1eeeb]">
                  <input
                    type="checkbox"
                    checked={Boolean(form.discrete_item)}
                    onChange={(e) => setField("discrete_item", e.target.checked)}
                    className="h-4 w-4 rounded accent-brand"
                  />
                  <span>Request discreet packaging / handling</span>
                </label>

                {form.discrete_item && (
                  <div className="mt-2.5">
                    <label className={labelCls}>Discreet Handling Reason *</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.discreet_reason}
                      onChange={(e) => setField("discreet_reason", e.target.value)}
                      maxLength={500}
                      placeholder="Explain why discreet handling is required (at least 10 characters)"
                    />
                    {errors.discreet_reason && (
                      <p className="mt-1 text-[11.5px] text-[#d94a4a]">
                        {errors.discreet_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {declarationWarnings.length > 0 && (
              <div className="rounded-xl border border-[#f5d08a] bg-[#fff8e6] px-3.5 py-2.5 text-[12px] text-[#92400e] dark:border-[#6e4e14] dark:bg-[#33240a] dark:text-[#fcd34d]">
                {declarationWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#eee] px-5 py-3.5 dark:border-night-line">
            <button
              type="button"
              disabled={saving}
              onClick={() => onClose?.()}
              className={btnGhost}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              <Icon name={saving ? "loader-circle" : "check"} className={saving ? "animate-spin" : ""} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
