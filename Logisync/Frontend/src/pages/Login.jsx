import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession, homePathForRole } from "../api.js";
import TermsModal from "../components/TermsModal.jsx";
import { COPYRIGHT_OWNER, clearTermsRecord, getTermsRecord, saveTermsRecord } from "../data/terms.js";

export default function Login() {
  const navigate = useNavigate();
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

  const inputWrap =
    "flex items-center gap-2.5 border border-[#d7dee8] rounded-xl px-3.5 h-11 sm:h-12 bg-white transition duration-150 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 hover:border-[#b8c6d8]";

  return (
    <div className="h-[100dvh] w-full flex flex-col lg:flex-row bg-[#f8fafc] overflow-hidden">
      {/* BRANDING SECTION (Compact & Aesthetic on Mobile, Full Hero on Desktop) */}
      <section className="relative w-full lg:w-[46%] xl:w-[42%] flex flex-col justify-between overflow-hidden text-white bg-gradient-to-br from-[#ff7000] via-[#ff6500] to-[#ec5500] py-3.5 sm:py-5 px-4 lg:p-14 xl:p-16 shrink-0 rounded-b-2xl lg:rounded-none shadow-md lg:shadow-none">
        {/* Subtle background ambient rings */}
        <div className="pointer-events-none absolute -right-16 -bottom-16 lg:-right-48 lg:-bottom-48 w-44 h-44 lg:w-[540px] lg:h-[540px] rounded-full border-[22px] lg:border-[70px] border-white/[0.08]" />
        <div className="pointer-events-none absolute -left-10 -top-10 w-32 h-32 lg:w-64 lg:h-64 rounded-full bg-white/[0.05] blur-xl" />

        {/* --- MOBILE COMPACT & AESTHETIC HEADER --- */}
        <div className="relative z-10 flex items-center justify-between w-full lg:hidden">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg border border-white/80 bg-white/15 backdrop-blur-sm flex items-center justify-center text-base text-white shadow-sm">
              <i className="fa-solid fa-box" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">LogiSync</h1>
          </div>

          {/* Right: Tagline */}
          <p className="text-[11px] sm:text-xs text-white/90 font-medium tracking-wide text-right">
            Track, Verify, Deliver
          </p>
        </div>

        {/* --- DESKTOP VIEW: Left Column Full Hero --- */}
        <div className="relative z-10 hidden lg:flex items-center gap-4">
          <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-2xl border-[3px] border-white/90 bg-white/10 backdrop-blur-sm flex items-center justify-center text-3xl xl:text-4xl shadow-inner">
            <i className="fa-solid fa-box" />
          </div>
          <div>
            <h1 className="text-3xl xl:text-[34px] font-bold tracking-tight leading-tight">LogiSync</h1>
            <p className="text-sm xl:text-base text-white/90 font-medium">Track. Verify. Deliver.</p>
          </div>
        </div>

        {/* Desktop 3D Box Illustration */}
        <div className="relative z-10 hidden lg:flex flex-1 min-h-[280px] xl:min-h-[340px] items-center justify-center my-8">
          <div className="w-[130px] h-[130px] xl:w-[150px] xl:h-[150px] flex items-center justify-center text-5xl xl:text-[55px] rounded-2xl bg-[#ffac47] border-[3px] border-[#f9d092] text-[#cf6500] shadow-[0_15px_25px_rgba(150,55,0,.2)] -translate-x-6 translate-y-6">
            <i className="fa-solid fa-box" />
          </div>
          <div className="w-[110px] h-[110px] xl:w-[125px] xl:h-[125px] flex items-center justify-center text-5xl xl:text-[55px] rounded-2xl bg-[#ffac47] border-[3px] border-[#f9d092] text-[#cf6500] shadow-[0_15px_25px_rgba(150,55,0,.2)] -translate-x-2 translate-y-24">
            <i className="fa-solid fa-box" />
          </div>
          <div className="w-[115px] h-[200px] xl:w-[130px] xl:h-[230px] flex items-center justify-center text-5xl xl:text-[65px] rounded-[24px] border-[6px] xl:border-[7px] border-[#ffd49c] bg-[#fff0d9] text-[#e86a00] rotate-[8deg] shadow-[0_15px_25px_rgba(150,55,0,.15)]">
            <i className="fa-solid fa-location-dot" />
          </div>
        </div>

        {/* Desktop Bottom Headline */}
        <div className="relative z-10 hidden lg:block">
          <h2 className="text-3xl xl:text-[40px] font-bold leading-tight mb-2.5">
            Your Packages,
            <br />
            Our Priority
          </h2>
          <p className="text-base xl:text-lg text-white/90">Safe. Secure. On Time.</p>
        </div>
      </section>

      {/* RIGHT FORM SECTION (Compact, Centered & Non-scrollable on Mobile) */}
      <section className="flex-1 flex flex-col justify-between bg-white px-5 py-3 sm:px-8 sm:py-6 lg:p-14 xl:p-16 overflow-y-auto lg:overflow-visible">
        <div className="flex flex-1 items-center justify-center w-full my-auto">
          <div className="w-full max-w-[360px] sm:max-w-[420px] mx-auto">
            {/* Left-aligned Sign In Header */}
            <div className="mb-3.5 sm:mb-5 text-left">
              <h2 className="text-2xl sm:text-[26px] font-bold text-[#1e293b] tracking-tight">
                Sign In
              </h2>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Email field */}
              <div className="mb-2.5 sm:mb-3.5">
                <label htmlFor="email" className="block mb-1 font-semibold text-xs text-[#475569]">
                  Email Address
                </label>
                <div className={inputWrap}>
                  <i className="fa-regular fa-envelope text-[#72839b] text-base shrink-0" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="flex-1 min-w-0 outline-none text-base text-[#1e293b] bg-transparent placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="mb-2.5 sm:mb-3.5">
                <label htmlFor="password" className="block mb-1 font-semibold text-xs text-[#475569]">
                  Password
                </label>
                <div className={inputWrap}>
                  <i className="fa-solid fa-lock text-[#72839b] text-base shrink-0" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="flex-1 min-w-0 outline-none text-base text-[#1e293b] bg-transparent placeholder:text-[#94a3b8]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 text-[#72839b] hover:text-[#1e293b] text-base transition-colors focus:outline-none"
                  >
                    <i className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>

                {/* Remember me & Forgot password */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 mt-1.5 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#64748b] hover:text-[#334155] transition-colors">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-brand cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="font-semibold text-brand hover:text-brand-dark transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div role="alert" className="mb-2.5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600 animate-popup">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-sm" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Terms of Service agreement checkbox */}
              <label className="mb-3 flex cursor-pointer items-start gap-2 text-xs leading-tight text-[#64748b] select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={toggleAgree}
                  aria-describedby="terms-hint"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand cursor-pointer"
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
                    className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark transition-colors"
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
                className="w-full rounded-xl py-2.5 sm:py-3 px-5 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-[#ff7900] to-[#ec5500] hover:from-[#f06e00] hover:to-[#dc4c00] active:scale-[0.99] transition duration-150 shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </div>
        </div>

        {/* Bottom area: Coordinator notice + Footer */}
        <div className="w-full max-w-[360px] sm:max-w-[420px] mx-auto pt-2 pb-1 shrink-0">
          <div className="mb-2 rounded-lg bg-slate-50 border border-slate-200/80 p-2 text-[11px] sm:text-xs text-[#64748b] leading-tight flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-brand mt-0.5 shrink-0 text-xs sm:text-sm" />
            <span>
              Seller and Rider accounts are created by the Coordinator. Ask them for access.
            </span>
          </div>

          <footer className="text-center text-[10px] sm:text-xs text-[#94a3b8]">
            © 2026 {COPYRIGHT_OWNER}. All rights reserved.
          </footer>
        </div>
      </section>

      {/* Terms modal */}
      <TermsModal open={termsOpen} alreadyAccepted={agreed} onAgree={confirmAgree} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
