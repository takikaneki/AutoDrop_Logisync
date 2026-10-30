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
    "flex items-center gap-[13px] border border-[#d7dee8] rounded-xl px-[18px] min-h-[60px] transition focus-within:border-orange-500 focus-within:ring-[3px] focus-within:ring-orange-500/10";

  return (
    <div className="flex min-h-screen w-full bg-white max-[700px]:flex-col">
      {/* LEFT BRANDING */}
      <section className="relative flex-1 flex flex-col overflow-hidden text-white px-[75px] py-[70px] bg-gradient-to-br from-[#ff7000] to-[#ec5500] max-[1000px]:p-[45px] max-[700px]:min-h-[400px] max-[700px]:p-[35px]">
        <div className="pointer-events-none absolute -right-[350px] -bottom-[200px] w-[650px] h-[650px] rounded-full border-[90px] border-white/[0.06]" />

        <div className="relative z-10 flex items-center gap-[18px]">
          <div className="w-[65px] h-[65px] border-[3px] border-white flex items-center justify-center text-4xl">
            <i className="fa-solid fa-box" />
          </div>
          <div>
            <h1 className="text-[35px] font-bold mb-[5px]">LogiSync</h1>
            <p className="text-lg opacity-90">Track. Verify. Deliver.</p>
          </div>
        </div>

        <div className="relative z-10 flex-1 min-h-[320px] flex items-center justify-center max-[700px]:min-h-[180px]">
          <div className="w-[150px] h-[150px] flex items-center justify-center text-[55px] rounded-lg bg-[#ffac47] border-[3px] border-[#f9d092] text-[#cf6500] shadow-[0_15px_25px_rgba(150,55,0,.2)] translate-x-[-25px] translate-y-[25px] max-[700px]:w-[95px] max-[700px]:h-[95px] max-[700px]:text-[35px]">
            <i className="fa-solid fa-box" />
          </div>
          <div className="w-[125px] h-[125px] flex items-center justify-center text-[55px] rounded-lg bg-[#ffac47] border-[3px] border-[#f9d092] text-[#cf6500] shadow-[0_15px_25px_rgba(150,55,0,.2)] translate-x-[-10px] translate-y-[105px] max-[700px]:w-20 max-[700px]:h-20 max-[700px]:text-[35px]">
            <i className="fa-solid fa-box" />
          </div>
          <div className="w-[130px] h-[230px] flex items-center justify-center text-[65px] rounded-[25px] border-[7px] border-[#ffd49c] bg-[#fff0d9] text-[#e86a00] rotate-[8deg] shadow-[0_15px_25px_rgba(150,55,0,.15)] max-[700px]:w-20 max-[700px]:h-[140px] max-[700px]:text-[35px]">
            <i className="fa-solid fa-location-dot" />
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-[42px] leading-[1.25] mb-[18px] font-bold max-[1000px]:text-[32px] max-[700px]:text-[28px]">
            Your Packages,
            <br />
            Our Priority
          </h2>
          <p className="text-xl opacity-90">Safe. Secure. On Time.</p>
        </div>
      </section>

      {/* RIGHT FORM */}
      <section className="flex-1 flex flex-col bg-white p-[55px] max-[1000px]:p-[35px] max-[700px]:px-[25px]">
        <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[530px]">
          <div className="mb-10">
            <p className="text-[24px] text-[#72839b]">Sign in to manage your parcels</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block mb-2.5 font-bold text-base text-[#64748b]">
                Email
              </label>
              <div className={inputWrap}>
                <i className="fa-regular fa-envelope text-[#72839b] text-xl" />
                <input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="flex-1 min-w-0 outline-none text-base text-[#27364f] bg-transparent placeholder:text-[#a6b3c5]"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block mb-2.5 font-bold text-base text-[#64748b]">
                Password
              </label>
              <div className={inputWrap}>
                <i className="fa-solid fa-lock text-[#72839b] text-xl" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 min-w-0 outline-none text-base text-[#27364f] bg-transparent placeholder:text-[#a6b3c5]"
                />
                <button
                  type="button"
                  aria-label="Show or hide password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[#72839b] text-lg"
                >
                  <i className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2.5 mt-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-[#72839b]">
                  <input type="checkbox" className="w-[17px] h-[17px] accent-orange-500" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-orange-500">
                  Forgot password?
                </a>
              </div>
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-lg border border-[#ffdede] bg-[#fff1f1] px-4 py-3 text-sm text-[#d94a4a]">
                {error}
              </p>
            )}

            <label className="mb-5 flex cursor-pointer items-start gap-3 text-[15px] leading-[1.6] text-[#72839b]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={toggleAgree}
                aria-describedby="terms-hint"
                className="mt-1 h-[18px] w-[18px] shrink-0 accent-orange-500"
              />
              <span id="terms-hint">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
                  className="font-semibold text-orange-500 underline underline-offset-2"
                >
                  Terms of Service
                </button>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full rounded-xl p-[17px] text-[17px] font-bold text-white bg-gradient-to-r from-[#ff7900] to-[#ff6500] transition hover:bg-[#e85a00] hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>

            <p className="mt-[40px] text-center text-sm text-[#7a8aa2]">
              <i className="fa-solid fa-circle-info mr-1.5" />
              Seller and Rider accounts are created by the Coordinator. Ask them if you need access.
            </p>
          </form>
        </div>
        </div>

        <footer className="pt-8 text-center text-[13px] text-[#9aa8bb]">
          © 2026 {COPYRIGHT_OWNER}. All rights reserved.
        </footer>
      </section>

      <TermsModal open={termsOpen} alreadyAccepted={agreed} onAgree={confirmAgree} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
