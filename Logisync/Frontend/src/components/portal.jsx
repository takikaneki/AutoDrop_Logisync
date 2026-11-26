import { Link } from "react-router-dom";
import { panel } from "./styles.js";
import Icon from "./Icon.jsx";
import { ParcelCardListSkeleton, SkeletonBlock } from "./Skeletons.jsx";

// Mga maliliit na piraso na pinagsasaluhan ng mga page ng Seller at Rider.
// Kapareho ng itsura ng mga card at panel ng Coordinator.

const tones = {
  orange: "text-orange-500",
  yellow: "text-[#eab308] dark:text-[#facc15]",
  green: "text-[#16a34a] dark:text-[#4ade80]",
  red: "text-[#dc2626] dark:text-[#f87171]",
  blue: "text-[#3b82f6] dark:text-[#60a5fa]",
  gray: "text-[#64748b] dark:text-[#94a3b8]",
};

const cardBorders = {
  orange: "!border-brand-line !border-t-[3px] !border-t-brand dark:!border-[#9a3412]/70 dark:!border-t-brand",
  yellow: "!border-[#fde047] !border-t-[3px] !border-t-[#facc15] dark:!border-[#a16207]/70 dark:!border-t-[#facc15]",
  green: "!border-[#bbf7d0] !border-t-[3px] !border-t-[#16a34a] dark:!border-[#166534]/70 dark:!border-t-[#16a34a]",
  red: "!border-[#fecaca] !border-t-[3px] !border-t-[#dc2626] dark:!border-[#991b1b]/70 dark:!border-t-[#dc2626]",
  blue: "!border-[#bfdbfe] !border-t-[3px] !border-t-[#3b82f6] dark:!border-[#1e40af]/70 dark:!border-t-[#3b82f6]",
  gray: "!border-[#cbd5e1] !border-t-[3px] !border-t-[#64748b] dark:!border-slate-700 dark:!border-t-[#64748b]",
};

// Summary card na may bilog na icon. Pare-pareho ang taas ng lahat ng card sa isang hanay (h-full + grid stretch).
export function StatCard({ label, value, icon, tone = "orange", to, active = false, interactive = false, loading = false }) {
  const isPlaceholderValue = loading || value === "…" || value === "—";
  const isClickable = Boolean(to || interactive || active);
  const body = (
    <div
      className={`group ${panel} ${cardBorders[tone] || cardBorders.orange} flex h-full min-h-[120px] max-[820px]:min-h-[96px] max-[480px]:min-h-[82px] items-center gap-4 max-[820px]:gap-3 max-[480px]:gap-2.5 !px-6 !py-5 max-[1280px]:!px-4 max-[1280px]:!py-4 max-[480px]:!px-3 max-[480px]:!py-3 shadow-xs transition hover:ring-2 hover:ring-brand/30 hover:shadow-md ${
        isClickable ? "cursor-pointer active:scale-[0.99]" : ""
      } ${active ? "ring-2 ring-brand/50 !border-brand shadow-sm" : ""}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center text-[26px] max-[1280px]:text-[22px] max-[480px]:text-[20px] ${tones[tone]}`}
      >
        <Icon name={icon} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1.5 max-[600px]:mb-1 break-words text-[13.5px] max-[1280px]:text-[13px] max-[480px]:text-[12px] font-semibold leading-tight text-[#475569] dark:text-[#cbd5e1]">
          {label}
        </h3>
        {isPlaceholderValue ? (
          <div role="status" aria-busy="true" aria-label={`Loading ${label}`}>
            <SkeletonBlock className="h-7 w-14 rounded-lg max-[600px]:h-6 max-[480px]:h-5 max-[480px]:w-11" />
          </div>
        ) : (
          <h2 className="truncate text-[28px] max-[1280px]:text-[25px] max-[600px]:text-[22px] max-[480px]:text-[20px] font-bold leading-none tracking-tight tabular-nums text-[#0f172a] dark:text-[#f8fafc]">
            {value}
          </h2>
        )}
      </div>
      {isClickable && (
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 max-[480px]:h-7 max-[480px]:w-7 shrink-0 items-center justify-center rounded-full transition-all group-hover:translate-x-0.5 ${
            active
              ? "bg-brand text-white shadow-xs"
              : "bg-slate-100 text-slate-400 group-hover:bg-brand-soft group-hover:text-brand dark:bg-night-head dark:text-[#9c948c] dark:group-hover:bg-brand/20 dark:group-hover:text-brand"
          }`}
        >
          <Icon name={to ? "external-link" : "chevron-right"} className="h-4 w-4 max-[480px]:h-3.5 max-[480px]:w-3.5" />
        </span>
      )}
    </div>
  );
  return to ? (
    <Link
      to={to}
      aria-label={`${label}: ${isPlaceholderValue ? "loading" : value}. View records`}
      className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

// Hanay ng summary cards: pare-pareho ang gap, alignment at breakpoints sa lahat ng page.
export function StatGrid({ cols = 4, children, className = "mb-7 max-[600px]:mb-5" }) {
  return (
    <div className={`stat-wrap ${className}`}>
      <section className={`stat-grid ${cols === 3 ? "stat-grid-3" : ""}`}>{children}</section>
    </div>
  );
}

// Pamagat ng panel na may icon, at link/aksyon sa kanan
export function PanelTitle({ icon, children, action }) {
  return (
    <div className="mb-5 max-[600px]:mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[19px] max-[600px]:text-[17px] font-bold">
        {icon && <Icon name={icon} className="text-orange-500" />}
        <span>{children}</span>
      </h2>
      {action}
    </div>
  );
}

export const PanelLink = ({ to, children }) => (
  <Link to={to} className="whitespace-nowrap text-sm font-bold text-orange-500 hover:underline">
    {children} →
  </Link>
);

const hasDetailValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim();
    return Boolean(
      s &&
        s !== "-" &&
        s !== "—" &&
        s !== "–" &&
        s.toLowerCase() !== "n/a" &&
        s.toLowerCase() !== "null" &&
        s.toLowerCase() !== "undefined"
    );
  }
  return true;
};

// Listahan ng "label: halaga" (detalye ng parcel) — itinatago ang mga walang laman o "-" lang
export function DetailList({ rows, cols = 2 }) {
  const visibleRows = (rows || []).filter(([, v]) => hasDetailValue(v));
  if (visibleRows.length === 0) return null;
  return (
    <dl className={`grid gap-x-6 gap-y-4 text-[14px] ${cols === 2 ? "sm:grid-cols-2" : ""}`}>
      {visibleRows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="mb-0.5 text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">{k}</dt>
          <dd className="break-words font-semibold text-[#333] dark:text-[#f1eeeb]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Mensahe sa loob ng panel: tone = info | success | warn | error
const noticeTones = {
  info: "bg-[#eaf3ff] text-[#3a6ea5] dark:bg-[#4285c5]/15 dark:text-[#9cc3ea]",
  success: "bg-[#eaf8ef] text-[#1f7f4a] dark:bg-[#29945a]/15 dark:text-[#8fd6ae]",
  warn: "bg-[#fff4e8] text-[#b45f10] dark:bg-brand/15 dark:text-[#ffb98a]",
  error: "bg-[#fff0f0] text-[#c23a3a] dark:bg-[#d94747]/15 dark:text-[#f2a1a1]",
};
export function Notice({ tone = "info", icon, children, ...rest }) {
  return (
    <div className={`flex gap-3 rounded-xl px-4 py-3 text-[14px] ${noticeTones[tone]}`} {...rest}>
      {icon && <Icon name={icon} className="mt-0.5 text-[16px]" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Hakbang-hakbang na progress. steps = [{ label, note, state: "done" | "current" | "todo" | "fail" }]
const dot = {
  done: "bg-[#29945a] text-white",
  current: "bg-brand text-white",
  fail: "bg-[#d94747] text-white",
  todo: "bg-[#eee] text-[#aaa] dark:bg-night-head",
};
const dotIcon = { done: "check", current: "ellipsis", fail: "x", todo: "circle" };

export function Steps({ steps }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] ${dot[s.state]}`}>
              <Icon name={dotIcon[s.state]} className={s.state === "todo" ? "h-2 w-2" : "h-3.5 w-3.5"} />
            </span>
            {i < steps.length - 1 && <span className={`my-1 w-0.5 flex-1 ${s.state === "done" ? "bg-[#29945a]/40" : "bg-[#eee] dark:bg-night-line"}`} />}
          </div>
          <div className="pb-5">
            <strong className={`block text-[14px] ${s.state === "todo" ? "text-[#aaa]" : ""}`}>{s.label}</strong>
            {s.note && <span className="block text-[12px] text-[#999]">{s.note}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LoadingRow({ rows = 4, label = "Loading records" }) {
  return (
    <div className="py-2">
      <ParcelCardListSkeleton count={rows} label={label} />
    </div>
  );
}
