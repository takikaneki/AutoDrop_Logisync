import { NavLink, useLocation } from "react-router-dom";
import Icon from "../Icon.jsx";

const SELLER_MOBILE_ITEMS = [
  { to: "/seller", end: true, icon: "house", label: "Home" },
  { to: "/seller/parcels", icon: "package", label: "Parcels" },
  { to: "/seller/create", icon: "plus", label: "Create", featured: true },
  { to: "/seller/messages", icon: "message-circle", label: "Messages" },
  { to: "/seller/profile", icon: "user-round", label: "Profile" },
];

const RIDER_MOBILE_ITEMS = [
  { to: "/rider", end: true, icon: "house", label: "Home" },
  { to: "/rider/deliveries", icon: "truck", label: "My Deliveries" },
  { to: "/rider/scan", icon: "scan-line", label: "Scan QR", featured: true },
  { to: "/rider/messages", icon: "message-circle", label: "Messages" },
  { to: "/rider/profile", icon: "user-round", label: "Profile" },
];

const COORDINATOR_MOBILE_ITEMS = [
  { to: "/dashboard", end: true, icon: "house", label: "Home" },
  { to: "/parcels", icon: "package", label: "Parcels" },
  { to: "/verification", icon: "scan-line", label: "Verify", featured: true },
  { to: "/messages", icon: "message-circle", label: "Messages" },
  { to: "/profile", icon: "user-round", label: "Profile" },
];

function ModernFiveTabNav({ items, ariaLabel, isFeaturedActive, isProfileActive, profilePath }) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed bottom-0 inset-x-0 z-40 hidden max-[820px]:block border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-6px_24px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)] print:hidden dark:border-night-line dark:bg-night-panel/95"
    >
      <div className="grid h-[64px] grid-cols-5 items-end px-1 pb-1.5">
        {items.map((item) => {
          if (item.featured) {
            const active = isFeaturedActive;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className="group relative flex flex-col items-center justify-end gap-1 pb-0.5 text-[10px] font-bold transition"
              >
                <span
                  className={`-mt-6 flex h-[48px] w-[48px] items-center justify-center rounded-full shadow-[0_8px_20px_rgba(15,23,42,0.28)] ring-4 ring-white transition-transform active:scale-95 dark:ring-night-panel ${
                    active
                      ? "bg-brand text-white"
                      : "bg-[#0f172a] text-white group-hover:bg-[#1e293b] dark:bg-brand"
                  }`}
                >
                  <Icon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={2.1} />
                </span>
                <span
                  className={`whitespace-nowrap leading-none tracking-tight ${
                    active ? "text-brand" : "text-[#0f172a] dark:text-[#f1eeeb]"
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => {
                const active = item.to === profilePath ? isActive || isProfileActive : isActive;
                return `flex h-full flex-col items-center justify-end gap-1 rounded-xl pb-0.5 pt-2 text-[10px] font-semibold transition ${
                  active
                    ? "text-brand font-bold"
                    : "text-slate-500 hover:text-brand dark:text-[#b8b0a8]"
                }`;
              }}
            >
              {({ isActive }) => {
                const active = item.to === profilePath ? isActive || isProfileActive : isActive;
                return (
                  <>
                    <span
                      className={`flex h-7 w-10 items-center justify-center rounded-full transition ${
                        active ? "bg-brand/12 text-brand" : ""
                      }`}
                    >
                      <Icon name={item.icon} className="h-[19px] w-[19px]" strokeWidth={active ? 2.2 : 1.85} />
                    </span>
                    <span className="max-w-full whitespace-nowrap px-0.5 leading-none tracking-tight">
                      {item.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default function MobileBottomNav({ role = "coordinator" }) {
  const { pathname } = useLocation();

  if (role === "rider") {
    const isProfileSection =
      pathname.startsWith("/rider/profile") ||
      pathname.startsWith("/rider/settings") ||
      pathname.startsWith("/rider/analytics") ||
      pathname.startsWith("/rider/complaints") ||
      pathname.startsWith("/rider/help") ||
      pathname.startsWith("/rider/activity");

    return (
      <ModernFiveTabNav
        items={RIDER_MOBILE_ITEMS}
        ariaLabel="Rider mobile navigation"
        isFeaturedActive={pathname.startsWith("/rider/scan")}
        isProfileActive={isProfileSection}
        profilePath="/rider/profile"
      />
    );
  }

  if (role === "seller") {
    const isProfileSection =
      pathname.startsWith("/seller/profile") ||
      pathname.startsWith("/seller/settings") ||
      pathname.startsWith("/seller/analytics") ||
      pathname.startsWith("/seller/complaints") ||
      pathname.startsWith("/seller/help") ||
      pathname.startsWith("/seller/activity");

    return (
      <ModernFiveTabNav
        items={SELLER_MOBILE_ITEMS}
        ariaLabel="Seller mobile navigation"
        isFeaturedActive={pathname.startsWith("/seller/create")}
        isProfileActive={isProfileSection}
        profilePath="/seller/profile"
      />
    );
  }

  const isProfileSection =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/accounts") ||
    pathname.startsWith("/complaints") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/riders") ||
    pathname.startsWith("/sellers");

  return (
    <ModernFiveTabNav
      items={COORDINATOR_MOBILE_ITEMS}
      ariaLabel="Coordinator mobile navigation"
      isFeaturedActive={pathname.startsWith("/verification")}
      isProfileActive={isProfileSection}
      profilePath="/profile"
    />
  );
}
