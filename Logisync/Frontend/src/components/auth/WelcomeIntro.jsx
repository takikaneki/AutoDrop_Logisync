import { useEffect, useRef, useState } from "react";

// Welcome screen: full-screen logistics background images, orange & white logistics icons and visual
// elements inspired by the reference layout, swipe-only navigation across 3 slides, while keeping the
// existing LogiSync logo at the top center and the "Let's Get Started" button at the bottom center.

const SLIDES = [
  {
    id: "deliver-anywhere",
    image: "/images/truck-highway.jpg",
    alt: "Freight delivery truck driving on a highway",
    steps: [
      { icon: "fa-magnifying-glass-location", label: "FIND IT" },
      { icon: "fa-box-open", label: "VERIFY IT" },
      { icon: "fa-truck-fast", label: "SHIP IT" },
    ],
    titleLine1: "We Will Deliver Your",
    titleHighlight: "Packages",
    titleLine2: "Anywhere!",
    titleIcon: "fa-box-archive",
    quote:
      "We connect sellers, hub coordinators, and riders in real time so every parcel goes straight from warehouse verification to your customer's doorstep.",
    ribbon: ["BOOKING", "VERIFICATION", "QR TRACKING", "DELIVERY", "PROOF OF HANDOFF", "SHIPPING"],
    // Slide 1 visual elements based on top-left of inspiration image (Tracking / Rate & Ship widget + service badges)
    widgetType: "tracking-card",
    featureCards: [
      {
        icon: "fa-truck-fast",
        title: "Road Fleet Dispatch",
        subtitle: "Direct hub-to-door routes",
        image: "/images/truck-highway.jpg",
      },
      {
        icon: "fa-warehouse",
        title: "Smart Hub Sorting",
        subtitle: "Palletized & QR indexed",
        image: "/images/warehouse-racks.jpg",
      },
      {
        icon: "fa-boxes-stacked",
        title: "Container Loading",
        subtitle: "Verified cargo handoff",
        image: "/images/parcel-loading.jpg",
      },
    ],
  },
  {
    id: "safe-and-quick",
    image: "/images/warehouse-racks.jpg",
    alt: "Modern logistics warehouse with parcels stacked on orange pallet racks",
    steps: [
      { icon: "fa-clipboard-check", label: "REGISTER" },
      { icon: "fa-video", label: "INSPECT" },
      { icon: "fa-qrcode", label: "DISPATCH" },
    ],
    titleLine1: "Deliver Your",
    titleHighlight: "Logistics",
    titleLine2: "Safely & Quickly",
    titleIcon: "fa-shield-halved",
    quote:
      "From start to finish, our seamless warehouse verification and QR scanning workflow ensures a safe, transparent delivery experience every single time.",
    ribbon: ["WAREHOUSE HUB", "VIDEO PROOF", "QR SCANNING", "SAFE TRANSIT", "FAST DISPATCH", "VERIFIED"],
    // Slide 2 visual elements based on bottom-left & top-right of inspiration image
    widgetType: "safety-pill",
    featureCards: [
      {
        icon: "fa-qrcode",
        title: "100% QR Scanned",
        subtitle: "Every parcel logged at pickup",
        image: "/images/warehouse-racks.jpg",
      },
      {
        icon: "fa-shield-halved",
        title: "Verified Condition",
        subtitle: "Photo & video hub check",
        image: "/images/parcel-loading.jpg",
      },
      {
        icon: "fa-route",
        title: "Live Route Tracking",
        subtitle: "Real-time rider updates",
        image: "/images/container-terminal.jpg",
      },
    ],
  },
  {
    id: "effortless-solutions",
    image: "/images/parcel-loading.jpg",
    alt: "Palletized parcel boxes being loaded into a delivery container at a warehouse dock",
    steps: [
      { icon: "fa-dolly", label: "LOAD IT" },
      { icon: "fa-location-dot", label: "TRACK IT" },
      { icon: "fa-circle-check", label: "RECEIVE IT" },
    ],
    titleLine1: "Effortless Delivery",
    titleHighlight: "With Our Logistic",
    titleLine2: "Solutions",
    titleIcon: "fa-truck-ramp-box",
    quote:
      "Our coordination team and express delivery riders work together at every mile, ensuring accurate scheduling, instant notifications, and verified proof of delivery.",
    ribbon: ["EXPRESS FLEET", "SMART SCHEDULING", "HUB COORDINATION", "LIVE ALERTS", "PROOF OF DELIVERY", "LOGISYNC"],
    // Slide 3 visual elements based on middle-right of inspiration image (framed overlapping thumbnails + quick response)
    widgetType: "solutions-showcase",
    featureCards: [
      {
        icon: "fa-stopwatch",
        title: "On-Time Window",
        subtitle: "Smart 3-day schedule guard",
        image: "/images/truck-highway.jpg",
      },
      {
        icon: "fa-camera",
        title: "Proof of Delivery",
        subtitle: "Instant recipient confirmation",
        image: "/images/parcel-loading.jpg",
      },
      {
        icon: "fa-headset",
        title: "Hub Coordination",
        subtitle: "Connected seller & rider alerts",
        image: "/images/warehouse-racks.jpg",
      },
    ],
  },
];

const SWIPE_THRESHOLD = 50; // px

export default function WelcomeIntro({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const axis = useRef(null); // "x" | "y" | null

  const go = (i) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const begin = (x, y) => {
    startX.current = x;
    startY.current = y;
    axis.current = null;
    setDragging(true);
  };
  const move = (x, y) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    const dy = y - startY.current;
    if (!axis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current === "x") setDrag(dx);
  };
  const end = () => {
    if (startX.current === null) return;
    if (axis.current === "x") {
      if (drag <= -SWIPE_THRESHOLD) go(index + 1);
      else if (drag >= SWIPE_THRESHOLD) go(index - 1);
    }
    startX.current = null;
    axis.current = null;
    setDrag(0);
    setDragging(false);
  };

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onComplete?.(), 450);
  };

  return (
    <div
      className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 text-white transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Enlarged Full-Screen Background Image Layer (fills entire screen with zero white margins) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <img
            key={s.id}
            src={s.image}
            alt=""
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
              i === index ? "scale-100 opacity-100" : "scale-105 opacity-0"
            }`}
          />
        ))}
        {/* Balanced contrast overlay so the full-screen background photo remains vivid while orange & white elements pop */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/65 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/60" />
      </div>

      {/* Logo (kept as is) */}
      <header className="relative z-20 flex items-center justify-center gap-2.5 pt-6 sm:pt-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
          <i className="fa-solid fa-box" />
        </span>
        <span className="text-xl font-extrabold tracking-tight text-white drop-shadow-sm">LogiSync</span>
      </header>

      {/* Swipeable slides (swipe-only, following the inspiration image layout & icon placement) */}
      <div
        className="relative z-10 min-h-0 flex-1 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={(e) => begin(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
        role="region"
        aria-roledescription="carousel"
        aria-label="Introduction slides. Swipe left or right."
      >
        <div
          className={`flex h-full ${dragging ? "" : "transition-transform duration-500 ease-out"}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
        >
          {SLIDES.map((s, i) => (
            <section
              key={s.id}
              aria-hidden={i !== index}
              className="flex h-full w-full shrink-0 flex-col justify-between px-4 py-3 sm:px-8 lg:px-14"
            >
              {/* Main Hero Split Grid (matches inspiration layout) */}
              <div
                className={`mx-auto grid my-auto w-full max-w-7xl grid-cols-1 items-center gap-6 transition-all duration-500 lg:grid-cols-12 lg:gap-10 ${
                  i === index ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
              >
                {/* Left Column: Step Badges, Headline with inline Orange/White Icon, Quote, and Inspiration Widget */}
                <div className="lg:col-span-7">
                  {/* Step Pills (FIND IT | VERIFY IT | SHIP IT style from reference image) */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                    {s.steps.map((step, idx) => (
                      <div key={step.label} className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-widest text-white backdrop-blur-md ring-1 ring-white/25">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] text-white">
                            <i className={`fa-solid ${step.icon}`} />
                          </span>
                          {step.label}
                        </span>
                        {idx < s.steps.length - 1 && (
                          <span className="text-xs font-bold text-brand">|</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Headline with inline orange & white logistics icon badge (matching reference image) */}
                  <h1 className="text-2xl font-extrabold leading-[1.12] tracking-tight text-white drop-shadow-md sm:text-4xl lg:text-5xl">
                    <span>{s.titleLine1} </span>
                    <span className="text-brand">{s.titleHighlight}</span>
                    <span className="mx-2 inline-flex h-8 w-8 -translate-y-0.5 rotate-[-8deg] items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-orange-500/30 ring-2 ring-white sm:h-11 sm:w-11">
                      <i className={`fa-solid ${s.titleIcon} text-sm sm:text-xl`} />
                    </span>
                    <span className="block sm:inline">{s.titleLine2}</span>
                  </h1>

                  {/* Subtitle / Quote */}
                  <p className="mt-2.5 max-w-xl text-xs leading-relaxed text-white/85 sm:mt-3.5 sm:text-sm">
                    {s.quote}
                  </p>

                  {/* Inspiration-based Visual Elements (Orange & White Icons) */}
                  {s.widgetType === "tracking-card" && (
                    <div className="mt-4 max-w-md rounded-2xl bg-white/95 p-3.5 text-slate-900 shadow-2xl backdrop-blur-md sm:mt-5 sm:p-4">
                      <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-extrabold text-white">
                            <i className="fa-solid fa-magnifying-glass-location" />
                            Live Tracking
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-brand">
                            <i className="fa-solid fa-truck-fast" />
                            Rate &amp; Ship
                          </span>
                        </div>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-xs text-brand">
                          <i className="fa-solid fa-qrcode" />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <i className="fa-solid fa-barcode text-brand" />
                          <span className="truncate font-mono font-semibold text-slate-700">
                            TXN-2026-LOGISYNC
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-extrabold text-white shadow-sm">
                          <i className="fa-solid fa-location-crosshairs" />
                          Verified
                        </span>
                      </div>
                    </div>
                  )}

                  {s.widgetType === "safety-pill" && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
                      <div className="inline-flex items-center gap-3 rounded-2xl bg-brand p-2 pr-4 text-white shadow-xl shadow-orange-500/25 ring-1 ring-white/30">
                        <div className="flex -space-x-1.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs text-brand ring-2 ring-brand">
                            <i className="fa-solid fa-box-open" />
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs text-brand ring-2 ring-brand">
                            <i className="fa-solid fa-video" />
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs text-brand ring-2 ring-brand">
                            <i className="fa-solid fa-shield-halved" />
                          </span>
                        </div>
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/90">
                            100% Verified Handling
                          </div>
                          <div className="text-xs font-bold text-white">
                            Seller • Hub • Rider Sync
                          </div>
                        </div>
                        <span className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-brand">
                          <i className="fa-solid fa-arrow-up-right-from-square" />
                        </span>
                      </div>
                    </div>
                  )}

                  {s.widgetType === "solutions-showcase" && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
                      <div className="inline-flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-2.5 text-slate-900 shadow-xl">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm text-white">
                          <i className="fa-solid fa-bolt" />
                        </span>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">Quick Response Hub</div>
                          <div className="text-[11px] font-medium text-slate-500">
                            Real-time delivery &amp; reschedule alerts
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-xs font-extrabold text-white shadow-xl">
                        <i className="fa-solid fa-circle-check text-white" />
                        <span>Instant Proof of Delivery</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Service Photo & Orange/White Icon Cards (inspired by top-right & middle-right of reference image) */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 lg:col-span-5">
                  {s.featureCards.map((card, idx) => (
                    <div
                      key={card.title}
                      className={`group relative overflow-hidden rounded-2xl border-2 border-white/85 bg-slate-900 shadow-xl transition-transform duration-300 ${
                        idx === 1 ? "sm:-translate-y-2" : ""
                      }`}
                    >
                      <img
                        src={card.image}
                        alt={card.title}
                        draggable={false}
                        className="h-28 w-full object-cover sm:h-40 lg:h-44"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

                      {/* Top-left Orange & White Logistics Icon Badge */}
                      <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl bg-brand text-xs text-white shadow-md ring-2 ring-white sm:left-2.5 sm:top-2.5 sm:h-8 sm:w-8 sm:text-sm">
                        <i className={`fa-solid ${card.icon}`} />
                      </span>

                      {/* Bottom Title + Circular Arrow Badge (matching inspiration cards) */}
                      <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-1 sm:inset-x-2.5 sm:bottom-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-extrabold leading-tight text-white sm:text-xs">
                            {card.title}
                          </div>
                          <div className="hidden truncate text-[10px] text-white/75 sm:block">
                            {card.subtitle}
                          </div>
                        </div>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/80 bg-brand text-[9px] text-white sm:h-6 sm:w-6 sm:text-[10px]">
                          <i className="fa-solid fa-arrow-right -rotate-45" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagonal-style Orange & White Logistics Ribbon Strip (inspired by BUYING • SHIPPING • TRACKING • DELIVERY banner) */}
              <div className="mx-auto mt-2 w-full max-w-7xl overflow-hidden rounded-xl bg-brand/95 px-4 py-2 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-around gap-x-4 gap-y-1 text-[10px] font-extrabold tracking-[0.18em] sm:text-xs">
                  {s.ribbon.map((item, idx) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      {idx > 0 && <i className="fa-solid fa-circle text-[5px] text-white" />}
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Indicators + CTA (bottom center, kept as is) */}
      <footer className="relative z-20 flex flex-col items-center gap-5 px-6 pb-8 pt-3 sm:pb-10">
        <div className="flex items-center gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-7 bg-brand" : "w-2 bg-white/40"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={start}
          className="w-full max-w-[340px] rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-md shadow-orange-500/25 transition hover:bg-brand-dark active:scale-[0.98]"
        >
          Let&apos;s Get Started
        </button>
      </footer>
    </div>
  );
}
