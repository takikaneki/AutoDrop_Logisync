import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/**
 * Unified Search, Custom Dropdown Filter, and Custom Calendar Date Picker UI components
 * for Coordinator, Seller, and Rider portals (Light Mode & Dark Mode).
 */

export function SearchFilterBar({
  children,
  className = "",
  hasActiveFilters = false,
  onReset,
  resetLabel = "Reset",
}) {
  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] dark:border-night-line dark:bg-night-panel/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      {children}
      {hasActiveFilters && typeof onReset === "function" && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand-softer px-3.5 text-[12.5px] font-bold text-brand transition hover:bg-brand hover:text-white active:scale-[0.98] dark:border-brand/40 dark:bg-brand/15 dark:text-[#fb923c] dark:hover:bg-brand dark:hover:text-white"
        >
          <Icon name="rotate-ccw" className="h-3.5 w-3.5" />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  ariaLabel = "Search",
  className = "",
  compact = false,
}) {
  const hasValue = Boolean(String(value || "").length);
  const handleClear = () => {
    if (typeof onClear === "function") {
      onClear();
    } else if (typeof onChange === "function") {
      onChange({ target: { value: "" } });
    }
  };

  return (
    <div
      className={`group relative flex items-center rounded-xl border border-slate-200/95 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15 dark:border-night-line dark:bg-night-head dark:hover:border-[#4b3b34] dark:focus-within:border-brand dark:focus-within:ring-brand/20 ${
        compact ? "h-9" : "h-[42px] min-w-[220px] flex-1 max-[640px]:min-w-full"
      } ${className}`}
    >
      <Icon
        name="search"
        className={`pointer-events-none shrink-0 text-slate-400 transition-colors group-focus-within:text-brand dark:text-slate-400 ${
          compact ? "ml-2.5 h-3.5 w-3.5" : "ml-3.5 h-4 w-4"
        }`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`h-full w-full min-w-0 bg-transparent text-ink placeholder:text-slate-400 outline-none dark:text-white dark:placeholder:text-slate-400 ${
          compact ? "px-2 text-[12.5px]" : "px-2.5 text-[13.5px]"
        }`}
      />
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
          className={`mr-2 flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-brand/15 hover:text-brand dark:bg-slate-700/70 dark:text-slate-300 dark:hover:bg-brand/25 dark:hover:text-white ${
            compact ? "h-5 w-5" : "h-6 w-6"
          }`}
        >
          <Icon name="x" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      )}
    </div>
  );
}

function extractOptions(children) {
  const list = [];
  const walk = (nodes) => {
    React.Children.forEach(nodes, (child) => {
      if (!child) return;
      if (Array.isArray(child)) {
        walk(child);
        return;
      }
      if (child.type === React.Fragment) {
        walk(child.props?.children);
        return;
      }
      if (child.type === "option") {
        const text = React.Children.toArray(child.props?.children)
          .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
          .join("")
          .trim();
        const val = child.props?.value !== undefined ? String(child.props.value) : text;
        list.push({
          value: val,
          label: text || val,
          disabled: Boolean(child.props?.disabled),
        });
      }
    });
  };
  walk(children);
  return list;
}

export function FilterSelect({
  id,
  value,
  onChange,
  ariaLabel = "Filter",
  icon = "sliders-horizontal",
  active = false,
  className = "",
  children,
}) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapRef = useRef(null);

  const options = useMemo(() => extractOptions(children), [children]);
  const selectedIdx = options.findIndex((o) => o.value === String(value ?? ""));
  const selectedOption = selectedIdx >= 0 ? options[selectedIdx] : options[0];

  useEffect(() => {
    if (!open) return;
    setHighlightIdx(selectedIdx >= 0 ? selectedIdx : 0);
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (options.length ? (i + 1) % options.length : -1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
      } else if (e.key === "Enter" && open) {
        e.preventDefault();
        const picked = options[highlightIdx];
        if (picked && !picked.disabled) {
          onChange?.({ target: { value: picked.value } });
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, selectedIdx, highlightIdx, onChange]);

  const selectValue = (opt) => {
    if (opt.disabled) return;
    onChange?.({ target: { value: opt.value } });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative shrink-0 max-[640px]:w-full ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`group flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border px-3 text-left transition-all outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15 dark:focus-visible:ring-brand/20 ${
          open || active
            ? "border-brand/60 bg-[#fff7f3] text-[#0f172a] shadow-[0_1px_3px_rgba(238,77,45,0.1)] dark:border-brand/70 dark:bg-brand/15 dark:text-white"
            : "border-slate-200/95 bg-white text-[#1e293b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 dark:border-night-line dark:bg-night-head dark:text-slate-100 dark:hover:border-[#4b3b34]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            name={icon}
            className={`h-3.5 w-3.5 shrink-0 transition-colors ${
              open || active
                ? "text-brand"
                : "text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200"
            }`}
          />
          <span className="truncate text-[13px] font-semibold">
            {selectedOption ? selectedOption.label : "Select..."}
          </span>
        </span>
        <Icon
          name="chevron-down"
          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-brand" : active ? "text-brand" : "text-slate-400 dark:text-slate-400"
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+6px)] z-[1300] min-w-full w-max max-w-[min(300px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200/95 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] animate-popup dark:border-night-line dark:bg-night-panel dark:shadow-[0_18px_46px_rgba(0,0,0,0.45)]"
        >
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {options.map((opt, idx) => {
              const isSelected = opt.value === String(value ?? "");
              const isHighlighted = idx === highlightIdx;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => selectValue(opt)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-45 ${
                    isSelected
                      ? "bg-[#fff0e7] font-bold text-brand dark:bg-brand/20 dark:text-[#fb923c]"
                      : isHighlighted
                        ? "bg-slate-100 font-medium text-[#0f172a] dark:bg-slate-800/90 dark:text-white"
                        : "font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/90"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-brand dark:text-[#fb923c]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseIsoDate(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(String(str))) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toIsoDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatReadableDate(str) {
  const dt = parseIsoDate(str);
  if (!dt) return "";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DatePickerInput({
  id,
  value = "",
  onChange,
  placeholder = "Select date",
  ariaLabel = "Select date",
  className = "",
  align = "left",
}) {
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => (selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected || today).getMonth());
  const wrapRef = useRef(null);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const dt = new Date(viewYear, viewMonth - 1, daysInPrev - i);
      cells.push({ date: dt, iso: toIsoDate(dt), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      cells.push({ date: dt, iso: toIsoDate(dt), outside: false });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const nextDay = cells.length - (startOffset + daysInMonth) + 1;
      const dt = new Date(viewYear, viewMonth + 1, nextDay);
      cells.push({ date: dt, iso: toIsoDate(dt), outside: true });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const pickDate = (iso) => {
    onChange?.({ target: { value: iso } });
    setOpen(false);
  };

  const todayIso = toIsoDate(today);
  const selectedIso = selected ? toIsoDate(selected) : "";
  const hasValue = Boolean(selectedIso);

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <div
        className={`group flex h-[42px] w-full items-center justify-between gap-1.5 rounded-xl border px-3 transition-all ${
          open || hasValue
            ? "border-brand/60 bg-[#fff7f3] text-[#0f172a] shadow-[0_1px_3px_rgba(238,77,45,0.1)] dark:border-brand/70 dark:bg-brand/15 dark:text-white"
            : "border-slate-200/95 bg-white text-[#1e293b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 dark:border-night-line dark:bg-night-head dark:text-slate-100 dark:hover:border-[#4b3b34]"
        }`}
      >
        <button
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-none"
        >
          <Icon
            name="calendar-days"
            className={`h-4 w-4 shrink-0 transition-colors ${
              open || hasValue ? "text-brand" : "text-slate-400 group-hover:text-brand"
            }`}
          />
          <span
            className={`truncate text-[13px] ${
              hasValue ? "font-semibold" : "font-medium text-slate-400 dark:text-slate-400"
            }`}
          >
            {hasValue ? formatReadableDate(selectedIso) : placeholder}
          </span>
        </button>
        {hasValue ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.({ target: { value: "" } });
            }}
            aria-label="Clear date"
            title="Clear date"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand transition hover:bg-brand hover:text-white"
          >
            <Icon name="x" className="h-3 w-3" />
          </button>
        ) : (
          <Icon
            name="chevron-down"
            className={`pointer-events-none h-4 w-4 shrink-0 transition-transform duration-150 ${
              open ? "rotate-180 text-brand" : "text-slate-400"
            }`}
          />
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className={`absolute top-[calc(100%+6px)] z-[1400] w-[280px] max-w-[calc(100vw-28px)] overflow-hidden rounded-2xl border border-slate-200/95 bg-white p-3.5 shadow-[0_18px_46px_rgba(15,23,42,0.18)] animate-popup dark:border-night-line dark:bg-night-panel dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Month / Year Header */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 text-slate-600 transition hover:border-brand hover:bg-brand-softer hover:text-brand dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand dark:hover:bg-brand/15 dark:hover:text-[#fb923c]"
            >
              <Icon name="chevron-left" className="h-4 w-4" />
            </button>
            <strong className="text-[13.5px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
              {MONTHS[viewMonth]} {viewYear}
            </strong>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 text-slate-600 transition hover:border-brand hover:bg-brand-softer hover:text-brand dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand dark:hover:bg-brand/15 dark:hover:text-[#fb923c]"
            >
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((wd) => (
              <span
                key={wd}
                className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400"
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const isSelected = cell.iso === selectedIso;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pickDate(cell.iso)}
                  className={`flex h-8 w-full items-center justify-center rounded-lg text-[12.5px] transition ${
                    isSelected
                      ? "bg-brand font-extrabold text-white shadow-xs"
                      : isToday
                        ? "border border-brand/60 bg-[#fff3ec] font-bold text-brand dark:bg-brand/20 dark:text-[#fb923c]"
                        : cell.outside
                          ? "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800"
                          : "font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0f172a] dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => pickDate(todayIso)}
              className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-brand transition hover:bg-[#fff0e7] dark:text-[#fb923c] dark:hover:bg-brand/15"
            >
              Today
            </button>
            {hasValue && (
              <button
                type="button"
                onClick={() => pickDate("")}
                className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
