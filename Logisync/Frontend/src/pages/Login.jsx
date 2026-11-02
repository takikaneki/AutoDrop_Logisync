import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession, homePathForRole } from "../api.js";
import TermsModal from "../components/TermsModal.jsx";
import WelcomeIntro from "../components/auth/WelcomeIntro.jsx";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";
import { COPYRIGHT_OWNER, clearTermsRecord, getTermsRecord, saveTermsRecord } from "../data/terms.js";

// Real SPX Express photographs for the Sign-In background.
const BACKGROUNDS = [
  "/images/spx-trucks-fleet.jpg",
  "/images/spx-warehouse-hub.jpg",
  "/images/spx-truck-road.jpg",
  "/images/spx-fleet-yard.jpg",
  "/images/spx-riders-moto.jpg",
  "/images/spx-rider-delivery.jpg",
  "/images/spx-fleet-lineup.jpg",
  ,
];

// Full-screen expanded photo background with a subtle blur so the enlarged sign-in card stands out cleanly.
function PhotoBackground() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % BACKGROUNDS.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-slate-900" aria-hidden="true">
      {BACKGROUNDS.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full scale-[1.02] object-cover object-center blur-[3px] transition-opacity duration-[1400ms] ease-in-out ${i === active ? "opacity-100" : "opacity-0"
            }`}
        />
      ))}
      {/* Balanced dark overlay so the centered white sign-in form remains crisp and readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/45 to-slate-950/65" />
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
    "flex items-center gap-3 border border-slate-200 rounded-xl px-4 h-12 bg-white transition duration-150 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 hover:border-slate-300";

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <PhotoBackground />

      {/* Horizontally Extended White Sign-In Form, Centered */}
      <main className="relative z-10 my-auto w-full max-w-[540px] animate-popup sm:max-w-[600px]">
        <div className="rounded-3xl bg-white px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-11 sm:py-8">
          {/* Top-left subtle back link to public website */}
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-brand"
            >
              <i className="fa-solid fa-arrow-left text-[10px]" />
              <span>Back to Home</span>
            </button>
          </div>

          {/* Logo + title (restored to original size) */}
          <div className="mb-5 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-xl text-white">
              <i className="fa-solid fa-box" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">LogiSync</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
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
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600 transition-colors hover:text-slate-800">
                  <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand" />
                  <span className="font-medium">Remember me</span>
                </label>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="font-bold text-brand transition-colors hover:text-brand-dark"
                >
                  Forgot password?
                </a>
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

          {/* Coordinator notice + Restored SPX Express Branding + Footer */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-3 flex items-start gap-2 text-xs leading-snug text-slate-500">
              <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-sm text-brand" />
              <span>Seller and Rider accounts are created by the Coordinator. Ask them for access.</span>
            </p>

            {/* Restored "Developed for: SPX Express" branding below the sign-in form */}
            <div className="mb-3 flex items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-2">
              <span className="text-xs font-semibold tracking-wide text-slate-500">
                Developed for:
              </span>
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="h-7 w-auto rounded-md object-contain shadow-sm"
              />
            </div>

            <footer className="text-center text-[11px] font-medium text-slate-400">
              © 2026 {COPYRIGHT_OWNER}. All rights reserved.
            </footer>
          </div>
        </div>
      </main>

      {/* Terms modal */}
      <TermsModal open={termsOpen} alreadyAccepted={agreed} onAgree={confirmAgree} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
