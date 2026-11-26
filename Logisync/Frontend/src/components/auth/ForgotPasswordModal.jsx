import { useEffect, useState, useRef } from "react";
import { api } from "../../api.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";
import Icon from "../Icon.jsx";

export default function ForgotPasswordModal({ open, onClose, defaultEmail = "" }) {
  // Steps: 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'
  const [step, setStep] = useState("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetAuthToken, setResetAuthToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  const otpInputsRef = useRef([]);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || "");
      setStep("EMAIL");
      setOtp(["", "", "", "", "", ""]);
      setResetAuthToken("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setLoading(false);
      setCooldown(0);
      setRemainingAttempts(null);
    }
  }, [open, defaultEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!open) return null;

  // Step 1: Submit email to request OTP (strictly locked to the email set on Sign In)
  const lockedEmail = String(defaultEmail || "").trim();

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = lockedEmail.toLowerCase();
    setError("");

    if (!cleanEmail) {
      setError("Please enter your registered email address on the Sign In screen first.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email address on the Sign In screen first.");
      return;
    }

    setLoading(true);
    try {
      const res = await api("/auth/otp/request", {
        method: "POST",
        body: { email: cleanEmail, purpose: "FORGOT_PASSWORD" },
      });
      setEmail(cleanEmail);
      setCooldown(res.cooldownSeconds || 60);
      setRemainingAttempts(null);
      setStep("OTP");
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      if (typeof err.remainingSeconds === "number" && err.remainingSeconds > 0) {
        setCooldown(err.remainingSeconds);
      }
      setError(err.message || "Unable to request verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    const cleanEmail = lockedEmail.toLowerCase();
    if (!cleanEmail) return;
    setError("");
    setLoading(true);
    try {
      const res = await api("/auth/otp/resend", {
        method: "POST",
        body: { email: cleanEmail, purpose: "FORGOT_PASSWORD" },
      });
      setCooldown(res.cooldownSeconds || 60);
      setOtp(["", "", "", "", "", ""]);
      setRemainingAttempts(null);
      otpInputsRef.current[0]?.focus();
    } catch (err) {
      if (typeof err.remainingSeconds === "number" && err.remainingSeconds > 0) {
        setCooldown(err.remainingSeconds);
      }
      setError(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // Handle single digit in 6-digit OTP
  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, "");
    if (!val) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // If pasted multiple digits
    if (val.length > 1) {
      const chars = val.slice(0, 6).split("");
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = chars[i] || "";
      }
      setOtp(newOtp);
      const nextIdx = Math.min(chars.length, 5);
      otpInputsRef.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    setError("");

    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const res = await api("/auth/otp/verify", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          otp: otpCode,
          purpose: "FORGOT_PASSWORD",
        },
      });

      setResetAuthToken(res.resetAuthToken);
      setStep("PASSWORD");
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
      if (typeof err.remainingAttempts === "number") {
        setRemainingAttempts(err.remainingAttempts);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password-otp", {
        method: "POST",
        body: {
          resetAuthToken,
          newPassword,
          confirmPassword,
        },
      });
      setStep("SUCCESS");
    } catch (err) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputWrap =
    "flex items-center gap-3 border border-slate-200 rounded-xl px-4 h-12 bg-slate-50/60 transition duration-150 focus-within:bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 hover:border-slate-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
    >
      <div
        className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#d9482b] via-amber-500 to-[#c84227]" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-md sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-base text-white shadow-sm shadow-orange-500/25">
              <Icon name="key-round" />
            </span>
            <div>
              <h2 id="forgot-password-title" className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Reset Your Password
              </h2>
              <p className="text-xs text-slate-500">
                LogiSync OTP Verification & Recovery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Password Reset Modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="x" className="text-base" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7">
          {error && (
            <div
              role="alert"
              className="mb-5 flex animate-popup items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600"
            >
              <Icon name="circle-alert" className="mt-0.5 shrink-0 text-sm" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {/* STEP 1: ENTER EMAIL */}
          {step === "EMAIL" && (
            <form onSubmit={handleRequestOtp} noValidate>
              <div className="mb-5 text-center">
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  draggable={false}
                  className="mx-auto mb-2.5 h-8 w-auto object-contain"
                />
                <p className="text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                  We will send a 6-digit OTP code to your registered email address below to verify your identity.
                </p>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="forgot-password-email"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Registered Email Address
                </label>
                <div className={`${inputWrap} cursor-not-allowed bg-slate-100/90 focus-within:border-slate-200 focus-within:ring-0`}>
                  <Icon name="mail" className="shrink-0 text-base text-slate-400" />
                  <input
                    id="forgot-password-email"
                    type="email"
                    value={lockedEmail}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    placeholder="No email set on Sign In"
                    className="min-w-0 flex-1 cursor-not-allowed select-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <Icon name="lock" className="shrink-0 text-xs text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={loading || !lockedEmail}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Icon name="loader-2" className="animate-spin text-sm" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="send" className="text-xs" />
                      <span>Send OTP Code</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP */}
          {step === "OTP" && (
            <form onSubmit={handleVerifyOtp} noValidate className="animate-popup">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-xl text-brand">
                  <Icon name="mail-check" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Enter Verification Code
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>.
                  Code expires in 5 minutes.
                </p>
              </div>

              <div className="my-6 flex justify-center gap-2 sm:gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl font-extrabold text-slate-900 shadow-sm transition focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/20"
                  />
                ))}
              </div>

              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="mb-3 text-center text-xs text-amber-600 font-semibold">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining before lockout.
                </p>
              )}

              <div className="mb-5 text-center">
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-brand hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive the code? Resend"}
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Icon name="loader-2" className="animate-spin text-sm" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check-circle" className="text-xs" />
                      <span>Verify Code</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("EMAIL")}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Change Email
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: NEW PASSWORD */}
          {step === "PASSWORD" && (
            <form onSubmit={handleResetPassword} noValidate className="animate-popup">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-600">
                  <Icon name="shield-check" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Create New Password
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Identity verified. Enter a secure new password for your account.
                </p>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    New Password
                  </label>
                  <div className={inputWrap}>
                    <Icon name="lock" className="shrink-0 text-base text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="At least 8 characters"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      <Icon name={showPassword ? "eye-off" : "eye"} className="text-base" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Confirm New Password
                  </label>
                  <div className={inputWrap}>
                    <Icon name="lock" className="shrink-0 text-base text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Re-enter new password"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      <Icon name={showConfirmPassword ? "eye-off" : "eye"} className="text-base" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Icon name="loader-2" className="animate-spin text-sm" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" className="text-sm" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: SUCCESS */}
          {step === "SUCCESS" && (
            <div className="text-center animate-popup py-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 ring-8 ring-emerald-50/50">
                <Icon name="check-circle" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Password Successfully Reset
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                Your LogiSync password has been updated. You can now sign in using your new credentials.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark"
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
