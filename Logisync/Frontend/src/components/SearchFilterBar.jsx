import Icon from "./Icon.jsx";

/**
 * Unified Search & Filter UI components for Coordinator, Seller, and Rider portals.
 * Designed for crisp visual hierarchy in both Light Mode and Dark Mode.
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
      className={`mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-[#0b1322]/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
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
      className={`group relative flex items-center rounded-xl border border-slate-200/95 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15 dark:border-slate-700/80 dark:bg-[#111c30] dark:hover:border-slate-600 dark:focus-within:border-brand dark:focus-within:ring-brand/20 ${
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

export function FilterSelect({
  value,
  onChange,
  ariaLabel = "Filter",
  icon = "sliders-horizontal",
  active = false,
  className = "",
  children,
}) {
  return (
    <div
      className={`group relative flex h-[42px] shrink-0 items-center rounded-xl border transition-all focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15 dark:focus-within:border-brand dark:focus-within:ring-brand/20 max-[640px]:w-full ${
        active
          ? "border-brand/50 bg-[#fff7f3] text-[#0f172a] shadow-[0_1px_2px_rgba(238,77,45,0.08)] dark:border-brand/60 dark:bg-brand/10 dark:text-white"
          : "border-slate-200/95 bg-white text-[#1e293b] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 dark:border-slate-700/80 dark:bg-[#111c30] dark:text-slate-100 dark:hover:border-slate-600"
      } ${className}`}
    >
      <Icon
        name={icon}
        className={`pointer-events-none absolute left-3 h-3.5 w-3.5 transition-colors ${
          active
            ? "text-brand"
            : "text-slate-400 group-focus-within:text-brand dark:text-slate-400"
        }`}
      />
      <select
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className="h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent pl-9 pr-8 text-[13px] font-semibold text-inherit outline-none [&>option]:bg-white [&>option]:text-[#0f172a] dark:[&>option]:bg-[#111c30] dark:[&>option]:text-white"
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        className={`pointer-events-none absolute right-2.5 h-4 w-4 transition-colors ${
          active
            ? "text-brand"
            : "text-slate-400 group-hover:text-slate-600 group-focus-within:text-brand dark:text-slate-400 dark:group-hover:text-slate-200"
        }`}
      />
    </div>
  );
}
