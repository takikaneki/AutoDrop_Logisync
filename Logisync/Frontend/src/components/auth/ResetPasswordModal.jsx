import { useEffect, useState } from "react";
import { api } from "../../api.js";

export default function ResetPasswordModal({ open, token, onClose, onSuccess, onRequestNewLink }) {
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !token) return;

    let isMounted = true;
    setVerifying(true);
    setError("");

    api(`/auth/reset-password/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!isMounted) return;
        setTokenValid(Boolean(res.valid));
        setMaskedEmail(res.email || "");
      })
      .catch((err) => {
        if (!isMounted) return;
        setTokenValid(false);
        setError(err.message || "This password reset link is invalid or has expired.");
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, token]);

  if (!open || !token) return null;

  const handleSubmit = async (e) => {
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

    setSubmitting(true);
    try {
      const res = await api("/auth/reset-password", {
        method: "POST",
        body: {
          token,
          newPassword,
          confirmPassword,
        },
      });

      onSuccess?.(res.message || "Password successfully reset! Please sign in with your new password.");
    } catch (err) {
      setError(err.message || "Failed to reset password. Please try again or request a new link.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputWrap =
    "flex items-center gap-3 border border-slate-200 rounded-xl px-4 h-12 bg-slate-50/60 transition duration-150 focus-within:bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 hover:border-slate-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
    >
      <div
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#f97316] via-amber-500 to-[#ea580c]" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-md sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-base text-white shadow-sm shadow-orange-500/25">
              <i className="fa-solid fa-lock" />
            </span>
            <div>
              <h2 id="reset-password-title" className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Set New Password
              </h2>
              <p className="text-xs text-slate-500">
                {maskedEmail ? `For account ${maskedEmail}` : "LogiSync Security"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reset Password Modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-7">
          {verifying ? (
            <div className="py-8 text-center text-slate-500">
              <i className="fa-solid fa-circle-notch animate-spin text-3xl text-brand" />
              <p className="mt-3 text-sm font-semibold">Verifying reset token...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center animate-popup">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600 ring-8 ring-red-50/50">
                <i className="fa-solid fa-link-slash" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Invalid or Expired Link
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {error || "This password reset link has expired or has already been used. Please request a new recovery link."}
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onRequestNewLink?.();
                  }}
                  className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark"
                >
                  Request a New Reset Link
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p className="mb-4 text-xs leading-relaxed text-slate-600">
                Enter your new password below. It must be at least 8 characters and different from your previous password.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex animate-popup items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600"
                >
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-sm" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <div className="space-y-4 mb-5">
                {/* New Password */}
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                  >
                    New Password
                  </label>
                  <div className={inputWrap}>
                    <i className="fa-solid fa-lock shrink-0 text-base text-slate-400" />
                    <input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
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
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                  >
                    Confirm New Password
                  </label>
                  <div className={inputWrap}>
                    <i className="fa-solid fa-shield-halved shrink-0 text-base text-slate-400" />
                    <input
                      id="reset-confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password requirement helper */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <i
                    className={`fa-solid ${
                      newPassword.length >= 8
                        ? "fa-circle-check text-emerald-600"
                        : "fa-circle text-slate-300"
                    }`}
                  />
                  <span>Minimum 8 characters</span>
                  {confirmPassword && (
                    <>
                      <span className="text-slate-300">•</span>
                      <i
                        className={`fa-solid ${
                          newPassword === confirmPassword && confirmPassword.length > 0
                            ? "fa-circle-check text-emerald-600"
                            : "fa-circle text-slate-300"
                        }`}
                      />
                      <span>Passwords match</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin text-sm" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs" />
                      <span>Save New Password</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

