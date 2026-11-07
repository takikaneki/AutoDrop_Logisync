import { useState } from "react";
import { Link } from "react-router-dom";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

// Global image banner displayed at the top across all user portals (Coordinator, Seller, and Rider).
// Provides official SPX Express branding, crisp logo and portal badge alignment, and balanced height.
const CONTENT = {
  coordinator: {
    home: "/dashboard",
    label: "Coordinator Hub",
    tagline: "Verify parcels and coordinate every delivery.",
    image: "/images/spx-sorting-center.jpg",
    objectPosition: "object-[center_35%]",
  },
  seller: {
    home: "/seller",
    label: "Seller Portal",
    tagline: "Register, verify and track every parcel.",
    image: "/images/spx-trucks-fleet.jpg",
    objectPosition: "object-[center_45%]",
  },
  rider: {
    home: "/rider",
    label: "Rider Portal",
    tagline: "Scan, deliver and update every drop.",
    image: "/images/spx-doorstep-delivery.jpg",
    objectPosition: "object-[72%_20%]",
  },
};

export default function GlobalBanner({ role = "coordinator" }) {
  const c = CONTENT[role] || CONTENT.coordinator;
  const [imgOk, setImgOk] = useState(true);

  return (
    <div
      role="banner"
      className="relative h-[150px] max-[640px]:h-[118px] sm:h-[160px] lg:h-[170px] w-full overflow-hidden bg-gradient-to-r from-[#fffbf8] via-[#fff5ed] to-[#ffede0] print:hidden dark:from-night-head dark:via-night-panel dark:to-night-head"
    >
      {/* Right-aligned photo container that preserves natural proportions without aggressive cropping */}
      <div className="absolute inset-y-0 right-0 w-full sm:w-[65%] lg:w-[50%] overflow-hidden pointer-events-none">
        {imgOk ? (
          <img
            src={c.image}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setImgOk(false)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${c.objectPosition || "object-center"}`}
          />
        ) : (
          <svg
            aria-hidden="true"
            className="absolute right-0 top-0 h-full w-[60%] text-brand/20"
            viewBox="0 0 520 160"
            fill="none"
            preserveAspectRatio="xMaxYMid slice"
          >
            <path
              d="M0 40H300C380 40 410 80 410 110C410 135 440 150 520 150"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="2 14"
            />
          </svg>
        )}

        {/* Soft horizontal gradient feathering: seamlessly merges the photo with the solid left branding area */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fffbf8] via-[#fffbf8]/75 via-20% to-transparent dark:from-night-head dark:via-night-head/75 dark:to-transparent" />
        {/* Subtle top/bottom edge soften */}
        <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-[#fffbf8]/50 to-transparent dark:from-night-head/50" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-[#fffbf8]/50 to-transparent dark:from-night-head/50" />
      </div>

      {/* Subtle ambient orange glow in the top-left */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-brand/10 blur-2xl" />

      {/* Left side: Crisp, high-contrast branding, portal badge, and tagline */}
      <div className="relative z-10 flex h-full items-center px-6 max-[640px]:px-4 sm:px-10 lg:px-14">
        <div className="flex flex-col justify-center max-w-[560px]">
          <Link
            to={c.home}
            aria-label={`SPX Express LogiSync ${c.label}`}
            className="group inline-flex items-center gap-3.5 max-[640px]:gap-2.5 sm:gap-4 transition-transform hover:translate-x-0.5"
          >
            {/* SPX Express Official Logo */}
            <img
              src={SPX_LOGO_DATA_URL}
              alt="SPX Express"
              draggable={false}
              className="h-9 max-[640px]:h-7 sm:h-10 lg:h-11 w-auto shrink-0 object-contain drop-shadow-sm"
            />

            {/* Vertical separator */}
            <span
              className="h-8 max-[640px]:h-6 sm:h-9 w-[1.5px] bg-slate-300 dark:bg-slate-700"
              aria-hidden="true"
            />

            {/* LogiSync Brand + Portal Role Badge */}
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex flex-wrap items-center gap-2 max-[640px]:gap-1.5 sm:gap-2.5">
                <span className="text-[22px] max-[640px]:text-[18px] sm:text-[24px] lg:text-[26px] font-black tracking-tight text-slate-900 leading-none dark:text-white">
                  LogiSync
                </span>
                <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 max-[640px]:px-2 py-0.5 text-[10px] max-[640px]:text-[9.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-brand border border-brand/25 shadow-sm">
                  {c.label}
                </span>
              </div>
              <span className="text-[10px] max-[640px]:text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] max-[640px]:tracking-[0.1em] text-slate-400 dark:text-slate-400 mt-1 max-[640px]:mt-0.5">
                Parcel Verification System
              </span>
            </div>
          </Link>

          {/* Tagline */}
          <p className="mt-2.5 max-[640px]:mt-1.5 text-[13px] max-[640px]:text-[11.5px] sm:text-[13.5px] font-medium leading-relaxed max-[640px]:leading-snug text-slate-600 dark:text-slate-300">
            {c.tagline}
          </p>
        </div>
      </div>

      {/* Official SPX Orange bottom accent border */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-brand" aria-hidden="true" />
    </div>
  );
}
