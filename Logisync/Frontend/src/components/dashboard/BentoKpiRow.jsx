import { Link } from "react-router-dom";
import Icon from "../Icon.jsx";
import { BentoKpiSkeleton } from "../Skeletons.jsx";

const TONE_STYLES = {
  dark: {
    card: "bg-[#0f172a] text-white border-[#334155] border-t-[4px] border-t-[#64748b] shadow-[0_14px_30px_-14px_rgba(15,23,42,0.5)] dark:bg-night-panel dark:border-night-line dark:border-t-[#64748b]",
    arrow: "bg-white/10 text-white group-hover:bg-white/20",
    label: "text-slate-100",
    sub: "text-slate-400",
    badge: "bg-slate-700/80 text-slate-200",
  },
  light: {
    card: "bg-white text-[#1e293b] border-[#e5e8ee] shadow-sm dark:bg-night-panel dark:border-night-line dark:text-[#f1eeeb]",
    arrow: "bg-[#f3f5f9] text-[#27364f] group-hover:bg-[#e5e8ee] dark:bg-night-head dark:text-[#f1eeeb]",
    label: "text-[#27364f] dark:text-[#f1eeeb]",
    sub: "text-[#64748b] dark:text-[#b8b0a8]",
    badge: "bg-[#f3f5f9] text-[#52627a] dark:bg-night-head dark:text-[#d1c9c2]",
  },
  yellow: {
    card: "bg-[#eab308] text-white border-[#ca8a04] shadow-[0_14px_30px_-12px_rgba(234,179,8,0.45)] dark:bg-[#ca8a04] dark:border-[#a16207]",
    arrow: "bg-white/20 text-white group-hover:bg-white/30",
    label: "text-white",
    sub: "text-yellow-50",
    badge: "bg-white/20 text-white",
  },
  blue: {
    card: "bg-white text-[#1e293b] border-[#bfdbfe] border-t-[4px] border-t-[#3b82f6] shadow-sm dark:bg-night-panel dark:border-blue-500/40 dark:border-t-[#3b82f6] dark:text-[#f1eeeb]",
    arrow: "bg-[#dbeafe] text-[#1d4ed8] group-hover:bg-[#bfdbfe] dark:bg-blue-500/20 dark:text-[#60a5fa]",
    label: "text-[#27364f] dark:text-[#f1eeeb]",
    sub: "text-[#64748b] dark:text-[#b8b0a8]",
    badge: "bg-[#dbeafe] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-[#60a5fa]",
  },
  green: {
    card: "bg-[#16a34a] text-white border-[#15803d] shadow-[0_14px_30px_-12px_rgba(22,163,74,0.45)] dark:bg-[#15803d] dark:border-[#166534]",
    arrow: "bg-white/20 text-white group-hover:bg-white/30",
    label: "text-white",
    sub: "text-green-100",
    badge: "bg-white/20 text-white",
  },
  red: {
    card: "bg-white text-[#1e293b] border-[#fecaca] border-t-[4px] border-t-[#dc2626] shadow-sm dark:bg-night-panel dark:border-red-500/40 dark:border-t-[#dc2626] dark:text-[#f1eeeb]",
    arrow: "bg-[#fee2e2] text-[#dc2626] group-hover:bg-[#fecaca] dark:bg-red-500/20 dark:text-[#f87171]",
    label: "text-[#27364f] dark:text-[#f1eeeb]",
    sub: "text-[#64748b] dark:text-[#b8b0a8]",
    badge: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
  },
  orange: {
    card: "bg-[#d9482b] text-white border-[#bf3a20] shadow-[0_14px_30px_-12px_rgba(238,77,45,0.45)] dark:bg-[#c2410c] dark:border-[#9a3412]",
    arrow: "bg-white/20 text-white group-hover:bg-white/30",
    label: "text-white",
    sub: "text-orange-100",
    badge: "bg-white/20 text-white",
  },
};

export default function BentoKpiRow({ cards = [], loading = false }) {
  if (loading) {
    return <BentoKpiSkeleton count={cards.length || 3} />;
  }
  return (
    <div className="grid grid-cols-3 gap-4 max-[680px]:grid-cols-1 max-[600px]:gap-3">
      {cards.map((c) => {
        const s = TONE_STYLES[c.tone || "light"];
        return (
          <Link
            key={c.label}
            to={c.to || "#"}
            className={`group flex flex-col justify-between rounded-2xl border p-5 max-[600px]:p-4 transition duration-200 hover:-translate-y-0.5 ${s.card}`}
          >
            <div className="flex items-start justify-between gap-3">
              <strong className="text-[34px] max-[600px]:text-[28px] font-extrabold leading-none tracking-tight">
                {c.value}
              </strong>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] transition ${s.arrow}`}
                aria-hidden="true"
              >
                <Icon name="external-link" />
              </span>
            </div>

            <div className="mt-5 max-[600px]:mt-3.5">
              {c.badge && (
                <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                  {c.icon && <Icon name={c.icon} />}
                  {c.badge}
                </span>
              )}
              <div className={`text-[15px] font-bold leading-snug ${s.label}`}>{c.label}</div>
              {c.subtext && <p className={`mt-0.5 text-[12px] ${s.sub}`}>{c.subtext}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

