import { useMemo, useRef, useState } from "react";
import UserAvatar from "../Avatar.jsx";
import LogoutModal from "../LogoutModal.jsx";
import ChangePasswordForm from "../ChangePasswordForm.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls } from "../styles.js";
import { setPrefs, toggleDark, usePrefs } from "../../store/prefs.js";
import { setProfile, useProfile } from "../../store/profile.js";
import { toast } from "../../store/toast.js";
import { getUser } from "../../api.js";
import {
  MOBILE_NUMBER_MAX_LENGTH,
  sanitizeMobileNumber,
  validateMobileNumber,
} from "../../utils/phone.js";

const SIZES = [
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
];

function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "—";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local[0]}*****${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return "Not set";
  const s = String(phone).trim();
  if (s.length < 7) return s;
  return `${s.slice(0, 4)}****${s.slice(-3)}`;
}

function resizeImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function UnifiedSettings() {
  const user = getUser();
  const profile = useProfile();
  const prefs = usePrefs();
  const themeMode = prefs.themeMode || (dark ? "dark" : "light");
  const isSystemTheme = themeMode === "system";

  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("account-info");
  const [revealEmail, setRevealEmail] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Inline profile edit state
  const [name, setName] = useState(profile.name === "Guest" ? "" : profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || user?.phone || user?.contact_number || "");
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const accountRef = useRef(null);
  const passwordRef = useRef(null);
  const appearanceRef = useRef(null);
  const notificationsRef = useRef(null);
  const languageRef = useRef(null);
  const accessibilityRef = useRef(null);

  const formattedUserId =
    user?.user_id !== undefined && user?.user_id !== null && String(user.user_id).trim() !== ""
      ? `#${String(user.user_id).padStart(4, "0")}`
      : "#0001";

  const displayPhone = profile.phone || user?.phone || user?.contact_number || "";
  const displayEmail = profile.email || user?.email || "";

  const jumpTo = (key, ref) => {
    setActiveNav(key);
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openEditProfile = () => {
    setName(profile.name === "Guest" ? "" : profile.name);
    setEmail(displayEmail);
    setPhone(displayPhone);
    setErrors({});
    setEditingProfile(true);
    jumpTo("account-info", accountRef);
  };

  const saveProfile = (e) => {
    e.preventDefault();
    const err = {};
    if (!name.trim()) err.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) err.email = "Please enter a valid email address.";
    const phoneErr = validateMobileNumber(phone, { required: false, label: "Mobile number" });
    if (phoneErr) err.phone = phoneErr;
    setErrors(err);
    if (Object.keys(err).length) return;
    setProfile({ name: name.trim(), email: email.trim(), phone: sanitizeMobileNumber(phone) });
    setEditingProfile(false);
    toast("Profile saved.");
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please choose an image file.", "error");
    try {
      setProfile({ avatar: await resizeImage(file) });
      toast("Profile picture updated.");
    } catch {
      toast("Could not read that image.", "error");
    }
    e.target.value = "";
  };

  const q = search.trim().toLowerCase();
  const showAccount = useMemo(
    () => !q || "account info username email phone profile".includes(q),
    [q]
  );
  const showSecurity = useMemo(
    () => !q || "password security change password".includes(q),
    [q]
  );
  const showAppearance = useMemo(
    () => !q || "appearance display dark mode text size".includes(q),
    [q]
  );
  const showNotifications = useMemo(
    () => !q || "notifications popup sound email alerts parcel verification messages announcements".includes(q),
    [q]
  );
  const showLanguage = useMemo(
    () => !q || "language filipino english time format 12 hour 24 hour".includes(q),
    [q]
  );
  const showAccessibility = useMemo(
    () => !q || "accessibility reduced motion underline links keyboard shortcuts keybinds".includes(q),
    [q]
  );

  const notificationsOn = prefs.notificationsEnabled !== false;

  const toggleMasterNotifications = () => {
    const next = !notificationsOn;
    if (next) {
      setPrefs({
        notificationsEnabled: true,
        inAppPopups: true,
        sound: true,
        notifyParcel: true,
        notifyVerification: true,
        notifyMessages: true,
        notifyAnnouncements: true,
      });
      toast("Notifications enabled.", "info");
    } else {
      setPrefs({
        notificationsEnabled: false,
        inAppPopups: false,
        sound: false,
        emailAlerts: false,
        notifyParcel: false,
        notifyVerification: false,
        notifyMessages: false,
        notifyAnnouncements: false,
      });
      toast("All notifications turned off.", "info");
    }
  };

  const togglePref = (key, label) => {
    const current = key === "emailAlerts" ? Boolean(prefs[key]) : prefs[key] !== false && notificationsOn;
    const next = !current;
    setPrefs({
      [key]: next,
      ...(next ? { notificationsEnabled: true } : {}),
    });
    toast(`${label} ${next ? "enabled" : "disabled"}.`, "info");
  };

  return (
    <>
      <div className="grid grid-cols-[270px_1fr] items-start gap-6 max-[920px]:grid-cols-1">
        {/* LEFT SETTINGS SIDEBAR CARD */}
        <aside className="flex flex-col rounded-2xl border-[1.5px] border-brand/35 bg-white p-4 shadow-xs dark:border-brand/30 dark:bg-night-panel">
          {/* User Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-brand-line dark:border-night-line">
            <UserAvatar className="h-12 w-12 shrink-0 text-[18px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <strong className="truncate text-[15px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                  {profile.name}
                </strong>
                <span className="text-[12px] font-semibold text-[#64748b] dark:text-[#b8b0a8]">
                  {formattedUserId}
                </span>
              </div>
              <button
                type="button"
                onClick={openEditProfile}
                className="mt-0.5 text-[12px] font-semibold text-brand hover:underline"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Search Settings */}
          <div className="relative my-3.5">
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Settings"
              aria-label="Search Settings"
              className="h-9 w-full rounded-lg border border-[#cbd5e1] bg-[#f8fafc] pl-8 pr-3 text-[12.5px] text-ink outline-none focus:border-brand focus:bg-white dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]"
            />
          </div>

          {/* Navigation Groups */}
          <nav className="space-y-1 text-[13.5px]" aria-label="Settings sections">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 font-bold text-[#1e293b] dark:text-[#f1eeeb]">
              <i className="fa-solid fa-user text-[13px] text-[#334155] dark:text-[#d1c9c2]" />
              <span>Account</span>
            </div>

            <div className="ml-3 space-y-0.5 border-l border-[#e2e8f0] pl-2.5 dark:border-night-line">
              <button
                type="button"
                onClick={() => jumpTo("account-info", accountRef)}
                className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                  activeNav === "account-info"
                    ? "bg-brand-soft font-bold text-brand dark:bg-night-head"
                    : "text-[#475569] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
                }`}
              >
                <span>Account Info</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPasswordOpen(true);
                  jumpTo("password", passwordRef);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                  activeNav === "password"
                    ? "bg-brand-soft font-bold text-brand dark:bg-night-head"
                    : "text-[#475569] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
                }`}
              >
                <span>Password &amp; Security</span>
              </button>

              <button
                type="button"
                onClick={() => jumpTo("status", accountRef)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                  activeNav === "status"
                    ? "bg-brand-soft font-bold text-brand dark:bg-night-head"
                    : "text-[#475569] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
                }`}
              >
                <span>Account Status</span>
                <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand">
                  Verified
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => jumpTo("appearance", appearanceRef)}
              className={`mt-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
                activeNav === "appearance"
                  ? "bg-brand-soft text-brand dark:bg-night-head"
                  : "text-[#334155] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
              }`}
            >
              <i className="fa-solid fa-palette text-[13px]" />
              <span>Appearance &amp; Display</span>
            </button>

            <button
              type="button"
              onClick={() => jumpTo("notifications", notificationsRef)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
                activeNav === "notifications"
                  ? "bg-brand-soft text-brand dark:bg-night-head"
                  : "text-[#334155] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
              }`}
            >
              <i className="fa-solid fa-bell text-[13px]" />
              <span>Notifications</span>
            </button>

            <button
              type="button"
              onClick={() => jumpTo("language", languageRef)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
                activeNav === "language"
                  ? "bg-brand-soft text-brand dark:bg-night-head"
                  : "text-[#334155] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
              }`}
            >
              <i className="fa-solid fa-language text-[13px]" />
              <span>Language &amp; Time</span>
            </button>

            <button
              type="button"
              onClick={() => jumpTo("accessibility", accessibilityRef)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
                activeNav === "accessibility"
                  ? "bg-brand-soft text-brand dark:bg-night-head"
                  : "text-[#334155] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
              }`}
            >
              <i className="fa-solid fa-universal-access text-[13px]" />
              <span>Accessibility</span>
            </button>
          </nav>

          {/* Log Out Footer */}
          <div className="mt-6 border-t border-brand-line pt-3 dark:border-night-line">
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-bold text-[#c23a3a] transition hover:bg-red-50 dark:text-[#f2a1a1] dark:hover:bg-red-950/30"
            >
              <i className="fa-solid fa-right-from-bracket text-[13px]" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* RIGHT SETTINGS CONTENT CARD */}
        <section className="rounded-2xl border-[1.5px] border-brand/45 border-t-[3px] border-t-brand bg-white p-7 shadow-xs dark:border-brand/35 dark:border-t-brand dark:bg-night-panel max-[600px]:p-4">
          {/* 1. ACCOUNT INFO */}
          {showAccount && (
            <div ref={accountRef} className="scroll-mt-20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                  Account Info
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11.5px] font-bold text-brand capitalize">
                  <i className="fa-solid fa-circle-check text-[10px]" />
                  {profile.role} · {formattedUserId}
                </span>
              </div>

              {/* Warm Orange Hub / Portal Notice */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-soft/75 px-4 py-3 dark:border-night-line dark:bg-night-head">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#7c2d12] dark:text-[#ffb98a]">
                  <i className="fa-solid fa-warehouse text-brand" />
                  <span>LogiSync × SPX Express · {profile.role} Portal Account</span>
                </div>
                <button
                  type="button"
                  onClick={() => (editingProfile ? setEditingProfile(false) : openEditProfile())}
                  className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-[12px] font-bold text-[#1e293b] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]"
                >
                  {editingProfile ? "Cancel Edit" : "Edit Profile"}
                </button>
              </div>

              {editingProfile ? (
                <form onSubmit={saveProfile} noValidate className="mb-6 rounded-xl border border-brand-line bg-brand-softer/60 p-5 dark:border-night-line dark:bg-night-head/50">
                  <div className="mb-5 flex flex-wrap items-center gap-4">
                    <UserAvatar className="h-16 w-16 text-[22px]" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>
                        <i className="fa-solid fa-camera" /> Change photo
                      </button>
                      {profile.avatar && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfile({ avatar: "" });
                            toast("Photo removed.");
                          }}
                          className={btnGhost}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
                    <div>
                      <label className={labelCls} htmlFor="set-name">Full name / Username</label>
                      <input id="set-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                      {errors.name && <p className="mt-1 text-[12px] text-[#d94747]">{errors.name}</p>}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="set-email">Email</label>
                      <input id="set-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                      {errors.email && <p className="mt-1 text-[12px] text-[#d94747]">{errors.email}</p>}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="set-phone">Phone Number</label>
                      <input
                        id="set-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={MOBILE_NUMBER_MAX_LENGTH}
                        value={phone}
                        onChange={(e) => {
                          setPhone(sanitizeMobileNumber(e.target.value));
                          setErrors((er) => ({ ...er, phone: undefined }));
                        }}
                        placeholder="e.g. 09171234567"
                        className={inputCls}
                      />
                      {errors.phone && <p className="mt-1 text-[12px] text-[#d94747]">{errors.phone}</p>}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="set-role">Role</label>
                      <input id="set-role" value={profile.role} disabled className={`${inputCls} opacity-60`} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" className={btnPrimary}>
                      <i className="fa-solid fa-floppy-disk" /> Save Changes
                    </button>
                    <button type="button" onClick={() => setEditingProfile(false)} className={btnGhost}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="divide-y divide-[#edf0f4] dark:divide-night-line">
                  <div className="flex items-center justify-between gap-4 py-3.5 max-[600px]:flex-wrap">
                    <span className="text-[14px] font-medium text-[#475569] dark:text-[#b8b0a8]">Username</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">{profile.name}</span>
                      <button type="button" onClick={openEditProfile} className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1 text-[12px] font-semibold text-[#1e293b] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]">
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3.5 max-[600px]:flex-wrap">
                    <span className="text-[14px] font-medium text-[#475569] dark:text-[#b8b0a8]">Email</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                        {revealEmail ? displayEmail || "—" : maskEmail(displayEmail)}
                      </span>
                      {displayEmail && (
                        <button
                          type="button"
                          onClick={() => setRevealEmail((v) => !v)}
                          className="text-[12px] font-semibold text-brand hover:underline"
                        >
                          {revealEmail ? "Hide" : "Reveal"}
                        </button>
                      )}
                      <button type="button" onClick={openEditProfile} className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1 text-[12px] font-semibold text-[#1e293b] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]">
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3.5 max-[600px]:flex-wrap">
                    <span className="text-[14px] font-medium text-[#475569] dark:text-[#b8b0a8]">Phone Number</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                        {maskPhone(displayPhone)}
                      </span>
                      <button type="button" onClick={openEditProfile} className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1 text-[12px] font-semibold text-[#1e293b] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. PASSWORD & SECURITY (No Multi-Factor / Google Auth) */}
          {showSecurity && (
            <div ref={passwordRef} className="mt-6 border-t border-brand-line pt-6 scroll-mt-20 dark:border-night-line">
              <h3 className="mb-3 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Password &amp; Security
              </h3>

              <div className="flex items-center justify-between gap-4 py-2 max-[600px]:flex-wrap">
                <span className="text-[14px] font-medium text-[#475569] dark:text-[#b8b0a8]">Password</span>
                <div className="flex items-center gap-3">
                  <span className="tracking-widest text-[14px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                    ••••••••••••
                  </span>
                  <button
                    type="button"
                    onClick={() => setPasswordOpen((v) => !v)}
                    className="rounded-lg border border-brand/50 bg-brand-softer px-3.5 py-1.5 text-[12.5px] font-bold text-brand transition hover:bg-brand hover:text-white dark:bg-night-head"
                  >
                    {passwordOpen ? "Hide Form" : "Change Password"}
                  </button>
                </div>
              </div>

              {passwordOpen && (
                <div className="mt-4 rounded-xl border border-brand-line bg-brand-softer/50 p-5 dark:border-night-line dark:bg-night-head/50">
                  <ChangePasswordForm desktopSplit />
                </div>
              )}
            </div>
          )}

          {/* 3. APPEARANCE & DISPLAY */}
          {showAppearance && (
            <div ref={appearanceRef} className="mt-6 border-t border-brand-line pt-6 scroll-mt-20 dark:border-night-line">
              <h3 className="mb-1 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Appearance &amp; Display
              </h3>
              <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Choose your theme or sync automatically with your device appearance.
              </p>

              {/* Same as Device Theme */}
              <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-brand-line bg-brand-softer/35 px-4 py-3 dark:border-night-line dark:bg-night-head/40">
                <div className="min-w-0">
                  <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                    Same as Device Theme
                  </strong>
                  <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                    Match your device&apos;s light or dark mode automatically.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSystemTheme}
                  aria-label="Same as Device Theme"
                  onClick={() => {
                    const nextMode = isSystemTheme ? (prefs.dark ? "dark" : "light") : "system";
                    setPrefs({ themeMode: nextMode });
                    toast(nextMode === "system" ? "Synced with device theme." : "Using manual theme.", "info");
                  }}
                  className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors ${
                    isSystemTheme ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                      isSystemTheme ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Default Themes Swatch Picker (Discord-inspired) */}
              <div className="mb-5">
                <span className="mb-2.5 block text-[12px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  Default Themes
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { key: "light", label: "Light", swatch: "bg-white border-[#cbd5e1]" },
                    { key: "dark", label: "Dark", swatch: "bg-[#292522] border-[#48413c]" },
                    { key: "system", label: "Device", swatch: "bg-gradient-to-br from-white via-[#cbd5e1] to-[#1e293b] border-[#94a3b8]", icon: "fa-arrows-rotate" },
                  ].map((item) => {
                    const active = themeMode === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setPrefs({ themeMode: item.key });
                          toast(`${item.label} theme applied.`, "info");
                        }}
                        title={`${item.label} theme`}
                        aria-label={`${item.label} theme`}
                        aria-pressed={active}
                        className={`relative flex h-12 w-12 items-center justify-center rounded-xl border-2 transition ${item.swatch} ${
                          active
                            ? "!border-brand ring-2 ring-brand/25 scale-[1.03]"
                            : "hover:border-brand/60"
                        }`}
                      >
                        {item.icon && (
                          <i className={`fa-solid ${item.icon} text-[14px] text-[#1e293b] drop-shadow-xs`} />
                        )}
                        {active && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white shadow-xs">
                            <i className="fa-solid fa-check" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Size */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div>
                  <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                    Text Size
                  </strong>
                  <span className="text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                    Adjust display scale across portals.
                  </span>
                </div>
                <div className="inline-flex rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-1 dark:border-night-line dark:bg-night-head">
                  {SIZES.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPrefs({ fontSize: key })}
                      aria-pressed={prefs.fontSize === key}
                      className={`rounded-lg px-3.5 py-1 text-[12.5px] font-semibold transition ${
                        prefs.fontSize === key
                          ? "bg-brand text-white shadow-xs"
                          : "text-[#475569] hover:text-brand dark:text-[#d1c9c2]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. NOTIFICATIONS */}
          {showNotifications && (
            <div ref={notificationsRef} className="mt-6 border-t border-brand-line pt-6 scroll-mt-20 dark:border-night-line">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                    Notifications
                  </h3>
                  <p className="mt-0.5 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                    Control top-right popup alerts, sound, email updates, and which notifications appear in your bell.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={`text-[12px] font-bold ${notificationsOn ? "text-brand" : "text-[#94a3b8]"}`}>
                    {notificationsOn ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsOn}
                    aria-label="Enable all notifications"
                    onClick={toggleMasterNotifications}
                    className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
                      notificationsOn ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        notificationsOn ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className={`space-y-5 transition-opacity ${notificationsOn ? "opacity-100" : "opacity-55"}`}>
                <div>
                  <h4 className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    Delivery Channels
                  </h4>
                  <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/35 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                    {[
                      ["inAppPopups", "In-App Popup Alerts", "Show a brief top-right popup under the bell when new updates arrive."],
                      ["sound", "Alert Sound", "Play a subtle chime for new announcements and urgent alerts."],
                      ["emailAlerts", "Email Alerts", "Also send critical account and parcel alerts to your email."],
                    ].map(([key, label, hint]) => {
                      const checked = notificationsOn && (key === "emailAlerts" ? Boolean(prefs[key]) : prefs[key] !== false);
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">{label}</strong>
                            <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{hint}</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={label}
                            onClick={() => togglePref(key, label)}
                            className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors ${
                              checked ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                            }`}
                          >
                            <span
                              className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                                checked ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    Alert Categories
                  </h4>
                  <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/35 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                    {[
                      ["notifyParcel", "Parcel & Delivery Updates", "Assignments, transit updates, deliveries, and return-to-hub notices."],
                      ["notifyVerification", "Verification & Video Status", "Packing video approvals, re-upload requests, and verification flags."],
                      ["notifyMessages", "Messages & Complaints", "Direct chat messages and complaint or request status replies."],
                      ["notifyAnnouncements", "Hub Announcements", "Important operational advisories posted by coordinators."],
                    ].map(([key, label, hint]) => {
                      const checked = notificationsOn && prefs[key] !== false;
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">{label}</strong>
                            <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{hint}</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={label}
                            onClick={() => togglePref(key, label)}
                            className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors ${
                              checked ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                            }`}
                          >
                            <span
                              className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                                checked ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. LANGUAGE & TIME */}
          {showLanguage && (
            <div ref={languageRef} className="mt-6 border-t border-brand-line pt-6 scroll-mt-20 dark:border-night-line">
              <h3 className="mb-1 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Language &amp; Time
              </h3>
              <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Choose your preferred display language and time format.
              </p>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-softer/35 px-4 py-3 dark:border-night-line dark:bg-night-head/40">
                  <div>
                    <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                      Select a Language
                    </strong>
                    <span className="text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                      Switch navigation and portal labels between English and Filipino.
                    </span>
                  </div>
                  <div className="inline-flex rounded-xl border border-[#cbd5e1] bg-white p-1 dark:border-night-line dark:bg-night-panel">
                    {[
                      ["en", "English"],
                      ["fil", "Filipino"],
                    ].map(([code, label]) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setPrefs({ lang: code });
                          toast(`Language set to ${label}.`, "info");
                        }}
                        aria-pressed={(prefs.lang || "en") === code}
                        className={`rounded-lg px-3.5 py-1 text-[12.5px] font-semibold transition ${
                          (prefs.lang || "en") === code
                            ? "bg-brand text-white shadow-xs"
                            : "text-[#475569] hover:text-brand dark:text-[#d1c9c2]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-softer/35 px-4 py-3 dark:border-night-line dark:bg-night-head/40">
                  <div>
                    <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                      Time Format
                    </strong>
                    <span className="text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                      Choose 12-hour or 24-hour timestamps across tables and logs.
                    </span>
                  </div>
                  <div className="inline-flex rounded-xl border border-[#cbd5e1] bg-white p-1 dark:border-night-line dark:bg-night-panel">
                    {[
                      ["auto", "Auto"],
                      ["12h", "12-hour"],
                      ["24h", "24-hour"],
                    ].map(([tf, label]) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => {
                          setPrefs({ timeFormat: tf });
                          toast(`Time format set to ${label}.`, "info");
                        }}
                        aria-pressed={(prefs.timeFormat || "auto") === tf}
                        className={`rounded-lg px-3 py-1 text-[12.5px] font-semibold transition ${
                          (prefs.timeFormat || "auto") === tf
                            ? "bg-brand text-white shadow-xs"
                            : "text-[#475569] hover:text-brand dark:text-[#d1c9c2]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. ACCESSIBILITY & KEYBOARD SHORTCUTS */}
          {showAccessibility && (
            <div ref={accessibilityRef} className="mt-6 border-t border-brand-line pt-6 scroll-mt-20 dark:border-night-line">
              <h3 className="mb-1 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Accessibility &amp; Shortcuts
              </h3>
              <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Adjust motion, link visibility, and view quick keyboard shortcuts.
              </p>

              <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/35 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                {[
                  ["reducedMotion", "Reduced Motion", "Minimize transitions and animations across the portal."],
                  ["underlineLinks", "Always Underline Links", "Make clickable links stand out clearly inside pages."],
                ].map(([key, label, hint]) => {
                  const checked = Boolean(prefs[key]);
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">{label}</strong>
                        <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{hint}</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        aria-label={label}
                        onClick={() => {
                          setPrefs({ [key]: !checked });
                          toast(`${label} ${!checked ? "enabled" : "disabled"}.`, "info");
                        }}
                        className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors ${
                          checked ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                        }`}
                      >
                        <span
                          className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                            checked ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 dark:border-night-line dark:bg-night-head/40">
                <h4 className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  Keyboard Shortcuts
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] max-[640px]:grid-cols-1">
                  {[
                    ["Dashboard", ["G", "D"]],
                    ["Parcel Records", ["G", "P"]],
                    ["Verification", ["G", "V"]],
                    ["Messages", ["G", "M"]],
                    ["Notifications", ["G", "N"]],
                    ["Open Help", ["?"]],
                  ].map(([action, keys]) => (
                    <div key={action} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-[#475569] dark:text-[#d1c9c2]">{action}</span>
                      <span className="flex items-center gap-1">
                        {keys.map((k) => (
                          <kbd
                            key={k}
                            className="rounded border border-[#cbd5e1] bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#1e293b] shadow-2xs dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showAccount && !showSecurity && !showAppearance && !showNotifications && !showLanguage && !showAccessibility && (
            <p className="py-10 text-center text-[13.5px] text-[#64748b]">
              No settings match &ldquo;{search}&rdquo;.
            </p>
          )}
        </section>
      </div>

      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}

