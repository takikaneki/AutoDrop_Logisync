import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { btnPrimary, inputCls, labelCls } from "./styles.js";
import { changePassword } from "../services/userService.js";
import { logoutUser } from "../api.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import Icon from "./Icon.jsx";

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

// Change password: hinihingi muna ang current password; ang backend ang nagve-verify nito.
// Pagkatapos mag-change password, lalabas ang "Do you want to log out of all devices?" modal na may auto-logout.
export default function ChangePasswordForm({ desktopSplit = false }) {
  const navigate = useNavigate();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoutPromptOpen, setLogoutPromptOpen] = useState(false);
  const [logoutScope, setLogoutScope] = useState("all"); // "all" | "current"
  const [countdown, setCountdown] = useState(5);
  const [loggingOut, setLoggingOut] = useState(false);

  const s = strength(next);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-[#e5e5e5]", "bg-[#d94747]", "bg-[#e99a00]", "bg-[#8bc34a]", "bg-[#29945a]"];

  const performAutoLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      toast("Signed out. Please log in with your new password.");
      navigate("/login", { replace: true, state: { fromLogout: true, passwordChanged: true } });
    }
  };

  useEffect(() => {
    if (!logoutPromptOpen) return;
    if (countdown <= 0) {
      performAutoLogout();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [logoutPromptOpen, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSuccess("");
    if (!cur) return setError("Please enter your current password.");
    if (!next) return setError("Please enter a new password.");
    if (next.length < 8) return setError("The new password must be at least 8 characters.");
    if (next === cur) return setError("The new password must be different from the current one.");
    if (next !== again) return setError("The new passwords do not match.");
    setError("");
    setSaving(true);
    try {
      const res = await changePassword(cur, next, again);
      const msg = res?.message || "Password updated successfully.";
      logAction({ category: "Settings", action: "Changed password" });
      setSuccess(msg);
      toast(msg);
      setCur("");
      setNext("");
      setAgain("");
      setLogoutScope("all");
      setCountdown(5);
      setLogoutPromptOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const logoutModal = logoutPromptOpen && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-logout-devices-title"
        className="w-full max-w-[400px] rounded-2xl border-[1.5px] border-brand/35 bg-white p-6 text-left shadow-[0_24px_60px_rgba(0,0,0,0.25)] animate-popup dark:border-brand/30 dark:bg-[#2c2724] dark:text-[#f5f1ed]"
      >
        <div className="mb-3.5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand ring-4 ring-brand/10 dark:bg-night-head">
            <Icon name="shield-check" className="text-[20px]" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Password Updated
            </span>
            <h3 id="pw-logout-devices-title" className="mt-0.5 text-[17px] font-extrabold text-[#0f172a] dark:text-white">
              Do you want to log out of devices?
            </h3>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
          Your password was changed successfully. Choose how you want to sign out of your devices to re-authenticate with your new password:
        </p>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => setLogoutScope("all")}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              logoutScope === "all"
                ? "border-brand bg-brand-soft/60 dark:border-brand dark:bg-brand/15"
                : "border-slate-200 bg-slate-50/70 hover:border-brand/50 dark:border-night-line dark:bg-night-head/50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                logoutScope === "all" ? "border-brand bg-brand text-white" : "border-slate-400"
              }`}
            >
              {logoutScope === "all" && <Icon name="check" className="text-[10px]" />}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                Log out of all devices (Recommended)
              </strong>
              <small className="block text-[11.5px] text-slate-500 dark:text-[#b8b0a8]">
                Sign out everywhere and require your new password on all devices.
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLogoutScope("current")}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              logoutScope === "current"
                ? "border-brand bg-brand-soft/60 dark:border-brand dark:bg-brand/15"
                : "border-slate-200 bg-slate-50/70 hover:border-brand/50 dark:border-night-line dark:bg-night-head/50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                logoutScope === "current" ? "border-brand bg-brand text-white" : "border-slate-400"
              }`}
            >
              {logoutScope === "current" && <Icon name="check" className="text-[10px]" />}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                Log out of this device
              </strong>
              <small className="block text-[11.5px] text-slate-500 dark:text-[#b8b0a8]">
                Sign out of this session now and log back in with your new password.
              </small>
            </span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:bg-amber-950/35 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <Icon name="clock" className="text-[13px] text-brand" />
            <span>Auto-logging out in {countdown}s…</span>
          </span>
          <span className="text-[11px] font-bold uppercase text-brand">Security Required</span>
        </div>

        <button
          type="button"
          disabled={loggingOut}
          onClick={performAutoLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14px] font-extrabold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
        >
          <Icon name="log-out" className="text-[15px]" />
          <span>{loggingOut ? "Logging out…" : "Log Out Devices Now"}</span>
        </button>
      </div>
    </div>
  );

  if (desktopSplit) {
    return (
      <>
        <form onSubmit={submit} noValidate className="grid w-full grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-8 items-start text-left">
          {/* Left section */}
          <div>
            <h3 className="text-[14px] font-bold text-[#27364f] dark:text-[#f1eeeb]">Change Password</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
              Update your account password to stay secure.
            </p>
          </div>

          {/* Right section */}
          <div className="min-w-0">
            {/* First row: Current Password and New Password side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="pw-split-cur">Current password</label>
                <input
                  id="pw-split-cur"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={cur}
                  onChange={(e) => {
                    setCur(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pw-split-next">New password</label>
                <input
                  id="pw-split-next"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => {
                    setNext(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  className={inputCls}
                />
              </div>
            </div>

            {next && (
              <div className="mt-2">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 flex-1 rounded-full ${s >= n ? colors[s] : "bg-[#e5e5e5] dark:bg-night-line"}`}
                    />
                  ))}
                </div>
                <small className="text-[12px] text-[#999]">
                  {labels[s]} — use 8+ characters with upper/lower case, a number and a symbol.
                </small>
              </div>
            )}

            {/* Second row: Confirm New Password occupying full width */}
            <div className="mt-3.5">
              <label className={labelCls} htmlFor="pw-split-again">Confirm new password</label>
              <input
                id="pw-split-again"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={again}
                onChange={(e) => {
                  setAgain(e.target.value);
                  setError("");
                  setSuccess("");
                }}
                className={inputCls}
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 text-[13px] font-semibold text-[#d94747]">
                <Icon name="circle-alert" className="mr-1" />
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="mt-3 text-[13px] font-semibold text-[#29945a]">
                <Icon name="circle-check" className="mr-1" />
                {success}
              </p>
            )}

            {/* Bottom row: Show Passwords left, Update Password button right */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[#777] cursor-pointer dark:text-[#d1c9c2]">
                <input
                  type="checkbox"
                  checked={show}
                  onChange={(e) => setShow(e.target.checked)}
                  className="accent-brand"
                />
                Show passwords
              </label>
              <button type="submit" disabled={saving} className={`${btnPrimary} disabled:opacity-60`}>
                <Icon name="key-round" /> {saving ? "Updating…" : "Update password"}
              </button>
            </div>
          </div>
        </form>
        {logoutModal}
      </>
    );
  }

  const fields = [["Current password", cur, setCur, "current-password"], ["New password", next, setNext, "new-password"], ["Confirm new password", again, setAgain, "new-password"]];

  return (
    <>
      <form onSubmit={submit} noValidate className="max-w-[460px]">
        {fields.map(([l, v, fn, ac], i) => (
          <div key={l} className="mb-5">
            <label className={labelCls} htmlFor={`pw${i}`}>{l}</label>
            <input
              id={`pw${i}`}
              type={show ? "text" : "password"}
              autoComplete={ac}
              value={v}
              onChange={(e) => {
                fn(e.target.value);
                setError("");
                setSuccess("");
              }}
              className={inputCls}
            />
            {i === 1 && next && (
              <div className="mt-2">
                <div className="flex gap-1.5">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${s >= n ? colors[s] : "bg-[#e5e5e5] dark:bg-night-line"}`} />)}</div>
                <small className="text-[12px] text-[#999]">{labels[s]} — use 8+ characters with upper/lower case, a number and a symbol.</small>
              </div>
            )}
          </div>
        ))}
        <label className="flex items-center gap-2 mb-5 text-[13px] text-[#777] cursor-pointer dark:text-[#d1c9c2]"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-brand" /> Show passwords</label>
        {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#d94747]"><Icon name="circle-alert" className="mr-1" />{error}</p>}
        {success && <p role="status" className="mb-4 text-[13px] font-semibold text-[#29945a]"><Icon name="circle-check" className="mr-1" />{success}</p>}
        <button type="submit" disabled={saving} className={`${btnPrimary} disabled:opacity-60`}><Icon name="key-round" /> {saving ? "Updating…" : "Update password"}</button>
      </form>
      {logoutModal}
    </>
  );
}
