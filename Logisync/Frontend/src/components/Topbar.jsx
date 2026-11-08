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

// Page header: breadcrumbs, title/subtitle, and action buttons on the upper-right corner.
export default function Topbar({ title, subtitle, right, children }) {
  const t = useT();
  const base = useBase(); // "" (Coordinator) | "/seller" | "/rider"
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const label = title ? t(title) : "";
  const actions = children || right;

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

  // Dashboard without extra buttons: show clean page heading on mobile, sr-only on desktop
  if (crumbs.length === 1 && !actions) {
    return (
      <header className="mb-3 min-[821px]:sr-only print:hidden">
        <h1 className="text-[19px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{label}</h1>
      </header>
    );
  }

  return (
    <header className="mb-6 flex items-start justify-between gap-3 flex-wrap print:hidden max-[600px]:mb-3.5 max-[600px]:gap-2.5">
      <div className="min-w-0 flex-1">
        {crumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#999]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <i className="fa-solid fa-chevron-right text-[9px]" />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-brand">{c.label}</Link>
                ) : (
                  <span className="font-semibold text-[#666] dark:text-[#d1c9c2]">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] max-[600px]:text-[19px] font-bold leading-tight text-[#27364f] dark:text-[#f1eeeb]">
          {label}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13px] max-[600px]:text-[12px] text-[#888] leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center justify-end gap-2 flex-wrap shrink-0 max-[520px]:w-full max-[520px]:justify-start">
          {actions}
        </div>
      )}
    </header>
  );
}
