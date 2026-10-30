import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { EmptyState } from "../components/ui.jsx";
import { Notice } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, th } from "../components/styles.js";
import { createUser, listUsers } from "../services/userService.js";
import { toast } from "../store/toast.js";
import { ROLE_BADGE } from "../utils/activity.js";
import { formatDate } from "../utils/format.js";

const ROLES = [
  ["seller", "Seller", "Registers parcels and uploads video proof."],
  ["rider", "Rider", "Scans verified parcels and delivers them."],
];
const EMPTY = { name: "", email: "", password: "", role: "seller" };

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

// Accounts: ang coordinator lang ang makakagawa ng account (walang public sign-up).
// Ang backend ang nagpapatupad nito (POST /api/users = coordinator lang).
export default function Accounts() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError("");
    listUsers().then(setUsers).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    setApiError("");
  };

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = "Enter the person's full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = "Enter a valid email address.";
    if (form.password.length < 8) er.password = "Password must be at least 8 characters.";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const user = await createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      setCreated({ ...user, password: form.password });
      setUsers((l) => [{ ...user, created_at: new Date().toISOString() }, ...l]);
      setForm({ ...EMPTY, role: form.role });
      toast(`Account created for ${user.name}`);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => (tab === "all" || u.role === tab) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [users, tab, search]);

  const count = (r) => users.filter((u) => u.role === r).length;

  return (
    <>
      <Topbar title="Accounts" subtitle="Create Seller and Rider accounts. Only the Coordinator can do this." />

      <div className="grid grid-cols-[400px_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
        <section className={`${panel} p-6`}>
          <h2 className="mb-1 text-[17px] font-bold"><i className="fa-solid fa-user-plus mr-2 text-orange-500" />New account</h2>
          <p className="mb-5 text-[13px] text-[#999]">Give the person their email and password so they can sign in.</p>

          {created && (
            <div className="mb-5">
              <Notice tone="success" icon="fa-circle-check" role="status">
                <strong className="block">Account created</strong>
                <span className="block break-all">{created.email} · <span className="capitalize">{created.role}</span></span>
                <span className="block">Temporary password: <code className="font-bold">{created.password}</code></span>
                <span className="mt-1 block text-[12px] opacity-80">Share this privately. It will not be shown again.</span>
              </Notice>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            <div className="mb-4">
              <label htmlFor="acc-role" className={labelCls}>Role</label>
              <select id="acc-role" value={form.role} onChange={set("role")} className={inputCls}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="mt-1 text-[12px] text-[#999]">{ROLES.find(([v]) => v === form.role)[2]}</p>
            </div>

            {[
              ["name", "Full name", "text", "e.g. Juan Dela Cruz"],
              ["email", "Email", "email", "name@example.com"],
            ].map(([k, label, type, ph]) => (
              <div key={k} className="mb-4">
                <label htmlFor={`acc-${k}`} className={labelCls}>{label}</label>
                <input id={`acc-${k}`} type={type} value={form[k]} onChange={set(k)} placeholder={ph} maxLength={k === "name" ? 100 : 150} autoComplete="off" className={inputCls} />
                {errors[k] && <p role="alert" className="mt-1 text-[12px] text-[#d94747]">{errors[k]}</p>}
              </div>
            ))}

            <div className="mb-5">
              <label htmlFor="acc-password" className={labelCls}>Temporary password</label>
              <div className="flex gap-2">
                <input id="acc-password" type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" className={inputCls} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="Show or hide password" className={`${btnGhost} shrink-0`}><i className={`fa-regular ${showPw ? "fa-eye-slash" : "fa-eye"}`} /></button>
              </div>
              <button type="button" onClick={() => { setForm((f) => ({ ...f, password: randomPassword() })); setShowPw(true); setErrors((er) => ({ ...er, password: undefined })); }} className="mt-1.5 text-[13px] font-semibold text-brand hover:underline">
                Generate a password
              </button>
              {errors.password && <p role="alert" className="mt-1 text-[12px] text-[#d94747]">{errors.password}</p>}
            </div>

            {apiError && <div className="mb-4"><Notice tone="error" icon="fa-circle-exclamation" role="alert">{apiError}</Notice></div>}

            <button type="submit" disabled={saving} className={`${btnPrimary} w-full justify-center disabled:opacity-60`}>
              {saving ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>

        <section className={`${panel} min-w-0 p-6`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">All accounts <span className="ml-1 text-[14px] font-normal text-[#999]">({users.length})</span></h2>
            <button onClick={load} className={btnGhost}><i className="fa-solid fa-rotate" /> Refresh</button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[["all", "All", users.length], ["seller", "Sellers", count("seller")], ["rider", "Riders", count("rider")]].map(([k, l, n]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${tab === k ? "bg-brand text-white" : "bg-[#f5f5f5] text-[#777] hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"}`}>
                  {l} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search accounts" className={`${inputCls} !w-auto min-w-[200px] flex-1`} />
          </div>

          {loadError && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{loadError}</Notice>}
          {!loadError && (
            <div className="overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
              <table className="w-full min-w-[520px] border-collapse">
                <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Name", "Email", "Role", "Created"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={4} className={`${td} text-center text-[#999]`}>Loading…</td></tr>}
                  {!loading && rows.map((u) => (
                    <tr key={u.user_id}>
                      <td className={`${td} font-semibold`}>{u.name}</td>
                      <td className={`${td} break-all`}>{u.email}</td>
                      <td className={td}><span className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                      <td className={`${td} whitespace-nowrap text-[#999]`}>{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && rows.length === 0 && <EmptyState icon="fa-users" title="No accounts found" />}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
