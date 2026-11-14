import { Link } from "react-router-dom";
import { panel } from "./styles.js";

// Mga maliliit na piraso na pinagsasaluhan ng mga page ng Seller at Rider.
// Kapareho ng itsura ng mga card at panel ng Coordinator.

const tones = {
  orange: "bg-[#fff0e5] text-orange-500",
  yellow: "bg-[#fff4d8] text-[#e99a00]",
  green: "bg-[#d9f4e5] text-[#0c9b58]",
  red: "bg-[#ffe2e2] text-[#ef4444]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  gray: "bg-[#f1f1f1] text-[#999] dark:bg-night-head",
};

const cardBorders = {
  orange: "!border-[#fed7aa] !border-t-[3px] !border-t-[#ee4d2d] dark:!border-[#9a3412]/70 dark:!border-t-[#ee4d2d]",
  yellow: "!border-[#fde68a] !border-t-[3px] !border-t-[#f59e0b] dark:!border-[#92400e]/70 dark:!border-t-[#f59e0b]",
  green: "!border-[#bbf7d0] !border-t-[3px] !border-t-[#16a34a] dark:!border-[#166534]/70 dark:!border-t-[#16a34a]",
  red: "!border-[#fecaca] !border-t-[3px] !border-t-[#ef4444] dark:!border-[#991b1b]/70 dark:!border-t-[#ef4444]",
  blue: "!border-[#bfdbfe] !border-t-[3px] !border-t-[#3b82f6] dark:!border-[#1e40af]/70 dark:!border-t-[#3b82f6]",
  gray: "!border-[#e2e8f0] !border-t-[3px] !border-t-[#64748b] dark:!border-night-line dark:!border-t-[#64748b]",
};

// Summary card na may bilog na icon. Pare-pareho ang taas ng lahat ng card sa isang hanay (h-full + grid stretch).
export function StatCard({ label, value, icon, tone = "orange", to }) {
  const body = (
    <div
      className={`${panel} ${cardBorders[tone] || cardBorders.orange} flex h-full min-h-[120px] max-[820px]:min-h-[96px] max-[480px]:min-h-[82px] items-center gap-4 max-[820px]:gap-3 max-[480px]:gap-2.5 !px-6 !py-5 max-[1280px]:!px-4 max-[1280px]:!py-4 max-[480px]:!px-3 max-[480px]:!py-3 shadow-xs transition ${
        to ? "hover:shadow-md active:scale-[0.99]" : ""
      }`}
    >
      <div
        className={`flex h-[56px] w-[56px] max-[1280px]:h-[48px] max-[1280px]:w-[48px] max-[480px]:h-[38px] max-[480px]:w-[38px] shrink-0 items-center justify-center rounded-full text-[22px] max-[1280px]:text-[19px] max-[480px]:text-[16px] ${tones[tone]}`}
      >
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1.5 max-[600px]:mb-1 break-words text-[14.5px] max-[1280px]:text-[13.5px] max-[480px]:text-[12px] font-medium leading-tight text-[#56657d] dark:text-[#ddd7d2]">
          {label}
        </h3>
        <h2 className="truncate text-[30px] max-[1280px]:text-[26px] max-[600px]:text-[22px] max-[480px]:text-[20px] font-bold leading-none text-[#27364f] dark:text-[#f1eeeb]">
          {value}
        </h2>
      </div>
    </div>
  );
  return to ? (
    <Link
      to={to}
      aria-label={`${label}: ${value}. View records`}
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
      <h2 className="text-[19px] max-[600px]:text-[17px] font-bold">
        {icon && <i className={`fa-solid ${icon} mr-2 text-orange-500`} />}
        {children}
      </h2>
      {action}
    </div>
  );
}

export const PanelLink = ({ to, children }) => (
  <Link to={to} className="whitespace-nowrap text-sm text-orange-500 hover:underline">
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
      {icon && <i className={`fa-solid ${icon} mt-0.5`} />}
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
const dotIcon = { done: "fa-check", current: "fa-ellipsis", fail: "fa-xmark", todo: "fa-circle" };

export function Steps({ steps }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] ${dot[s.state]}`}>
              <i className={`fa-solid ${dotIcon[s.state]} ${s.state === "todo" ? "text-[7px]" : ""}`} />
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

export function LoadingRow({ children = "Loading…" }) {
  return <p className="py-10 text-center text-[14px] text-[#999]">{children}</p>;
}
