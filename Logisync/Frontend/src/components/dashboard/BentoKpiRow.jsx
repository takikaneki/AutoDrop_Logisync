import { Link } from "react-router-dom";

const TONE_STYLES = {
  dark: {
    card: "bg-[#0f172a] text-white border-[#1e293b] shadow-[0_14px_30px_-14px_rgba(15,23,42,0.5)] dark:bg-[#0b1120] dark:border-slate-800",
    arrow: "bg-white/10 text-white group-hover:bg-white/20",
    label: "text-slate-200",
    sub: "text-slate-400",
    badge: "bg-white/10 text-orange-300",
  },
  light: {
    card: "bg-white text-[#1e293b] border-[#e5e8ee] shadow-sm dark:bg-night-panel dark:border-night-line dark:text-[#f1eeeb]",
    arrow: "bg-[#f3f5f9] text-[#27364f] group-hover:bg-[#e5e8ee] dark:bg-night-head dark:text-[#f1eeeb]",
    label: "text-[#27364f] dark:text-[#f1eeeb]",
    sub: "text-[#64748b] dark:text-[#b8b0a8]",
    badge: "bg-[#f3f5f9] text-[#52627a] dark:bg-night-head dark:text-[#d1c9c2]",
  },
  orange: {
    card: "bg-gradient-to-br from-[#ee4d2d] to-[#f97316] text-white border-[#ea580c] shadow-[0_14px_30px_-12px_rgba(238,77,45,0.48)]",
    arrow: "bg-white/20 text-white group-hover:bg-white/30",
    label: "text-white",
    sub: "text-orange-100",
    badge: "bg-white/20 text-white",
  },
};

export default function BentoKpiRow({ cards = [] }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-1 max-[600px]:gap-3">
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
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </span>
            </div>

            <div className="mt-5 max-[600px]:mt-3.5">
              {c.badge && (
                <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                  {c.icon && <i className={`fa-solid ${c.icon}`} />}
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

