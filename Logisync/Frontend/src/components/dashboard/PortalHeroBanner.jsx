import { Link } from "react-router-dom";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";
import { useProfile } from "../../store/profile.js";

const ROLE_CONFIG = {
  coordinator: {
    badge: "COORDINATOR HUB",
    title: "Hub Verification & Monitoring",
    subtitle: "Review packing proofs, manage delivery holds, and monitor parcel flow across SPX hubs.",
    image: "/images/spx-conveyor-hub.jpg",
    imageAlt: "SPX Express sorting conveyor hub",
    liveText: "Hub Operations Active",
    primary: { label: "Scan Parcel", icon: "fa-qrcode", to: "/verification?scan=1" },
    secondary: { label: "Generate Report", icon: "fa-file-lines", to: "/parcels?report=1" },
  },
  seller: {
    badge: "SELLER PORTAL",
    title: "Seller Dispatch & Packing",
    subtitle: "Create parcels, upload packing verification videos, and track SPX courier handoffs.",
    image: "/images/spx-courier-box.jpg",
    imageAlt: "SPX Express courier parcel box",
    liveText: "Dispatch Ready",
    primary: { label: "Create Parcel", icon: "fa-square-plus", to: "/seller/create" },
    secondary: { label: "Generate Report", icon: "fa-file-lines", to: "/seller/parcels?report=1" },
  },
  rider: {
    badge: "RIDER PORTAL",
    title: "Last-Mile Delivery Operations",
    subtitle: "Scan assigned parcels, update doorstep delivery status, and keep routes on schedule.",
    image: "/images/spx-doorstep-delivery.jpg",
    imageAlt: "SPX Express doorstep parcel delivery",
    liveText: "Route Delivery Mode",
    primary: { label: "Scan Parcel", icon: "fa-qrcode", to: "/rider/scan" },
    secondary: { label: "Generate Report", icon: "fa-file-lines", to: "/rider/parcels?report=1" },
  },
};

export default function PortalHeroBanner({ role = "coordinator", pipeline = [] }) {
  const { name } = useProfile();
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.coordinator;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e8ee] bg-white shadow-sm dark:border-night-line dark:bg-night-panel">
      <div className="grid grid-cols-[1.35fr_0.95fr] max-[900px]:grid-cols-1">
        {/* Left: Brand Bridge + Greeting + Primary Actions */}
        <div className="flex flex-col justify-between p-6 max-[600px]:p-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <img src={SPX_LOGO_DATA_URL} alt="SPX Express" className="h-5 w-auto object-contain" />
              <span className="h-3.5 w-px bg-[#e2e8f0] dark:bg-night-line" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0e5] px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-[#ee4d2d] dark:bg-brand/20 dark:text-[#ffb98a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ee4d2d]" />
                {cfg.badge}
              </span>
            </div>

            <h1 className="text-[22px] max-[600px]:text-[18px] font-extrabold tracking-tight text-[#1e293b] dark:text-[#f1eeeb]">
              Welcome back, {name}
            </h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
              {cfg.subtitle}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 max-[600px]:grid max-[600px]:grid-cols-2">
            <Link
              to={cfg.primary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ee4d2d] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(238,77,45,0.65)] transition hover:bg-[#d94122]"
            >
              <i className={`fa-solid ${cfg.primary.icon}`} />
              <span>{cfg.primary.label}</span>
            </Link>
            <Link
              to={cfg.secondary.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5e8ee] bg-[#f8fafc] px-4 py-2.5 text-[13.5px] font-semibold text-[#334155] transition hover:border-[#cbd5e1] hover:bg-[#f1f5f9] dark:border-night-line dark:bg-night-head dark:text-[#e2ddd8] dark:hover:bg-[#352f2b]"
            >
              <i className={`fa-solid ${cfg.secondary.icon}`} />
              <span>{cfg.secondary.label}</span>
            </Link>
          </div>
        </div>

        {/* Right: Real SPX Express Photography */}
        <div className="relative min-h-[190px] max-[900px]:min-h-[140px] overflow-hidden bg-slate-900">
          <img
            src={cfg.image}
            alt={cfg.imageAlt}
            className="h-full w-full object-cover object-center"
          />
          {/* Smooth gradient fade matching WelcomeIntro.jsx */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/25 to-transparent max-[900px]:bg-gradient-to-t max-[900px]:from-slate-950/70 max-[900px]:via-transparent dark:from-night-panel dark:via-night-panel/30" />
          <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {cfg.liveText}
          </div>
        </div>
      </div>

      {/* Bottom 4-Step LogiSync Pipeline Strip */}
      {pipeline.length > 0 && (
        <div className="grid grid-cols-4 border-t border-[#edf0f4] bg-[#fafbfc] dark:border-night-line dark:bg-night-head/70 max-[600px]:grid-cols-2">
          {pipeline.map((step, idx) => (
            <Link
              key={step.label}
              to={step.to || "#"}
              className="group flex items-center justify-between gap-2 border-r border-[#edf0f4] px-4 py-3 transition last:border-r-0 hover:bg-[#fffaf7] dark:border-night-line dark:hover:bg-night-panel max-[600px]:border-b max-[600px]:even:border-r-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-[12px] font-bold text-[#ee4d2d] dark:bg-brand/20">
                  <i className={`fa-solid ${step.icon}`} />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-[#64748b] dark:text-[#b8b0a8]">
                    {idx + 1}. {step.label}
                  </span>
                  <strong className="block text-[14px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                    {step.count}
                  </strong>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-[10px] text-[#cbd5e1] transition group-hover:translate-x-0.5 group-hover:text-[#ee4d2d]" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

