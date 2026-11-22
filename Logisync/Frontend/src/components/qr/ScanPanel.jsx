import { useState } from "react";
import QrScanner from "./QrScanner.jsx";
import Icon from "../Icon.jsx";
import {
  TRANSACTION_NUMBER_FORMAT_HINT,
  isValidTransactionNumber,
  parseTransactionNumber,
} from "../../utils/qr.js";
import { inputCls } from "../styles.js";

// Centered Scanner + manual Transaction Number input sa iisang panel.
// Kahit scan o type, tatawagin ang onValue(value).
export default function ScanPanel({
  onValue,
  busy = false,
  error: externalError = "",
  label = "Transaction number",
  placeholder,
  btnClass = "bg-brand hover:bg-brand-dark",
  autoStart = false,
}) {
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  const submit = (raw) => {
    const value = parseTransactionNumber(raw);
    if (!value) return setError("Enter a transaction number first.");
    if (!isValidTransactionNumber(value)) {
      return setError(
        `Invalid format ("${value}"). Expected ${TRANSACTION_NUMBER_FORMAT_HINT}.`
      );
    }
    setError("");
    onValue(value);
  };

  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-5">
      {/* 1. Centered 360x360 Cube QR Camera Scanner */}
      <div className="w-full">
        <QrScanner
          btnClass={btnClass}
          autoStart={autoStart}
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
            Format: PH + 10 digits + 1 uppercase letter, or PH + 12 digits.
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
            <Icon name="hash" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[#999]" />
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14));
                setError("");
              }}
              maxLength={14}
              placeholder={placeholder || "PH1234567890A / PH123456789012"}
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
        {(error || externalError) && (
          <p className="mt-2 text-center text-[12px] font-medium text-[#d94747]">
            {error || externalError}
          </p>
        )}
      </div>

      {/* Clean Lucide QR + Parcel Indicator */}
      <div className="flex items-center justify-center gap-3 pt-1 text-slate-400 dark:text-slate-500" aria-hidden="true">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-[#0f172a] dark:border-night-line dark:bg-night-head dark:text-slate-200">
          <Icon name="qr-code" className="h-5 w-5" />
        </span>
        <Icon name="arrow-right" className="h-4 w-4 text-brand" />
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/25 bg-brand-soft text-brand dark:bg-brand/15">
          <Icon name="package" className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
