import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

export default function ForgotPasswordModal({ open, onClose, defaultEmail = "" }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || "");
      setError("");
      setSent(false);
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

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setError("");

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: cleanEmail },
      });
      setSent(true);
    } catch (err) {
      setError(err.message || "Unable to process password reset request. Please try again.");
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
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top brand accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#f97316] via-amber-500 to-[#ea580c]" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-md sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-base text-white shadow-sm shadow-orange-500/25">
              <i className="fa-solid fa-key" />
            </span>
            <div>
              <h2 id="forgot-password-title" className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Reset Your Password
              </h2>
              <p className="text-xs text-slate-500">
                LogiSync Account Recovery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Password Reset Modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-7">
          {sent ? (
            <div className="text-center animate-popup">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 ring-8 ring-emerald-50/50">
                <i className="fa-solid fa-envelope-circle-check" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Recovery Instructions Sent
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                If an account with <strong className="text-slate-800">{email}</strong> exists in LogiSync, we have sent a secure password reset link to your email.
              </p>

              <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-left text-xs leading-relaxed text-amber-900">
                <div className="flex items-start gap-2.5">
                  <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-bold">Next Steps:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                      <li>Check your inbox and spam/junk folder.</li>
                      <li>The reset link will expire in <strong>1 hour</strong>.</li>
                      <li>Click the link to choose a new password.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark"
                >
                  Return to Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Try another email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-5 text-center">
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  draggable={false}
                  className="mx-auto mb-2.5 h-8 w-auto object-contain"
                />
                <p className="text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                  Enter the email address registered with your account. We will send you a secure link to reset your password.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex animate-popup items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600"
                >
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-sm" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <div className="mb-5">
                <label
                  htmlFor="forgot-password-email"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Registered Email Address
                </label>
                <div className={inputWrap}>
                  <i className="fa-regular fa-envelope shrink-0 text-base text-slate-400" />
                  <input
                    id="forgot-password-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="example@gmail.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin text-sm" />
                      <span>Sending Link...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane text-xs" />
                      <span>Send Reset Link</span>
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
        </div>
      </div>
    </div>
  );
}

