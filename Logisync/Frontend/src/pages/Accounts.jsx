import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { EmptyState } from "../components/ui.jsx";
import { Notice } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, stickyThead, td, th } from "../components/styles.js";
import { createUser, listUsers, resendCredentialsEmail } from "../services/userService.js";
import { toast } from "../store/toast.js";
import { ROLE_BADGE } from "../utils/activity.js";
import { formatDate } from "../utils/format.js";
import {
  formatPlus63Phone,
  PHILIPPINE_LOCAL_MAX_LENGTH,
  sanitizeLocalMobileDigits,
  validateMobileNumber,
} from "../utils/phone.js";
import Icon from "../components/Icon.jsx";

const ROLES = [
  ["seller", "Seller", "Registers parcels and uploads video proof."],
  ["rider", "Rider", "Scans verified parcels and delivers them."],
  ["coordinator", "Coordinator", "Manages hub operations, parcels, riders, and verification."],
];
const EMPTY = {
  name: "",
  email: "",
  phone: "",
  shop_name: "",
  zone: "General",
  vehicle: "Motorcycle",
  agency: "",
  password: "",
  role: "seller",
};

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
  const [retryingEmail, setRetryingEmail] = useState(false);
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
    const val = k === "phone" ? sanitizeLocalMobileDigits(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    setApiError("");
  };

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = "Enter the person's full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = "Enter a valid email address.";
    const phoneErr = validateMobileNumber(formatPlus63Phone(form.phone), {
      required: false,
      label: "Contact number",
    });
    if (phoneErr) er.phone = phoneErr;
    if (form.password.length < 8) er.password = "Password must be at least 8 characters.";
    if (form.role === "rider" && !form.agency.trim()) {
      er.agency = "Enter the rider's assigned agency.";
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const formattedPhone = formatPlus63Phone(form.phone);
      const user = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: formattedPhone || undefined,
        shop_name: form.role === "seller" ? form.shop_name.trim() || undefined : undefined,
        zone: form.role === "rider" ? form.zone.trim() || "General" : undefined,
        vehicle: form.role === "rider" ? form.vehicle.trim() || "Motorcycle" : undefined,
        agency: form.role === "rider" ? form.agency.trim() : undefined,
      });
      setCreated({
        ...user,
        password: form.password,
        emailSent: Boolean(user.emailSent),
        emailError: user.emailError || "",
      });
      setUsers((l) => [{ ...user, created_at: user.created_at || new Date().toISOString() }, ...l]);
      setForm({ ...EMPTY, role: form.role });
      toast(
        user.emailSent
          ? `Account created and credentials emailed to ${user.email}`
          : `Account created for ${user.name}, but credentials email failed to send.`
      );
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRetryEmail = async () => {
    if (!created?.user_id || !created?.password || retryingEmail) return;
    setRetryingEmail(true);
    try {
      await resendCredentialsEmail(created.user_id, created.password);
      setCreated((prev) => (prev ? { ...prev, emailSent: true, emailError: "" } : prev));
      toast(`Credentials email sent to ${created.email}`);
    } catch (err) {
      setCreated((prev) =>
        prev ? { ...prev, emailSent: false, emailError: err.message || "Failed to send credentials email." } : prev
      );
    } finally {
      setRetryingEmail(false);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (tab === "all" || u.role === tab) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, tab, search]);

  const count = (r) => users.filter((u) => u.role === r).length;

  return (
    <>
      <Topbar title="Accounts" subtitle="Create Seller, Rider, and Coordinator accounts. Only the Coordinator can do this." />

      <div className="grid grid-cols-[400px_1fr] items-stretch overflow-hidden rounded-2xl border-[1.5px] border-brand/45 border-t-[3px] border-t-brand bg-white shadow-xs dark:border-brand/35 dark:border-t-brand dark:bg-night-panel max-[1100px]:grid-cols-1">
        <section className="border-r border-brand-line bg-[#f8fafc]/70 p-6 dark:border-night-line dark:bg-[#1d1a17]/60 max-[1100px]:border-r-0 max-[1100px]:border-b">
          <h2 className="mb-1 text-[17px] font-bold">
            <Icon name="user-plus" className="mr-2 text-orange-500" />
            New account
          </h2>
          <p className="mb-5 text-[13px] text-[#999]">Give the person their email and password so they can sign in.</p>

          {created && (
            <div className="mb-5">
              <Notice
                tone={created.emailSent ? "success" : "warn"}
                icon={created.emailSent ? "circle-check" : "triangle-alert"}
                role="status"
              >
                <strong className="block">
                  {created.emailSent
                    ? "Account created & credentials emailed"
                    : "Account created — email delivery failed"}
                </strong>
                <span className="block break-all">
                  {created.email} · <span className="capitalize">{created.role}</span>
                </span>
                <span className="block">
                  Temporary password: <code className="font-bold">{created.password}</code>
                </span>
                {created.emailSent ? (
                  <span className="mt-1 block text-[12px] opacity-80">
                    Login credentials and first-time verification instructions were sent to {created.email}.
                  </span>
                ) : (
                  <div className="mt-2 space-y-2">
                    <span className="block text-[12px]">
                      {created.emailError || "Unable to send the credentials email right now."}{" "}
                      The account was saved and will not be duplicated if you retry.
                    </span>
                    <button
                      type="button"
                      disabled={retryingEmail}
                      onClick={handleRetryEmail}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-current/25 bg-white/80 px-3 py-1.5 text-[12px] font-bold transition hover:bg-white disabled:opacity-60 dark:bg-night-panel/80"
                    >
                      <Icon
                        name={retryingEmail ? "loader-2" : "send"}
                        className={retryingEmail ? "animate-spin text-[12px]" : "text-[12px]"}
                      />
                      <span>{retryingEmail ? "Retrying email..." : "Retry Sending Email"}</span>
                    </button>
                  </div>
                )}
              </Notice>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            <div className="mb-4">
              <label htmlFor="acc-role" className={labelCls}>
                Role
              </label>
              <select id="acc-role" value={form.role} onChange={set("role")} className={inputCls}>
                {ROLES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-[#999]">{ROLES.find(([v]) => v === form.role)[2]}</p>
            </div>

            {[
              ["name", "Full name", "text", "e.g. Juan Dela Cruz"],
              ["email", "Email", "email", "name@example.com"],
            ].map(([k, label, type, ph]) => (
              <div key={k} className="mb-4">
                <label htmlFor={`acc-${k}`} className={labelCls}>
                  {label}
                </label>
                <input
                  id={`acc-${k}`}
                  type={type}
                  value={form[k]}
                  onChange={set(k)}
                  placeholder={ph}
                  maxLength={k === "name" ? 100 : 150}
                  autoComplete="off"
                  className={inputCls}
                />
                {errors[k] && (
                  <p role="alert" className="mt-1 text-[12px] text-[#d94747]">
                    {errors[k]}
                  </p>
                )}
              </div>
            ))}

            <div className="mb-4">
              <label htmlFor="acc-phone" className={labelCls}>
                Contact number (optional)
              </label>
              <div className="flex h-[42px] items-center overflow-hidden rounded-lg border border-[#cbd5e1] bg-white focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/10 dark:border-night-line dark:bg-night-head">
                <span className="flex h-full shrink-0 items-center border-r border-[#cbd5e1] bg-[#f8fafc] px-3 text-[13px] font-semibold text-[#475569] select-none dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]">
                  +63
                </span>
                <input
                  id="acc-phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="9[0-9]{9}"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="9171234567"
                  maxLength={PHILIPPINE_LOCAL_MAX_LENGTH}
                  autoComplete="off"
                  className="h-full w-full bg-transparent px-3 text-[13px] text-ink outline-none dark:text-[#f1eeeb]"
                />
              </div>
              {errors.phone && (
                <p role="alert" className="mt-1 text-[12px] text-[#d94747]">
                  {errors.phone}
                </p>
              )}
            </div>

            {form.role === "seller" && (
              <div className="mb-4">
                <label htmlFor="acc-shop" className={labelCls}>
                  Shop / Store name (optional)
                </label>
                <input
                  id="acc-shop"
                  type="text"
                  value={form.shop_name}
                  onChange={set("shop_name")}
                  placeholder="e.g. ABC Online Shop"
                  maxLength={120}
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
            )}

            {form.role === "rider" && (
              <div className="mb-4">
                <label htmlFor="acc-agency" className={labelCls}>
                  Assigned agency
                </label>
                <input
                  id="acc-agency"
                  type="text"
                  value={form.agency}
                  onChange={set("agency")}
                  maxLength={150}
                  placeholder="e.g. Test Logistics Agency"
                  autoComplete="off"
                  className={inputCls}
                />
                {errors.agency && <p role="alert" className="mt-1 text-[12px] text-[#d94747]">{errors.agency}</p>}
              </div>
            )}

            {form.role === "rider" && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-zone" className={labelCls}>
                    Zone
                  </label>
                  <select id="acc-zone" value={form.zone} onChange={set("zone")} className={inputCls}>
                    {["General", "North", "South", "East", "West", "Central"].map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="acc-vehicle" className={labelCls}>
                    Vehicle
                  </label>
                  <select id="acc-vehicle" value={form.vehicle} onChange={set("vehicle")} className={inputCls}>
                    {["Motorcycle", "Tricycle", "Delivery Van", "L300 Truck"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="acc-password" className={labelCls}>
                Temporary password
              </label>
              <div className="flex gap-2">
                <input
                  id="acc-password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Show or hide password"
                  className={`${btnGhost} shrink-0`}
                >
                  <Icon name={showPw ? "eye-off" : "eye"} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, password: randomPassword() }));
                  setShowPw(true);
                  setErrors((er) => ({ ...er, password: undefined }));
                }}
                className="mt-1.5 text-[13px] font-semibold text-brand hover:underline"
              >
                Generate a password
              </button>
              {errors.password && (
                <p role="alert" className="mt-1 text-[12px] text-[#d94747]">
                  {errors.password}
                </p>
              )}
            </div>

            {apiError && (
              <div className="mb-4">
                <Notice tone="error" icon="circle-alert" role="alert">
                  {apiError}
                </Notice>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className={`${btnPrimary} w-full justify-center disabled:opacity-60`}
            >
              {saving ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>

        <section className="min-w-0 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">
              All accounts <span className="ml-1 text-[14px] font-normal text-[#999]">({users.length})</span>
            </h2>
            <button onClick={load} className={btnGhost}>
              <Icon name="refresh-cw" /> Refresh
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                ["all", "All", users.length],
                ["seller", "Sellers", count("seller")],
                ["rider", "Riders", count("rider")],
                ["coordinator", "Coordinators", count("coordinator")],
              ].map(([k, l, n]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                    tab === k
                      ? "bg-brand text-white"
                      : "bg-[#f5f5f5] text-[#777] hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
                  }`}
                >
                  {l} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search accounts"
              className={`${inputCls} !w-auto min-w-[200px] flex-1`}
            />
          </div>

          {loadError && (
            <Notice tone="error" icon="circle-alert" role="alert">
              {loadError}
            </Notice>
          )}
          {!loadError && (
            <>
              <div className="hidden min-[701px]:block h-[calc(100vh-310px)] min-h-[400px] overflow-auto rounded-[10px] border border-[#eee] dark:border-night-line">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead className={stickyThead}>
                    <tr>
                      {["Name", "Email", "Role", "Created"].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={4} className={`${td} text-center text-[#999]`}>
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      rows.map((u) => (
                        <tr key={u.user_id}>
                          <td className={`${td} font-semibold`}>{u.name}</td>
                          <td className={`${td} break-all`}>{u.email}</td>
                          <td className={td}>
                            <span
                              className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${
                                ROLE_BADGE[u.role]
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className={`${td} whitespace-nowrap text-[#999]`}>{formatDate(u.created_at)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!loading && rows.length === 0 && <EmptyState icon="users" title="No accounts found" />}
              </div>

              {/* Mobile Card List */}
              <div className="min-[701px]:hidden space-y-3">
                {loading ? (
                  <div className="py-8 text-center text-[13px] text-[#888]">Loading accounts…</div>
                ) : rows.length === 0 ? (
                  <EmptyState icon="users" title="No accounts found" />
                ) : (
                  rows.map((u) => (
                    <div
                      key={u.user_id}
                      className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-3.5 dark:border-night-line dark:bg-night-head"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <strong className="block truncate text-[14.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{u.name}</strong>
                          <span className="block break-all text-[12.5px] text-[#777] dark:text-[#aaa]">{u.email}</span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            ROLE_BADGE[u.role]
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <div className="mt-2 text-right text-[11.5px] text-[#aaa]">
                        Joined {formatDate(u.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
