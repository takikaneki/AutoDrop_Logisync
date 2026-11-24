import { useEffect, useState, useRef } from "react";
import { api, saveSession, homePathForRole } from "../../api.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";
import { POLICY_VERSION } from "../../data/terms.js";
import Icon from "../Icon.jsx";

export default function FirstLoginModal({
  open,
  firstLoginData,
  onClose,
  onSuccess,
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  const otpInputsRef = useRef([]);

  const email = firstLoginData?.email || "";
  const name = firstLoginData?.name || "User";
  const firstLoginToken = firstLoginData?.firstLoginToken || "";

  // Auto-request initial OTP on modal open
  useEffect(() => {
    if (!open || !firstLoginToken) return;

    setOtp(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setCooldown(60);
    setRemainingAttempts(null);

    // Initial OTP dispatch
    api("/auth/otp/request", {
      method: "POST",
      body: {
        firstLoginToken,
        purpose: "FIRST_LOGIN",
      },
    }).catch((err) => {
      // If cooldown is active or failed, capture message
      if (err.remainingSeconds) {
        setCooldown(err.remainingSeconds);
      } else {
        setError(err.message || "Failed to dispatch verification code.");
      }
    });

    setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 150);
  }, [open, firstLoginToken]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!open || !firstLoginData) return null;

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending || loading) return;
    setError("");
    setResending(true);
    try {
      const res = await api("/auth/otp/resend", {
        method: "POST",
        body: {
          firstLoginToken,
          purpose: "FIRST_LOGIN",
        },
      });
      setCooldown(res.cooldownSeconds || 60);
      setOtp(["", "", "", "", "", ""]);
      setRemainingAttempts(null);
      otpInputsRef.current[0]?.focus();
    } catch (err) {
      if (typeof err.remainingSeconds === "number" && err.remainingSeconds > 0) {
        setCooldown(err.remainingSeconds);
      }
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, "");
    if (!val) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    setError("");

    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const res = await api("/auth/first-login-change-password", {
        method: "POST",
        body: {
          firstLoginToken,
          otp: otpCode,
          newPassword,
          confirmPassword,
          policyVersion: POLICY_VERSION,
        },
      });

      if (res.token && res.user) {
        saveSession(res);
        onSuccess?.(res);
      } else {
        onClose?.();
      }
    } catch (err) {
      setError(err.message || "Failed to update password.");
      if (typeof err.remainingAttempts === "number") {
        setRemainingAttempts(err.remainingAttempts);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputWrap =
    "flex items-center gap-3 border border-slate-200 rounded-xl px-4 h-12 bg-slate-50/60 transition duration-150 focus-within:bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 hover:border-slate-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-title"
    >
      <div
        className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#f97316] via-amber-500 to-[#ea580c]" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-md sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-base text-white shadow-sm shadow-orange-500/25">
              <Icon name="shield-check" />
            </span>
            <div>
              <h2 id="first-login-title" className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                First-Time Login Setup
              </h2>
              <p className="text-xs text-slate-500">
                Welcome, {name}! Please secure your account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="x" className="text-base" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-7">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5 text-center">
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="mx-auto mb-2.5 h-8 w-auto object-contain"
              />
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                Your account was provisioned by a Coordinator. For security, please verify the 6-digit OTP code sent to <strong className="text-slate-800">{email}</strong> and set a permanent personal password.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex animate-popup items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600"
              >
                <Icon name="circle-alert" className="mt-0.5 shrink-0 text-sm" />
                <div className="leading-snug">{error}</div>
              </div>
            )}

            {/* OTP Section */}
            <div className="mb-6">
              <label className="mb-2 block text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                Verification Code (6-Digit OTP)
              </label>
              <div className="flex justify-center gap-2 sm:gap-3">
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
                <p className="mt-2 text-center text-xs text-amber-600 font-semibold">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining before lockout.
                </p>
              )}

              <div className="mt-3 text-center">
                <button
                  type="button"
                  disabled={cooldown > 0 || resending || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-brand hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Verification Code"}
                </button>
              </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  New Permanent Password
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
                  Confirm Permanent Password
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
                    placeholder="Re-enter password"
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

            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading || otp.join("").length !== 6 || !newPassword || !confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Icon name="loader-2" className="animate-spin text-sm" />
                    <span>Configuring Password...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check-circle" className="text-sm" />
                    <span>Set Password & Proceed</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Cancel & Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
