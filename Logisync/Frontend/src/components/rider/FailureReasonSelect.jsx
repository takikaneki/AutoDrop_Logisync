import { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";
import {
  IMMEDIATE_RTH_REASONS,
  MAX_RESCHEDULES,
  RESCHEDULE_REASONS,
  isImmediateRthReason,
} from "../../store/riderDeliveries.js";

/**
 * Custom LogiSync-styled Failure Reason selector.
 * Replaces the raw native <select> popup (which looks unstyled on mobile Chrome/Android)
 * with a clean, grouped, touch-friendly picker for both Reschedule and Return to Hub reasons.
 */
export default function FailureReasonSelect({
  id = "failure-reason",
  value = "",
  onChange,
  disabled = false,
  placeholder = "Select a failure reason…",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedIsRth = Boolean(value && isImmediateRthReason(value));
  const selectedIsResched = Boolean(value && !selectedIsRth);

  const pick = (reason) => {
    onChange?.(reason);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition focus:outline-none ${
          open
            ? "border-brand bg-white ring-2 ring-brand/15 dark:bg-night-head"
            : selectedIsRth
              ? "border-rose-300 bg-rose-50/40 dark:border-rose-800/70 dark:bg-rose-950/20"
              : selectedIsResched
                ? "border-amber-300 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20"
                : "border-slate-200/95 bg-white hover:border-slate-300 dark:border-night-line dark:bg-night-head"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {value ? (
            <>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  selectedIsRth
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                }`}
              >
                <Icon name={selectedIsRth ? "undo-2" : "calendar-days"} className="text-[10px]" />
                {selectedIsRth ? "RTH" : "Resched"}
              </span>
              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{value}</span>
            </>
          ) : (
            <span className="truncate text-slate-400 dark:text-slate-400">{placeholder}</span>
          )}
        </span>
        <Icon
          name="chevron-down"
          className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180 text-brand" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="mt-2 max-h-[290px] overflow-y-auto rounded-2xl border border-slate-200/95 bg-white p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.14)] dark:border-night-line dark:bg-night-panel dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
        >
          {/* Group 1: Automatic Next-Day Reschedule */}
          <div className="mb-1 flex items-center gap-1.5 rounded-lg bg-amber-50/90 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <Icon name="calendar-days" className="text-[11px]" />
            <span>Next-Day Reschedule (Max {MAX_RESCHEDULES} Attempts)</span>
          </div>
          <div className="space-y-1">
            {RESCHEDULE_REASONS.map((r) => {
              const active = value === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(r)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    active
                      ? "bg-brand-soft font-bold text-brand ring-1 ring-brand/25 dark:bg-brand/20 dark:text-[#ff9c84]"
                      : "font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:text-slate-200 dark:hover:bg-night-head"
                  }`}
                >
                  <span className="leading-snug">{r}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-night-soft"
                    }`}
                  >
                    {active && <Icon name="check" className="text-[11px]" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="my-2 border-t border-slate-100 dark:border-night-line" />

          {/* Group 2: Immediate Return to Hub */}
          <div className="mb-1 flex items-center gap-1.5 rounded-lg bg-rose-50/90 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <Icon name="undo-2" className="text-[11px]" />
            <span>Immediate Return to Hub (RTH · Proof Required)</span>
          </div>
          <div className="space-y-1">
            {IMMEDIATE_RTH_REASONS.map((r) => {
              const active = value === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(r)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    active
                      ? "bg-rose-50 font-bold text-rose-700 ring-1 ring-rose-300 dark:bg-rose-950/45 dark:text-rose-300 dark:ring-rose-800"
                      : "font-medium text-slate-700 hover:bg-rose-50/50 active:bg-rose-50 dark:text-slate-200 dark:hover:bg-night-head"
                  }`}
                >
                  <span className="leading-snug">{r}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      active
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-night-soft"
                    }`}
                  >
                    {active && <Icon name="check" className="text-[11px]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
