import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useT } from "../store/prefs.js";
import useBase from "../hooks/useBase.js";

// Pangalan ng bawat bahagi ng URL para sa breadcrumbs
const names = {
  dashboard: "Dashboard",
  parcels: "Parcels",
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

// Page header: breadcrumbs (+ optional `children` na buttons sa kanan).
// Wala nang malaking pamagat sa itaas ng page (nasa sidebar/breadcrumbs na ang pangalan ng page);
// nananatili ang `title` para sa tab title ng browser at sa screen readers.
export default function Topbar({ title, children }) {
  const t = useT();
  const base = useBase(); // "" (Coordinator) | "/seller" | "/rider"
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const label = title ? t(title) : "";

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

  // Dashboard: walang breadcrumbs at walang buttons -> summary cards agad ang nasa itaas
  if (crumbs.length === 1 && !children) return <h1 className="sr-only">{label}</h1>;

  return (
    <header className="mb-6 flex items-center justify-between gap-4 flex-wrap print:hidden">
      <h1 className="sr-only">{label}</h1>
      {crumbs.length > 1 ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#999]">
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
      ) : (
        <span />
      )}
      {children && <div className="flex items-center gap-2.5 flex-wrap">{children}</div>}
    </header>
  );
}
