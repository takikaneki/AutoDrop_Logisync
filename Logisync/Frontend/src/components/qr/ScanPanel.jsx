import { useState } from "react";
import QrScanner from "./QrScanner.jsx";
import { parseTransactionNumber } from "../../utils/qr.js";
import { inputCls } from "../styles.js";

// Scanner + manual input sa iisang panel. Kahit scan o type, tatawagin ang onValue(value).
// busy = habang naghahanap sa backend.
export default function ScanPanel({
  onValue,
  busy = false,
  label = "Transaction number",
  btnClass = "bg-brand hover:bg-brand-dark",
  allowImageUpload = true,
  centered = false,
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

  if (centered) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <div className="w-full border-b border-[#eee] pb-5 dark:border-night-line">
          <p className="text-center text-[15px] font-bold">Can't scan? Type it instead</p>
          <p className="mt-1 text-center text-[13px] text-[#999]">
            Enter the {label.toLowerCase()} printed on the parcel. A parcel ID also works.
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submit(manual);
            }}
          >
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setError("");
              }}
              maxLength={100}
              placeholder={label}
              aria-label={label}
              className={`${inputCls} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={busy}
              className={`shrink-0 rounded-lg px-5 py-2.5 text-[14px] font-bold text-white transition disabled:opacity-60 ${btnClass}`}
            >
              {busy ? "Looking…" : "Look up"}
            </button>
          </form>
          {error && <p className="mt-2 text-center text-[12px] text-[#d94747]">{error}</p>}
        </div>

        <div className="w-full">
          <QrScanner
            btnClass={btnClass}
            allowImageUpload={allowImageUpload}
            windowSize="large"
            onScan={(text) => submit(text)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <QrScanner btnClass={btnClass} allowImageUpload={allowImageUpload} onScan={(text) => submit(text)} />

      <div className="flex flex-col justify-center">
        <p className="text-[15px] font-bold">Can't scan? Type it instead</p>
        <p className="mt-1 text-[13px] text-[#999]">
          Enter the {label.toLowerCase()} printed on the parcel. A parcel ID also works.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(manual);
          }}
        >
          <input
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              setError("");
            }}
            maxLength={100}
            placeholder={label}
            aria-label={label}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={busy}
            className={`rounded-lg px-4 py-2.5 text-[14px] font-bold text-white transition disabled:opacity-60 ${btnClass}`}
          >
            {busy ? "Looking…" : "Look up"}
          </button>
        </form>
        {error && <p className="mt-2 text-[12px] text-[#d94747]">{error}</p>}
      </div>
    </div>
  );
}
