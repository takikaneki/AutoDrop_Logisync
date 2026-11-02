import { useEffect, useState } from "react";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

// LogiSync Public-Facing Website & Welcome Experience
// Combines design inspiration from:
// 1. Airship Express — Initial truck/progress loading animation, top utility + nav bar, centered hero with inline pill & 4-step tracker
// 2. Haulx PH — Editorial split image presentation, curved orange route-line motif, natural photo proportions
// 3. AP Cargo — Bold orange showcase banner, service/feature organization, and real SPX Express photo cards

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About Us", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#verification" },
  { label: "Contact Us", href: "#contact" },
];

const HERO_STEPS = [
  { icon: "fa-box-open", label: "Parcel Registered", sub: "Seller books & uploads video", active: false },
  { icon: "fa-shield-halved", label: "Hub Verified", sub: "Coordinator checks condition", active: false },
  { icon: "fa-qrcode", label: "In Transit (QR)", sub: "Rider scans & dispatches", active: false },
  { icon: "fa-circle-check", label: "Delivered", sub: "Verified proof of handoff", active: true },
];

const SERVICES_CARDS = [
  {
    title: "Fleet & Road Dispatch",
    category: "DELIVERY OPERATIONS",
    description:
      "Dedicated SPX Express road transport connecting regional sorting hubs to local delivery zones with full route visibility.",
    image: "/images/spx-trucks-fleet.jpg",
    icon: "fa-truck-fast",
  },
  {
    title: "Hub Parcel Verification",
    category: "QUALITY ASSURANCE",
    description:
      "Every package is logged, weighed, and verified through photo and video inspection before leaving the warehouse bay.",
    image: "/images/spx-warehouse-hub.jpg",
    icon: "fa-warehouse",
  },
  {
    title: "Last-Mile Rider Sync",
    category: "DOORSTEP HANDOFF",
    description:
      "Riders scan parcel QR codes for instant manifest assignment, smart 3-day rescheduling, and photo proof of delivery.",
    image: "/images/spx-rider-delivery.jpg",
    icon: "fa-motorcycle",
  },
];

const FEATURES_LIST = [
  {
    icon: "fa-video",
    title: "Photo & Video Parcel Verification",
    description:
      "Sellers attach clear packaging photos and inspection videos upon booking so coordinators can verify parcel integrity before dispatch.",
  },
  {
    icon: "fa-qrcode",
    title: "Instant QR Code Scanning",
    description:
      "Each transaction generates a unique printable QR waybill. Riders scan the code to claim deliveries and update status in real time.",
  },
  {
    icon: "fa-calendar-check",
    title: "3-Day Reschedule & Return-to-Hub Guard",
    description:
      "Undelivered parcels automatically reschedule up to 3 days and transition to Return to Hub once the policy limit is reached.",
  },
  {
    icon: "fa-user-check",
    title: "Automatic Customer Info Filling",
    description:
      "Returning customer names automatically populate saved delivery addresses and contact numbers to speed up seller booking.",
  },
  {
    icon: "fa-chart-pie",
    title: "Integrated Parcel Records & Reports",
    description:
      "Generate comprehensive delivery, verification, and rider performance reports directly inside the Parcel Records view.",
  },
  {
    icon: "fa-bell",
    title: "Role-Based Real-Time Alerts",
    description:
      "Sellers, Hub Coordinators, and Riders receive instant notifications for reschedules, failed attempts, and hub returns.",
  },
];

const VERIFICATION_STEPS = [
  {
    step: "01",
    role: "Seller Dashboard",
    title: "Register Parcel & Upload Media",
    description:
      "The seller enters receiver details (with auto-fill for repeat customers), uploads pre-shipment verification photos/videos, and prints the QR waybill.",
    image: "/images/spx-parcel-sorting.jpg",
    badge: "Booking & QR Generation",
  },
  {
    step: "02",
    role: "Coordinator Hub",
    title: "Inspect & Approve at the Hub",
    description:
      "Hub coordinators review the seller's uploaded evidence alongside the physical parcel at the SPX Express hub before clearing it for dispatch.",
    image: "/images/spx-fleet-lineup.jpg",
    badge: "Hub Quality Control",
  },
  {
    step: "03",
    role: "Rider Mobile View",
    title: "Scan QR & Coordinate Delivery",
    description:
      "Riders scan the QR code to load the parcel onto their delivery list, navigate to the recipient, and upload proof of delivery or log reschedule reasons.",
    image: "/images/spx-riders-moto.jpg",
    badge: "Last-Mile Execution",
  },
];

// Airship Express–inspired Loading Screen (0% -> 100%, animated delivery truck on dashed line, "READY FOR DELIVERY")
function AirshipLoader({ progress, exiting }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-white px-6 py-10 text-slate-900 transition-all duration-500 ${
        exiting ? "pointer-events-none scale-[1.02] opacity-0" : "scale-100 opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading LogiSync"
    >
      {/* Top Center Brand Logo */}
      <div className="flex flex-col items-center gap-1.5 pt-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg text-white shadow-md shadow-orange-500/25">
            <i className="fa-solid fa-box" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">LogiSync</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
          Express Verification Hub
        </span>
      </div>

      {/* Center Truck + Dashed Road + Percentage + Orange Progress Bar */}
      <div className="w-full max-w-[420px] text-center">
        {/* Animated Delivery Truck inspired by Airship Express */}
        <div className="relative mb-2 h-20 w-full overflow-hidden">
          <div
            className="absolute bottom-1 transition-all duration-75 ease-out"
            style={{
              left: `calc(${Math.min(Math.max(progress, 8), 92)}% - 64px)`,
            }}
          >
            {/* Clean Geometric Truck SVG (Dark Charcoal body + LogiSync Orange roof bar) */}
            <svg width="128" height="60" viewBox="0 0 128 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Cargo Box */}
              <rect x="6" y="8" width="74" height="36" rx="3" fill="#18181B" />
              {/* Orange Top Accent Strip */}
              <rect x="6" y="8" width="74" height="7" rx="2" fill="#F97316" />
              {/* Cabin */}
              <path d="M82 18H105L120 31V44H82V18Z" fill="#18181B" />
              {/* Windshield */}
              <path d="M87 22H103L113 31H87V22Z" fill="#3F3F46" />
              {/* Rear Wheel */}
              <circle cx="30" cy="45" r="10" fill="#FFFFFF" stroke="#18181B" strokeWidth="3" />
              <path d="M25 40L35 50M35 40L25 50" stroke="#18181B" strokeWidth="2" />
              {/* Front Wheel */}
              <circle cx="100" cy="45" r="10" fill="#FFFFFF" stroke="#18181B" strokeWidth="3" />
              <path d="M95 40L105 50M105 40L95 50" stroke="#18181B" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Dashed Road Line */}
        <div className="w-full border-b-[3px] border-dashed border-slate-800" />

        {/* Big Percentage Counter */}
        <div className="mt-6 text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
          {progress}%
        </div>

        {/* Smooth Orange Progress Line */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Spaced Subtitle */}
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
          Ready for Delivery
        </p>
      </div>

      {/* Bottom Client Attribution */}
      <div className="flex items-center gap-2 pb-2 opacity-80">
        <span className="text-[11px] font-semibold text-slate-400">Developed for:</span>
        <img src={SPX_LOGO_DATA_URL} alt="SPX Express" className="h-5 w-auto rounded object-contain" />
      </div>
    </div>
  );
}

export default function WelcomeIntro({ onComplete }) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loaderDone, setLoaderDone] = useState(false);
  const [leavingToSignIn, setLeavingToSignIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoTracking, setDemoTracking] = useState("TXN-2026-SPX-00184");
  const [demoTracked, setDemoTracked] = useState(false);

  // Short, smooth Airship Express loading animation (~1.05s total)
  useEffect(() => {
    let frame;
    const duration = 950; // ms
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setLoadingProgress(pct);
      if (pct < 100) {
        frame = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setLoaderDone(true), 220);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleGoToSignIn = () => {
    if (leavingToSignIn) return;
    setLeavingToSignIn(true);
    setTimeout(() => onComplete?.(), 380);
  };

  const scrollToSection = (e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className={`min-h-[100dvh] w-full bg-white text-slate-900 transition-opacity duration-400 ${
        leavingToSignIn ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* 1. INITIAL LOADING ANIMATION (Inspired by Airship Express) */}
      {!loaderDone && <AirshipLoader progress={loadingProgress} exiting={loadingProgress >= 100} />}

      {/* 2. TOP UTILITY BAR + STICKY NAVIGATION BAR (Inspired by Airship Express & AP Cargo) */}
      <div className="bg-slate-950 px-4 py-2 text-[11px] font-medium text-slate-300 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span className="inline-flex items-center gap-1.5">
              <i className="fa-solid fa-phone text-[10px] text-brand" />
              <span>(02) 8123-4567</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="fa-regular fa-envelope text-[10px] text-brand" />
              <span>support@logisync.ph</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span>Hub Active • SPX Express Logistics Partner</span>
            </span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8">
          {/* Brand Logo */}
          <a
            href="#home"
            onClick={(e) => scrollToSection(e, "#home")}
            className="flex items-center gap-2.5 focus:outline-none"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg text-white shadow-sm shadow-orange-500/25">
              <i className="fa-solid fa-box" />
            </span>
            <div className="leading-none">
              <span className="block text-xl font-extrabold tracking-tight text-slate-900">LogiSync</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
                Verify &amp; Deliver
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-brand"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right CTA Buttons */}
          <div className="hidden items-center gap-3 sm:flex">
            <a
              href="#services"
              onClick={(e) => scrollToSection(e, "#services")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-brand hover:text-brand"
            >
              <i className="fa-solid fa-magnifying-glass text-[11px] text-brand" />
              <span>Verify Waybill</span>
            </a>
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand active:scale-[0.98]"
            >
              <span>Let&apos;s Get Started</span>
              <i className="fa-solid fa-arrow-right text-[10px]" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white sm:hidden"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-base`} />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-lg lg:hidden">
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={handleGoToSignIn}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20"
              >
                <span>Let&apos;s Get Started</span>
                <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* 3. HERO / WELCOME SECTION (Inspired by Airship Express) */}
      <section id="home" className="relative overflow-hidden bg-white pt-10 pb-16 sm:pt-16 sm:pb-24">
        {/* Soft warm ambient glows in corners */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-orange-400/10 blur-3xl"
          aria-hidden="true"
        />

        {/* Floating Decorative UI Card - Left (Airship Express style) */}
        <div
          className="pointer-events-none absolute top-14 left-6 hidden w-52 -rotate-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] xl:block"
          aria-hidden="true"
        >
          <div className="mb-3 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mb-2 h-2.5 w-28 rounded-full bg-slate-100" />
          <div className="mb-3.5 h-2 w-20 rounded-full bg-slate-100" />
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white shadow-sm">
              <i className="fa-solid fa-video text-[9px]" />
              Picked Up &amp; Verified
            </span>
            <i className="fa-solid fa-location-arrow rotate-90 text-xs text-brand" />
          </div>
        </div>

        {/* Floating Decorative UI Card - Bottom Right (Airship Express style) */}
        <div
          className="pointer-events-none absolute right-8 bottom-12 hidden w-56 rotate-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] xl:block"
          aria-hidden="true"
        >
          <div className="mb-2.5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mb-3 flex items-center justify-between rounded-xl bg-orange-50 px-3 py-2">
            <span className="text-xs font-bold text-brand">QR Sync Active</span>
            <span className="flex h-5 w-9 items-center justify-end rounded-full bg-brand p-0.5">
              <span className="h-4 w-4 rounded-full bg-white" />
            </span>
          </div>
          <div className="h-2 w-32 rounded-full bg-slate-100" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-8">
          {/* Top Pill Tag */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span>For online sellers, hub coordinators &amp; SPX Express riders</span>
          </div>

          {/* Main Airship Express–Style Headline with Inline Pill */}
          <h1 className="mt-6 text-4xl font-black leading-[1.12] tracking-tight text-slate-900 sm:text-6xl">
            <span>We Verify &amp; Deliver </span>
            <span className="mx-1.5 inline-flex -translate-y-1 items-center gap-2 rounded-full bg-brand px-5 py-2 text-2xl font-extrabold text-white shadow-lg shadow-orange-500/25 sm:px-7 sm:py-2.5 sm:text-4xl">
              <i className="fa-regular fa-clock text-xl sm:text-3xl" />
              <span>On-Time</span>
            </span>
            <span className="mt-1 block">Every Single Parcel</span>
          </h1>

          {/* Supporting Description */}
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            LogiSync gets your parcels where they need to go quickly and securely—combining pre-dispatch video
            verification, QR code scanning, and real-time rider coordination every step of the way.
          </p>

          {/* Hero CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="inline-flex items-center gap-2.5 rounded-full bg-brand px-8 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 transition hover:bg-brand-dark active:scale-[0.98] sm:text-base"
            >
              <span>Let&apos;s Get Started</span>
              <i className="fa-solid fa-arrow-right text-xs" />
            </button>
            <a
              href="#verification"
              onClick={(e) => scrollToSection(e, "#verification")}
              className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand hover:text-brand sm:text-base"
            >
              <i className="fa-solid fa-location-dot text-brand" />
              <span>How LogiSync Works</span>
            </a>
          </div>

          {/* 4-Step Horizontal Connected Tracker Card (Airship Express style) */}
          <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-slate-100 bg-white px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:px-10">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
              {HERO_STEPS.map((s, idx) => (
                <div key={s.label} className="relative flex flex-col items-center text-center">
                  {/* Connector line on desktop */}
                  {idx < HERO_STEPS.length - 1 && (
                    <div
                      className="pointer-events-none absolute top-6 left-[62%] hidden h-[2px] w-[76%] bg-slate-200 sm:block"
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-base shadow-md transition ${
                      s.active
                        ? "bg-brand text-white ring-4 ring-orange-100"
                        : "bg-slate-900 text-white"
                    }`}
                  >
                    <i className={`fa-solid ${s.icon}`} />
                  </div>
                  <span className="mt-3 text-xs font-extrabold text-slate-900 sm:text-sm">{s.label}</span>
                  <span className="mt-0.5 text-[11px] text-slate-400">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. IMAGE PRESENTATION & ABOUT SECTION (Inspired by Haulx PH) */}
      <section id="about" className="relative overflow-hidden bg-[#f8fafc] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {/* Row 1: Haulx PH Asymmetric Split — Large Rounded Portrait/Landscape SPX Photo on Left + Route Line Typography on Right */}
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
            {/* Left: Large Proportioned SPX Express Photo */}
            <div className="lg:col-span-6">
              <div className="relative overflow-hidden rounded-[28px] bg-slate-900 shadow-2xl">
                <img
                  src="/images/spx-truck-road.jpg"
                  alt="SPX Express delivery truck on the road"
                  className="aspect-[4/3] w-full object-cover object-center transition duration-500 hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
                  <div>
                    <span className="inline-block rounded-full bg-brand px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                      SPX Express Fleet
                    </span>
                    <p className="mt-1.5 text-lg font-extrabold">Verified Hub-to-Door Logistics</p>
                  </div>
                  <img
                    src={SPX_LOGO_DATA_URL}
                    alt="SPX Express"
                    className="h-8 w-auto rounded-lg shadow-md"
                  />
                </div>
              </div>
            </div>

            {/* Right: Haulx PH "MOVING YOU FORWARD" Route Line Motif + About Copy */}
            <div className="lg:col-span-6">
              {/* Top line + Title */}
              <div className="mb-3 flex items-center gap-3">
                <span className="h-1 w-12 rounded-full bg-brand" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Who We Are • About LogiSync
                </span>
              </div>

              <div className="relative pl-5 border-l-4 border-brand">
                <h2 className="text-3xl font-black uppercase leading-tight tracking-tight text-slate-900 sm:text-5xl">
                  Moving Parcels{" "}
                  <span className="block text-brand">Forward With Trust</span>
                </h2>
              </div>

              <p className="mt-6 text-base leading-relaxed text-slate-600">
                LogiSync is a dedicated parcel verification and delivery coordination platform developed for{" "}
                <strong className="font-bold text-slate-900">SPX Express</strong> operations. We bridge the gap
                between online sellers, warehouse coordinators, and delivery riders to eliminate unverified
                shipments and misrouted packages.
              </p>

              <p className="mt-4 text-base leading-relaxed text-slate-600">
                By combining mandatory photo and video verification at booking with QR-based dispatch and a strict
                three-day rescheduling policy, LogiSync ensures accountability at every handoff—from the seller&apos;s
                packing table to the customer&apos;s doorstep.
              </p>

              {/* Haulx-style Curved Route Graphic + Key Metrics */}
              <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div>
                  <div className="text-2xl font-black text-brand sm:text-3xl">100%</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">QR &amp; Video Verified</div>
                </div>
                <div className="border-x border-slate-100 px-4">
                  <div className="text-2xl font-black text-slate-900 sm:text-3xl">3-Day</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">Smart Reschedule Limit</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-brand sm:text-3xl">3 Roles</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">Seller • Hub • Rider</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Haulx PH Second Editorial Block ("A GUIDING BEACON / A BRIGHTER WAY FORWARD" layout) */}
          <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:mt-24 lg:grid-cols-12 lg:gap-14">
            <div className="order-2 lg:order-1 lg:col-span-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-6 rounded-sm bg-brand" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                  Why Choose LogiSync
                </span>
              </div>
              <h3 className="text-2xl font-black uppercase leading-tight tracking-tight text-brand sm:text-4xl">
                A Guiding Beacon
                <span className="block text-slate-900">A Smarter Way to Deliver</span>
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Traditional parcel handoffs suffer from missing waybills, disputed package damage, and untracked
                delivery attempts. LogiSync replaces manual guesswork with a unified digital chain of custody.
              </p>

              <ul className="mt-6 space-y-3 text-sm font-medium text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                    <i className="fa-solid fa-check" />
                  </span>
                  <span>
                    <strong className="font-bold text-slate-900">Pre-Dispatch Evidence:</strong> High-resolution
                    packaging photos and video inspection protect both sellers and riders.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                    <i className="fa-solid fa-check" />
                  </span>
                  <span>
                    <strong className="font-bold text-slate-900">Automated Return-to-Hub Protection:</strong> Parcels
                    undelivered after 3 rescheduled days automatically route back to the hub and alert the coordinator.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                    <i className="fa-solid fa-check" />
                  </span>
                  <span>
                    <strong className="font-bold text-slate-900">One-Click Parcel Reports:</strong> Export and review
                    complete parcel records and delivery analytics in one place.
                  </span>
                </li>
              </ul>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-[24px] shadow-lg">
                  <img
                    src="/images/spx-fleet-yard.jpg"
                    alt="SPX Express hub team and truck fleet"
                    className="h-56 w-full object-cover sm:h-64"
                  />
                </div>
                <div className="overflow-hidden rounded-[24px] shadow-lg sm:translate-y-6">
                  <img
                    src="/images/spx-riders-moto.jpg"
                    alt="SPX Express motorcycle riders coordinating deliveries"
                    className="h-56 w-full object-cover sm:h-64"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BOLD ORANGE SHOWCASE & SERVICES SECTION (Inspired by AP Cargo) */}
      <section
        id="services"
        className="relative overflow-hidden bg-gradient-to-b from-[#ff7a00] to-[#f96302] pt-16 pb-20 text-white sm:pt-20 sm:pb-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-8">
          <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Delivering all kinds
            <span className="block">of logistics possibilities</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-900/80 sm:text-base">
            We provide an end-to-end suite of verification, QR tracking, and delivery coordination tools tailored for
            SPX Express operations.
          </p>

          {/* 3 AP Cargo–Style Checkmark Highlights */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-950 sm:gap-8 sm:text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] text-white">
                <i className="fa-solid fa-check" />
              </span>
              Hassle-free seller booking
            </span>
            <span className="hidden h-4 w-px bg-slate-950/20 sm:inline-block" />
            <span className="inline-flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] text-white">
                <i className="fa-solid fa-check" />
              </span>
              Video &amp; QR verification
            </span>
            <span className="hidden h-4 w-px bg-slate-950/20 sm:inline-block" />
            <span className="inline-flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] text-white">
                <i className="fa-solid fa-check" />
              </span>
              Real-time rider coordination
            </span>
          </div>

          {/* AP Cargo–Style Waybill Verification Preview Box */}
          <div className="mx-auto mt-8 max-w-2xl rounded-3xl bg-white p-4 text-left text-slate-900 shadow-2xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <i className="fa-solid fa-barcode text-lg text-brand" />
                <input
                  type="text"
                  value={demoTracking}
                  onChange={(e) => {
                    setDemoTracking(e.target.value);
                    setDemoTracked(false);
                  }}
                  placeholder="Enter LogiSync waybill or transaction number..."
                  aria-label="Waybill number preview"
                  className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setDemoTracked(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#ff8800] px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-md transition hover:bg-[#ff7300]"
              >
                <span>Track Shipment</span>
                <i className="fa-solid fa-box-open" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-brand" />
                <span>The transaction number &amp; QR code are printed on the upper-right of your LogiSync Waybill.</span>
              </span>
              {demoTracked && (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                  <i className="fa-solid fa-circle-check" />
                  <span>Verified at SPX Hub • Ready for Rider Dispatch (Sign in for full record)</span>
                </span>
              )}
            </div>
          </div>

          {/* 3 Large SPX Express Service Photo Cards (AP Cargo bottom showcase style) */}
          <div className="mt-12 grid grid-cols-1 gap-6 text-left md:grid-cols-3">
            {SERVICES_CARDS.map((card) => (
              <div
                key={card.title}
                className="group overflow-hidden rounded-3xl bg-white text-slate-900 shadow-xl transition duration-300 hover:-translate-y-1"
              >
                <div className="relative h-56 w-full overflow-hidden bg-slate-900">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                    <i className={`fa-solid ${card.icon} text-brand`} />
                    {card.category}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-extrabold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. PARCEL VERIFICATION & DELIVERY COORDINATION WORKFLOW (How LogiSync Works) */}
      <section id="verification" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="text-center">
            <span className="inline-block rounded-full bg-orange-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-brand">
              End-to-End Workflow
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              How Parcel Verification &amp; Coordination Works
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500 sm:text-base">
              Three connected dashboards keep every SPX Express parcel verified, scanned, and monitored from booking to
              final doorstep proof.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {VERIFICATION_STEPS.map((item) => (
              <div
                key={item.step}
                className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-[#f8fafc] shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-52 w-full overflow-hidden bg-slate-900">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                  <span className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-sm font-black text-white shadow-md">
                    {item.step}
                  </span>
                  <span className="absolute bottom-3 left-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold text-slate-900">
                    {item.badge}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-brand">{item.role}</div>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-900">{item.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PLATFORM FEATURES GRID (Inspired by AP Cargo) */}
      <section id="features" className="bg-[#f8fafc] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-brand">
                Core Capabilities
              </span>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Built for Modern Parcel Operations
              </h2>
            </div>
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:bg-brand-dark"
            >
              <span>Access Platform</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES_LIST.map((feat) => (
              <div
                key={feat.title}
                className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:border-brand/40 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-xl text-brand">
                  <i className={`fa-solid ${feat.icon}`} />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{feat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. CONTACT US & FOOTER SECTION */}
      <footer id="contact" className="bg-slate-950 text-white">
        {/* Top CTA Banner inside Footer */}
        <div className="border-b border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-12 text-center sm:px-8 lg:flex-row lg:text-left">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Ready to manage your parcels with LogiSync?
              </h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Sign in with your Seller, Coordinator, or Rider account to start verifying and delivering.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoToSignIn}
              className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-brand px-8 py-4 text-base font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:bg-brand-dark active:scale-[0.98]"
            >
              <span>Let&apos;s Get Started</span>
              <i className="fa-solid fa-arrow-right text-sm" />
            </button>
          </div>
        </div>

        {/* Contact Information & Links */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            {/* Col 1: Brand + SPX Client Badge */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg text-white">
                  <i className="fa-solid fa-box" />
                </span>
                <span className="text-xl font-extrabold tracking-tight text-white">LogiSync</span>
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                Parcel Verification and Delivery Coordination System designed to streamline pre-dispatch quality
                checks, QR waybill scanning, and last-mile delivery tracking.
              </p>
              <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-300">Developed for:</span>
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  className="h-7 w-auto rounded object-contain"
                />
              </div>
            </div>

            {/* Col 2: Quick Navigation */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand">Quick Links</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.href)}
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Contact Details */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand">Contact Us</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-location-dot mt-1 text-brand" />
                  <span>SPX Express Central Sorting &amp; Coordination Hub, Metro Manila, PH</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <i className="fa-solid fa-phone text-brand" />
                  <span>(02) 8123-4567</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <i className="fa-regular fa-envelope text-brand" />
                  <span>support@logisync.ph</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
            © 2026 AutoDrop LogiSync. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
