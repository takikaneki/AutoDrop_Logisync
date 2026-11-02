import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession, homePathForRole } from "../api.js";
import TermsModal from "../components/TermsModal.jsx";
import ContactUsModal from "../components/auth/ContactUsModal.jsx";
import WelcomeIntro from "../components/auth/WelcomeIntro.jsx";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";
import { COPYRIGHT_OWNER, clearTermsRecord, getTermsRecord, saveTermsRecord } from "../data/terms.js";

/**
 * Subtle graphic & icon background inspired by the LogiSync Welcome Page
 * (Airship Express floating status cards + Haulx PH curved route lines + soft orange ambient glows).
 * No background photographs are used.
 */
function LogisticsGraphicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#f8fafc]" aria-hidden="true">
      {/* Soft warm orange & slate ambient glows */}
      <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute -bottom-36 -right-32 h-[460px] w-[460px] rounded-full bg-orange-400/10 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-orange-100/60 via-white to-amber-50/50 blur-2xl" />

      {/* Subtle technical dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Haulx PH–inspired curved logistics route SVG lines */}
      <svg
        className="absolute inset-0 h-full w-full text-orange-500/15"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M-80 180 H320 C410 180 450 240 450 320 V580 C450 660 500 720 590 720 H1520"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10 10"
        />
        <path
          d="M-60 740 H280 C370 740 420 680 420 600 V300 C420 220 480 160 570 160 H1500"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="320" cy="180" r="6" className="fill-orange-400/40" />
        <circle cx="450" cy="450" r="8" className="fill-orange-500/35" />
        <circle cx="1120" cy="160" r="6" className="fill-orange-400/40" />
        <circle cx="1080" cy="720" r="7" className="fill-orange-500/35" />
      </svg>

      {/* Subtle watermark logistics icons in corners */}
      <div className="hidden xl:flex absolute left-[6%] top-[18%] flex-col gap-5">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <i className="fa-solid fa-clipboard-check text-base" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Hub Verification</p>
            <p className="text-xs font-extrabold text-slate-800">Picked Up & Verified</p>
          </div>
        </div>

        <div className="ml-6 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
            <i className="fa-solid fa-qrcode text-base" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Smart Dispatch</p>
            <p className="text-xs font-extrabold text-slate-800">QR Tracking Synced</p>
          </div>
        </div>
      </div>

      <div className="hidden xl:flex absolute bottom-[16%] left-[7%] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <i className="fa-solid fa-truck-fast text-base" />
        </span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Live Fleet</p>
          <p className="text-xs font-extrabold text-slate-800">Coordinator & Rider Sync</p>
        </div>
      </div>

      <div className="hidden xl:flex absolute right-[6%] top-[20%] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <i className="fa-solid fa-calendar-check text-base" />
        </span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Retry Protection</p>
          <p className="text-xs font-extrabold text-slate-800">3-Day Reschedule Guard</p>
        </div>
      </div>

      <div className="hidden xl:flex absolute bottom-[18%] right-[6%] flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
            <i className="fa-solid fa-shield-halved text-base" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Proof of Handoff</p>
            <p className="text-xs font-extrabold text-slate-800">Verified Parcel Records</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  // Welcome screen muna; lalabas lang ang Sign-In pagkatapos pindutin ang "Let's Get Started"
  const [showIntro, setShowIntro] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(() => !!getTermsRecord());
  const [termsOpen, setTermsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Ang checkbox ay hindi basta matitiktikan: dadaan muna sa Terms (kailangang i-scroll hanggang dulo)
  const toggleAgree = () => {
    if (agreed) {
      clearTermsRecord();
      setAgreed(false);
    } else {
      setTermsOpen(true);
    }
  };

  const confirmAgree = () => {
    saveTermsRecord();
    setAgreed(true);
    setTermsOpen(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please read and agree to the Terms of Service to continue.");
      return;
    }
    setLoading(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: { email: email.trim(), password } });

      // Ang role ay galing sa backend, hindi pinili ng user
      const home = homePathForRole(data.user.role);
      if (!home) {
        setError("Your account role is not supported.");
        return;
      }

      saveSession(data);
      navigate(home, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showIntro) {
    return <WelcomeIntro onComplete={() => setShowIntro(false)} />;
  }

  const inputWrap =
    "flex items-center gap-3 border border-slate-200 rounded-xl px-4 h-12 bg-slate-50/60 transition duration-150 focus-within:bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 hover:border-slate-300";

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col justify-between overflow-x-hidden">
      <LogisticsGraphicBackground />

      {/* Top Navigation Header matching the Welcome Page */}
      <header className="relative z-10 w-full border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="flex items-center gap-3 text-left group"
          >
            <img
              src={SPX_LOGO_DATA_URL}
              alt="SPX Express"
              draggable={false}
              className="h-8 w-auto shrink-0 object-contain transition-transform group-hover:scale-105 sm:h-9"
            />
            <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
            <div className="leading-none">
              <span className="block text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                LogiSync
              </span>
              <span className="hidden text-[9px] font-bold uppercase tracking-widest text-brand sm:block">
                Verify &amp; Deliver
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]"
            >
              <i className="fa-solid fa-headset text-[#f97316]" />
              <span>Contact Us</span>
            </button>
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <i className="fa-solid fa-arrow-left text-[10px]" />
              <span>Back to Website</span>
            </button>
          </div>
        </div>
      </header>

      {/* Centered Sign-In Form */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-[560px] flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full animate-popup overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          {/* Top orange brand accent strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#f97316] via-amber-500 to-[#ea580c]" />

          <div className="px-5 py-6 sm:px-10 sm:py-8">
            {/* Logo + title + role pills */}
            <div className="mb-6 text-center">
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="mx-auto mb-3 h-11 w-auto object-contain sm:h-12"
              />
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">LogiSync</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to manage and coordinate your parcels</p>

              {/* Subtle Logistics Role Indicators */}
              <div className="mt-3.5 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1 text-[#ea580c]">
                  <i className="fa-solid fa-building-shield text-[10px]" />
                  Coordinator
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-store text-[10px] text-slate-400" />
                  Seller
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-motorcycle text-[10px] text-slate-400" />
                  Rider
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Email field */}
              <div className="mb-4">
                <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Email Address
                </label>
                <div className={inputWrap}>
                  <i className="fa-regular fa-envelope shrink-0 text-base text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:text-[15px]"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="mb-4">
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <div className={inputWrap}>
                  <i className="fa-solid fa-lock shrink-0 text-base text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:text-[15px]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 text-base text-slate-400 transition-colors hover:text-slate-700 focus:outline-none"
                  >
                    <i className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>

                {/* Remember me & Forgot password */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600 transition-colors hover:text-slate-800">
                    <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand" />
                    <span className="font-medium">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="font-bold text-brand transition-colors hover:text-brand-dark"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  className="mb-4 flex animate-popup items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600"
                >
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-sm" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Terms of Service agreement checkbox */}
              <label className="mb-5 flex cursor-pointer select-none items-start gap-2.5 text-xs leading-snug text-slate-600">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={toggleAgree}
                  aria-describedby="terms-hint"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
                />
                <span id="terms-hint">
                  I have read and agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTermsOpen(true);
                    }}
                    className="font-bold text-brand underline underline-offset-2 transition-colors hover:text-brand-dark"
                  >
                    Terms of Service
                  </button>
                  .
                </span>
              </label>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !agreed}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-5 py-3.5 text-base font-extrabold text-white shadow-lg shadow-orange-500/25 transition duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-base" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <i className="fa-solid fa-arrow-right text-xs" />
                  </>
                )}
              </button>
            </form>

            {/* Coordinator notice + SPX Express Branding + Footer */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-3 flex items-start gap-2 text-xs leading-snug text-slate-500">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-sm text-brand" />
                <span>Seller and Rider accounts are created by the Coordinator. Ask them for access.</span>
              </p>

              {/* "Developed for: SPX Express" branding below the sign-in form */}
              <div className="mb-3 flex items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-2">
                <span className="text-xs font-semibold tracking-wide text-slate-500">
                  Developed for:
                </span>
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  draggable={false}
                  className="h-6 w-auto object-contain"
                />
              </div>

              <footer className="text-center text-[11px] font-medium text-slate-400">
                © 2026 {COPYRIGHT_OWNER}. All rights reserved.
              </footer>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <TermsModal open={termsOpen} alreadyAccepted={agreed} onAgree={confirmAgree} onClose={() => setTermsOpen(false)} />
      <ContactUsModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
