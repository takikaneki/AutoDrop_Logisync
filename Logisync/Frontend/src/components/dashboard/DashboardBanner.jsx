import { useState } from "react";
import { Link } from "react-router-dom";
import { getUser } from "../../api.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

// Welcome-inspired banner shared by Coordinator, Seller and Rider dashboards.
// Same visual design (white + SPX orange, route-line motif, photo card, step tracker);
// only the copy, highlights, actions and image change per role.
const ROLE_CONTENT = {
  coordinator: {
    eyebrow: "Express Verification Hub",
    title: "Keep every parcel verified and moving.",
    text: "Review seller video proofs, approve discreet-handling requests, and coordinate riders from one place.",
    image: "/images/spx-sorting-center.jpg",
    imageAlt: "SPX Express sorting center",
    steps: [
      ["fa-box-open", "Registered"],
      ["fa-shield-halved", "Verify"],
      ["fa-qrcode", "Dispatch"],
      ["fa-circle-check", "Delivered"],
    ],
    activeStep: 1,
    actions: [
      { to: "/verification", label: "Review parcels", icon: "fa-clipboard-check", primary: true },
      { to: "/parcels", label: "Parcel records", icon: "fa-box" },
    ],
  },
  seller: {
    eyebrow: "Seller Portal",
    title: "Register, verify and track your parcels.",
    text: "Create a parcel, upload your packing video, and monitor each parcel until it reaches your customer.",
    image: "/images/spx-courier-box.jpg",
    imageAlt: "SPX Express courier with parcel",
    steps: [
      ["fa-square-plus", "Register"],
      ["fa-video", "Upload video"],
      ["fa-shield-halved", "Verified"],
      ["fa-circle-check", "Delivered"],
    ],
    activeStep: 0,
    actions: [
      { to: "/seller/create", label: "Create parcel", icon: "fa-square-plus", primary: true },
      { to: "/seller/scan", label: "Upload video", icon: "fa-video" },
    ],
  },
  rider: {
    eyebrow: "Rider Portal",
    title: "Scan, deliver and update every drop.",
    text: "See your assigned parcels, scan each QR code to start delivery, and log the outcome on the road.",
    image: "/images/spx-doorstep-delivery.jpg",
    imageAlt: "SPX Express rider delivering a parcel",
    steps: [
      ["fa-box-open", "Assigned"],
      ["fa-qrcode", "Scan QR"],
      ["fa-truck-fast", "On the way"],
      ["fa-circle-check", "Delivered"],
    ],
    activeStep: 1,
    actions: [
      { to: "/rider/scan", label: "Scan parcel", icon: "fa-qrcode", primary: true },
      { to: "/rider/deliveries", label: "My deliveries", icon: "fa-truck-fast" },
    ],
  },
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

// highlights: [[label, value, icon, to?]]
export default function DashboardBanner({ role, highlights = [] }) {
  const c = ROLE_CONTENT[role] || ROLE_CONTENT.coordinator;
  const [imgOk, setImgOk] = useState(true);
  const name = (getUser()?.name || "").split(" ")[0];

  return (
    <section className="relative mb-7 overflow-hidden rounded-2xl border border-[#ffe3d3] bg-gradient-to-br from-white via-[#fffaf7] to-[#fff1e8] dark:border-night-line dark:from-night-panel dark:via-night-panel dark:to-night-head">
      {/* Route-line motif (Haulx-style) */}
      <svg aria-hidden="true" className="pointer-events-none absolute -right-10 -top-6 h-48 w-80 text-brand/15 max-[700px]:hidden" viewBox="0 0 320 190" fill="none">
        <path d="M0 20H170C230 20 250 60 250 100C250 150 280 170 320 170" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
      </svg>

      <div className="relative grid grid-cols-[1.4fr_1fr] items-center gap-6 p-7 max-[900px]:grid-cols-1 max-[600px]:p-5">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
            <img src={SPX_LOGO_DATA_URL} alt="SPX Express" draggable={false} className="h-7 w-auto object-contain" />
            <span className="h-5 w-px bg-[#e5e8ee] dark:bg-night-line" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">{c.eyebrow}</span>
          </div>

          <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#1b2437] dark:text-[#f1eeeb] max-[600px]:text-[21px]">
            {greeting()}{name ? `, ${name}` : ""}! <span className="text-brand">{c.title}</span>
          </h2>
          <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-[#64748b] dark:text-[#d1c9c2]">{c.text}</p>

          {/* 4-step tracker */}
          <ol className="mt-5 flex items-center gap-1.5 max-[420px]:hidden" aria-label="Parcel journey">
            {c.steps.map(([icon, label], i) => (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
                    i === c.activeStep
                      ? "bg-brand text-white shadow-sm"
                      : "bg-white text-[#64748b] ring-1 ring-[#eadfd8] dark:bg-night-head dark:text-[#d1c9c2] dark:ring-night-line"
                  }`}
                >
                  <i className={`fa-solid ${icon} text-[11px]`} /> {label}
                </span>
                {i < c.steps.length - 1 && <span className="h-px w-3 border-t border-dashed border-[#d9c6ba] max-[700px]:hidden" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {c.actions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition duration-200 hover:-translate-y-0.5 ${
                  a.primary
                    ? "bg-brand text-white shadow-[0_6px_16px_rgba(238,77,45,.28)] hover:bg-brand-dark"
                    : "border border-[#eadfd8] bg-white text-[#27364f] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]"
                }`}
              >
                <i className={`fa-solid ${a.icon}`} /> {a.label}
                <i className="fa-solid fa-arrow-right text-[11px] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>

        {/* Image + live highlights */}
        <div className="min-w-0 space-y-3">
          <div className="relative h-[150px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff7a4d] to-[#ee4d2d] shadow-sm max-[900px]:h-[130px]">
            {imgOk && (
              <img
                src={c.image}
                alt={c.imageAlt}
                loading="lazy"
                onError={() => setImgOk(false)}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            )}
            {!imgOk && (
              <div className="flex h-full items-center justify-center">
                <img src={SPX_LOGO_DATA_URL} alt="" className="h-10 w-auto opacity-90 brightness-0 invert" />
              </div>
            )}
            <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand backdrop-blur">
              SPX Express
            </span>
          </div>

          {highlights.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {highlights.map(([label, value, icon, to]) => {
                const inner = (
                  <>
                    <i className={`fa-solid ${icon} text-[13px] text-brand`} />
                    <strong className="mt-1 block text-[20px] leading-none text-[#1b2437] dark:text-[#f1eeeb]">{value}</strong>
                    <span className="mt-1 block text-[11px] leading-tight text-[#64748b] dark:text-[#d1c9c2]">{label}</span>
                  </>
                );
                const cls = "block rounded-xl border border-[#f0e3da] bg-white/90 p-3 text-left transition duration-200 dark:border-night-line dark:bg-night-head";
                return to ? (
                  <Link key={label} to={to} className={`${cls} hover:-translate-y-0.5 hover:border-brand hover:shadow-sm`}>{inner}</Link>
                ) : (
                  <div key={label} className={cls}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

