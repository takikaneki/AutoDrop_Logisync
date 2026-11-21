import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  profile: "Profile",
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
export default function Topbar({ title, subtitle, right, actions: actionsProp, children }) {
  const t = useT();
  const base = useBase(); // "" (Coordinator) | "/seller" | "/rider"
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const parts = pathname.split("/").filter(Boolean);
  const label = title ? t(title) : "";
  const actions = children || right || actionsProp;
  const isRider = base === "/rider";

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

  // Rider Portal Mobile (max-[820px]): clean back-arrow + centered title bar (matches Settings mobile header).
  // Desktop Rider (min-[821px]), Seller, and Coordinator remain 100% unchanged.
  if (isRider && !isHomeDashboard) {
    const fallbackBack =
      pathname.startsWith("/rider/help") ||
      pathname.startsWith("/rider/complaints") ||
      pathname.startsWith("/rider/about") ||
      pathname.startsWith("/rider/contact")
        ? "/rider/profile"
        : "/rider";

    const handleRiderBack = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackBack);
      }
    };

    return (
      <>
        <header className="sticky top-14 z-30 -mx-3.5 -mt-3.5 mb-3.5 max-[380px]:-mx-2.5 flex h-[52px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md min-[821px]:hidden print:hidden dark:border-night-line dark:bg-night-panel/95">
          <button
            type="button"
            onClick={handleRiderBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0f172a] transition active:scale-95 hover:bg-slate-100 dark:text-white dark:hover:bg-night-head"
          >
            <i className="fa-solid fa-arrow-left text-[17px]" />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-2 text-center text-[16.5px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            {label}
          </h1>
          <span className="h-10 w-10 shrink-0" aria-hidden="true" />
        </header>

        {actions && (
          <div className="mb-3.5 min-[821px]:mb-4 flex items-center justify-end gap-2 flex-wrap print:hidden min-[821px]:ml-auto max-[520px]:w-full max-[520px]:justify-start">
            {actions}
          </div>
        )}
      </>
    );
  }

  // Remove redundant top page header block on Desktop Web View when no actions exist; preserve mobile header intact
  if (!actions) {
    if (crumbs.length === 1) {
      return (
        <header className="mb-3 min-[821px]:hidden print:hidden">
          <h1 className="text-[19px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
            {isHomeDashboard ? t("Home") : label}
          </h1>
        </header>
      );
    }

    return (
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap min-[821px]:hidden print:hidden max-[600px]:mb-3.5 max-[600px]:gap-2.5">
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
            {isHomeDashboard ? (
              <>
                <span className="max-[820px]:hidden">{label}</span>
                <span className="hidden max-[820px]:inline">{t("Home")}</span>
              </>
            ) : (
              label
            )}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[13px] max-[600px]:text-[12px] text-[#888] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="mb-6 min-[821px]:mb-4 flex items-start justify-between gap-3 flex-wrap print:hidden max-[600px]:mb-3.5 max-[600px]:gap-2.5">
      <div className="min-w-0 flex-1 min-[821px]:hidden">
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
          {isHomeDashboard ? (
            <>
              <span className="max-[820px]:hidden">{label}</span>
              <span className="hidden max-[820px]:inline">{t("Home")}</span>
            </>
          ) : (
            label
          )}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13px] max-[600px]:text-[12px] text-[#888] leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center justify-end gap-2 flex-wrap shrink-0 min-[821px]:ml-auto max-[520px]:w-full max-[520px]:justify-start">
          {actions}
        </div>
      )}
    </header>
  );
}
