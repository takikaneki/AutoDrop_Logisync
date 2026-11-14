import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useT } from "../store/prefs.js";
import useBase from "../hooks/useBase.js";

// Pangalan ng bawat bahagi ng URL para sa breadcrumbs
const names = {
  dashboard: "Dashboard",
  parcels: "Parcel Records",
  reports: "Reports",
  verification: "Verification",
  riders: "Riders",
  sellers: "Sellers",
  messages: "Messages",
  complaints: "Complaints",
  announcements: "Announcements",
  notifications: "Notifications",
  analytics: "Analytics",
  audit: "Audit Log",
  accounts: "Accounts",
  activity: "Activity Log",
  settings: "Settings",
  seller: "Seller Portal",
  rider: "Rider Portal",
  create: "Create Parcel",
  scan: "Scan QR",
  pending: "Deliveries",
  deliveries: "Deliveries",
  delivered: "Delivered",
  failed: "Failed Delivery",
  about: "About Us",
  contact: "Contact",
  help: "Help",
};

const PAGE_META = {
  parcels: { icon: "fa-boxes-stacked", subtitle: "Track, filter, and manage parcel records and verification statuses." },
  verification: { icon: "fa-shield-halved", subtitle: "Review seller packing videos and approve or flag parcels for dispatch." },
  deliveries: { icon: "fa-truck-fast", subtitle: "Manage your active delivery route, handoffs, and completion status." },
  pending: { icon: "fa-truck-fast", subtitle: "Manage your active delivery route, handoffs, and completion status." },
  create: { icon: "fa-square-plus", subtitle: "Scan or enter a tracking number and register a new parcel for SPX dispatch." },
  scan: { icon: "fa-qrcode", subtitle: "Scan a parcel QR code or enter a transaction number to continue." },
  reports: { icon: "fa-file-lines", subtitle: "Generate and export parcel verification and delivery reports." },
  analytics: { icon: "fa-chart-line", subtitle: "Monitor parcel throughput, verification trends, and hub performance." },
  messages: { icon: "fa-comments", subtitle: "Coordinate directly with your team in real time." },
  notifications: { icon: "fa-bell", subtitle: "Stay updated with parcel alerts, holds, and system announcements." },
  activity: { icon: "fa-clock-rotate-left", subtitle: "Review a chronological log of parcel updates and user actions." },
  audit: { icon: "fa-clock-rotate-left", subtitle: "Review system audit events, verification decisions, and user actions." },
  complaints: { icon: "fa-headset", subtitle: "Submit or review delivery issues, disputes, and support requests." },
  announcements: { icon: "fa-bullhorn", subtitle: "Read important operational notices and hub advisories." },
  riders: { icon: "fa-motorcycle", subtitle: "View active riders, assigned routes, and delivery performance." },
  sellers: { icon: "fa-store", subtitle: "Manage registered sellers, verification status, and parcel activity." },
  accounts: { icon: "fa-users-gear", subtitle: "Manage portal accounts, roles, and access permissions." },
  settings: { icon: "fa-gear", subtitle: "Manage your profile details, password, and display preferences." },
  help: { icon: "fa-circle-question", subtitle: "Browse quick answers to common questions or reach support." },
  about: { icon: "fa-circle-info", subtitle: "Learn more about the LogiSync × SPX Express verification platform." },
  contact: { icon: "fa-envelope", subtitle: "Get in touch with LogiSync support and operations." },
};

// Page header: breadcrumbs, title/subtitle, and action buttons on the upper-right corner.
export default function Topbar({ title, subtitle, right, actions: actionsProp, children }) {
  const t = useT();
  const base = useBase(); // "" (Coordinator) | "/seller" | "/rider"
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const label = title ? t(title) : "";
  const actions = children || right || actionsProp;

  useEffect(() => {
    if (label) document.title = `${label} · LogiSync`;
  }, [label]);

  const crumbs = [{ label: t("Home"), to: base || "/dashboard" }];
  parts.forEach((p, i) => {
    if (p === "dashboard" || (base && i === 0)) return;
    crumbs.push({
      label: names[p] ? t(names[p]) : decodeURIComponent(p),
      to: i < parts.length - 1 ? "/" + parts.slice(0, i + 1).join("/") : null,
    });
  });

  const isHomeDashboard = title === "Dashboard";
  const lastSegment = parts[parts.length - 1] || "";
  const meta = PAGE_META[lastSegment] || {};
  const icon = meta.icon || "fa-layer-group";
  const displaySubtitle = subtitle || meta.subtitle || "";

  // Home Dashboard already has the Bento Grid hero on desktop; keep Topbar mobile-only there.
  if (isHomeDashboard && !actions) {
    return (
      <header className="mb-3 min-[821px]:hidden print:hidden">
        <h1 className="text-[19px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
          {t("Home")}
        </h1>
      </header>
    );
  }

  return (
    <header className="relative mb-6 max-[600px]:mb-4 overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a] px-6 py-5 max-[600px]:px-4 max-[600px]:py-4 text-white shadow-[0_12px_28px_-14px_rgba(15,23,42,0.45)] print:hidden">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#ee4d2d]/20 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <span className="flex h-11 w-11 max-[600px]:h-10 max-[600px]:w-10 shrink-0 items-center justify-center rounded-xl border border-[#ee4d2d]/30 bg-[#ee4d2d]/15 text-[18px] text-[#ff7854]">
            <i className={`fa-solid ${icon}`} />
          </span>
          <div className="min-w-0 flex-1">
            {crumbs.length > 1 && (
              <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-400">
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <i className="fa-solid fa-chevron-right text-[8px] text-slate-500" />}
                    {c.to ? (
                      <Link to={c.to} className="transition hover:text-orange-300">{c.label}</Link>
                    ) : (
                      <span className="font-semibold text-orange-300">{c.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-[21px] max-[600px]:text-[18px] font-extrabold leading-tight tracking-tight text-white">
              {label}
            </h1>
            {displaySubtitle && (
              <p className="mt-1 text-[13px] max-[600px]:text-[12px] leading-snug text-slate-300">
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center justify-end gap-2 flex-wrap shrink-0 max-[600px]:w-full max-[600px]:justify-start">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
