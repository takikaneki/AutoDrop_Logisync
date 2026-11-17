import { useState } from "react";
import QrScanner from "./QrScanner.jsx";
import { parseTransactionNumber } from "../../utils/qr.js";
import { inputCls } from "../styles.js";

// Centered Scanner + manual Transaction Number input sa iisang panel.
// Kahit scan o type, tatawagin ang onValue(value).
export default function ScanPanel({
  onValue,
  busy = false,
  label = "Transaction number",
  btnClass = "bg-brand hover:bg-brand-dark",
}) {
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  const submit = (raw) => {
    const value = parseTransactionNumber(raw);
    if (!value) return setError("Enter a value first.");
    if (value.length > 100) return setError("That value is too long to be a valid number.");
    setError("");
    onValue(value);
  };

  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-5">
      {/* 1. Centered 360x360 Cube QR Camera Scanner */}
      <div className="w-full">
        <QrScanner
          btnClass={btnClass}
          onScan={(text) => submit(text)}
        />
      </div>

      {/* 2. "OR ENTER MANUALLY" Divider */}
      <div className="relative flex w-full items-center py-0.5">
        <div className="flex-grow border-t border-brand-line dark:border-night-line" />
        <span className="mx-3 shrink-0 rounded-full bg-[#1e293b] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white dark:bg-night-head dark:text-[#d1c9c2]">
          Or enter manually
        </span>
        <div className="flex-grow border-t border-brand-line dark:border-night-line" />
      </div>

      {/* 3. Manual Transaction Number Input Below (Exact 360px Width) */}
      <div className="w-full">
        <div className="mb-2.5 text-center">
          <p className="text-[14.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
            Can&apos;t scan? Type it instead
          </p>
          <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#b8b0a8]">
            Enter the {label.toLowerCase()} or parcel ID printed on the parcel.
          </p>
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(manual);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <i className="fa-solid fa-hashtag pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[#999]" />
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setError("");
              }}
              maxLength={100}
              placeholder={`${label}...`}
              aria-label={label}
              className={`${inputCls} pl-7 font-mono`}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className={`h-[42px] shrink-0 rounded-lg px-4 text-[13px] font-bold text-white transition disabled:opacity-60 ${btnClass}`}
          >
            {busy ? "Looking…" : "Look up"}
          </button>
        </form>
        {error && <p className="mt-2 text-center text-[12px] font-medium text-[#d94747]">{error}</p>}
      </div>

      {/* Subtle QR + Parcel Figure */}
      <div className="flex items-center justify-center pt-1">
        <svg viewBox="0 0 110 72" className="h-14 w-24 opacity-95" fill="none" aria-hidden="true">
          <rect x="14" y="14" width="32" height="32" rx="6" fill="#fff8f3" stroke="#1e293b" strokeWidth="2" />
          <rect x="20" y="20" width="8" height="8" rx="1.5" stroke="#ff6818" strokeWidth="2" />
          <rect x="32" y="20" width="8" height="8" rx="1.5" stroke="#1e293b" strokeWidth="2" />
          <rect x="20" y="32" width="8" height="8" rx="1.5" stroke="#1e293b" strokeWidth="2" />
          <rect x="33" y="33" width="6" height="6" rx="1" fill="#ff6818" />
          <rect x="54" y="24" width="36" height="34" rx="6" fill="#ff6818" stroke="#1e293b" strokeWidth="2" />
          <path d="M54 35h36M72 24v34" stroke="#fff8f3" strokeWidth="2" />
          <circle cx="92" cy="20" r="4" fill="#fff0e7" stroke="#ff6818" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
