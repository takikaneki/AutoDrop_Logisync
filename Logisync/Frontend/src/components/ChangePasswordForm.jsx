import { useState } from "react";
import { btnPrimary, inputCls, labelCls } from "./styles.js";
import { changePassword } from "../services/userService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

// Change password: hinihingi muna ang current password; ang backend ang nagve-verify nito.
// Ginagamit ng Coordinator (Settings) at ng Seller/Rider (SettingsPage).
export default function ChangePasswordForm({ desktopSplit = false }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const s = strength(next);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-[#e5e5e5]", "bg-[#d94747]", "bg-[#e99a00]", "bg-[#8bc34a]", "bg-[#29945a]"];

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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (desktopSplit) {
    return (
      <form onSubmit={submit} noValidate className="grid grid-cols-[35%_65%] gap-6 items-start">
        {/* Left section (35%) */}
        <div>
          <h3 className="text-[14px] font-bold text-[#27364f] dark:text-[#f1eeeb]">Change Password</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
            Update your account password to stay secure.
          </p>
        </div>

        {/* Right section (65%) */}
        <div className="min-w-0">
          {/* First row: Current Password and New Password side by side */}
          <div className="grid grid-cols-2 gap-3.5">
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
              <i className="fa-solid fa-circle-exclamation mr-1" />
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="mt-3 text-[13px] font-semibold text-[#29945a]">
              <i className="fa-solid fa-circle-check mr-1" />
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
              <i className="fa-solid fa-key" /> {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  const fields = [["Current password", cur, setCur, "current-password"], ["New password", next, setNext, "new-password"], ["Confirm new password", again, setAgain, "new-password"]];

  return (
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
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#d94747]"><i className="fa-solid fa-circle-exclamation mr-1" />{error}</p>}
      {success && <p role="status" className="mb-4 text-[13px] font-semibold text-[#29945a]"><i className="fa-solid fa-circle-check mr-1" />{success}</p>}
      <button type="submit" disabled={saving} className={`${btnPrimary} disabled:opacity-60`}><i className="fa-solid fa-key" /> {saving ? "Updating…" : "Update password"}</button>
    </form>
  );
}
