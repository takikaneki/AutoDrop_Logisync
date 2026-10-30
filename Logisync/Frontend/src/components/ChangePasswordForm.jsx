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
export default function ChangePasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const s = strength(next);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-[#e5e5e5]", "bg-[#d94747]", "bg-[#e99a00]", "bg-[#8bc34a]", "bg-[#29945a]"];

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!cur) return setError("Please enter your current password.");
    if (next.length < 8) return setError("The new password must be at least 8 characters.");
    if (next === cur) return setError("The new password must be different from the current one.");
    if (next !== again) return setError("The new passwords do not match.");
    setError("");
    setSaving(true);
    try {
      await changePassword(cur, next);
      logAction({ category: "Settings", action: "Changed password" });
      toast("Password updated.");
      setCur(""); setNext(""); setAgain("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [["Current password", cur, setCur, "current-password"], ["New password", next, setNext, "new-password"], ["Confirm new password", again, setAgain, "new-password"]];

  return (
    <form onSubmit={submit} noValidate className="max-w-[460px]">
      {fields.map(([l, v, fn, ac], i) => (
        <div key={l} className="mb-5">
          <label className={labelCls} htmlFor={`pw${i}`}>{l}</label>
          <input id={`pw${i}`} type={show ? "text" : "password"} autoComplete={ac} value={v} onChange={(e) => { fn(e.target.value); setError(""); }} className={inputCls} />
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
      <button type="submit" disabled={saving} className={`${btnPrimary} disabled:opacity-60`}><i className="fa-solid fa-key" /> {saving ? "Updating…" : "Update password"}</button>
    </form>
  );
}
