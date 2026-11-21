import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserAvatar from "../Avatar.jsx";
import LogoutModal from "../LogoutModal.jsx";
import ChangePasswordForm from "../ChangePasswordForm.jsx";
import { setPrefs, usePrefs } from "../../store/prefs.js";
import { saveProfileToServer, syncProfileFromServer, useProfile } from "../../store/profile.js";
import { toast } from "../../store/toast.js";
import { previewTone } from "../../utils/sound.js";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";
import {
  COPYRIGHT_OWNER,
  EFFECTIVE_DATE,
  POLICY_VERSION,
  PRIVACY_SECTIONS,
  REPUBLIC_ACTS,
} from "../../data/terms.js";
import {
  disableDesktopWebPush,
  enableDesktopWebPush,
  inspectPushState,
  resolvePushStatusDisplay,
} from "../../utils/webPush.js";
import {
  PHILIPPINE_LOCAL_MAX_LENGTH,
  formatPlus63Phone,
  sanitizeLocalMobileDigits,
  validateMobileNumber,
} from "../../utils/phone.js";

const TEXT_SIZES = [
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
];

const SECTION_TITLES = {
  "": "Settings",
  account: "Account Settings",
  notifications: "Notifications",
  appearance: "Appearance & Display",
  accessibility: "Accessibility",
  privacy: "Privacy Policy",
  about: "About LOGISYNC",
};

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
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Toggle({ checked, disabled = false, label, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-brand" : "bg-slate-300 dark:bg-night-line"
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function RiderMobileSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = (searchParams.get("section") || "").toLowerCase();
  const section = Object.prototype.hasOwnProperty.call(SECTION_TITLES, rawSection) ? rawSection : "";

  const profile = useProfile();
  const prefs = usePrefs();
  const themeMode = prefs.themeMode || (prefs.dark ? "dark" : "light");

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Account Settings form state (bound to live authenticated Rider record)
  const [name, setName] = useState(profile.name === "Guest" ? "" : profile.name);
  const [email, setEmail] = useState(profile.email || "");
  const [localPhone, setLocalPhone] = useState(() => sanitizeLocalMobileDigits(profile.phone || ""));
  const [errors, setErrors] = useState({});
  const [savingAccount, setSavingAccount] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const fileRef = useRef(null);

  // Push notification status
  const [pushState, setPushState] = useState(() => ({
    supported: true,
    permission: typeof Notification !== "undefined" ? Notification.permission : "default",
    subscribed: false,
    loading: false,
  }));

  useEffect(() => {
    document.title = `${SECTION_TITLES[section] || "Settings"} · LogiSync`;
  }, [section]);

  useEffect(() => {
    syncProfileFromServer();
  }, []);

  // Keep form synced whenever DB profile loads/refreshes
  useEffect(() => {
    setName(profile.name === "Guest" ? "" : profile.name);
    setEmail(profile.email || "");
    setLocalPhone(sanitizeLocalMobileDigits(profile.phone || ""));
  }, [profile.name, profile.email, profile.phone]);

  useEffect(() => {
    let alive = true;
    inspectPushState().then((s) => {
      if (alive) setPushState((prev) => ({ ...prev, ...s }));
    });
    return () => {
      alive = false;
    };
  }, [profile.userId]);

  const riderIdDisplay =
    profile.riderCode ||
    (profile.userId !== null && profile.userId !== undefined && String(profile.userId).trim() !== ""
      ? `RID-${String(profile.userId).padStart(4, "0")}`
      : "RID-0001");

  const openSection = (next) => {
    setSavedNotice("");
    setErrors({});
    if (!next) {
      setSearchParams({}, { replace: false });
    } else {
      setSearchParams({ section: next }, { replace: false });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBack = () => {
    if (section) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        openSection("");
      }
      return;
    }
    navigate("/rider/profile");
  };

  const handleChangePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file (JPG, PNG, or WebP).", "error");
      e.target.value = "";
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      await saveProfileToServer({ avatar: dataUrl });
      toast("Profile photo updated.");
    } catch (ex) {
      toast(ex?.message || "Could not update profile photo.", "error");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      await saveProfileToServer({ avatar: "" });
      toast("Profile photo removed.", "info");
    } catch (ex) {
      toast(ex?.message || "Could not remove profile photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (savingAccount) return;
    setSavedNotice("");

    const nextErr = {};
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const formattedPhone = localPhone ? formatPlus63Phone(localPhone) : "";

    if (!cleanName) nextErr.name = "Full name is required.";
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      nextErr.email = "Please enter a valid email address.";
    }
    if (localPhone) {
      const phoneErr = validateMobileNumber(formattedPhone, { required: false, label: "Contact number" });
      if (phoneErr) nextErr.phone = "Enter a valid 10-digit PH mobile number starting with 9 (e.g. +63 912 345 6789).";
    }

    setErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    setSavingAccount(true);
    try {
      await saveProfileToServer({
        name: cleanName,
        email: cleanEmail,
        phone: formattedPhone,
      });
      setSavedNotice("Your account details have been updated.");
      toast("Account updated successfully.");
    } catch (ex) {
      const msg = ex?.message || "Failed to update account details.";
      if (/email/i.test(msg)) setErrors((prev) => ({ ...prev, email: msg }));
      else if (/contact|phone|mobile/i.test(msg)) setErrors((prev) => ({ ...prev, phone: msg }));
      else setErrors((prev) => ({ ...prev, form: msg }));
      toast(msg, "error");
    } finally {
      setSavingAccount(false);
    }
  };

  // Notification handlers (exact parity with existing LOGISYNC preferences)
  const notificationsOn = prefs.notificationsEnabled !== false;

  const toggleMasterNotifications = () => {
    const next = !notificationsOn;
    if (next) {
      setPrefs({
        notificationsEnabled: true,
        inAppNotifications: true,
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
        inAppNotifications: false,
        inAppPopups: false,
        sound: false,
      });
      toast("All notifications and sounds turned off.", "info");
    }
  };

  const togglePref = (key, label) => {
    const current = prefs[key] !== false && notificationsOn;
    const next = !current;
    setPrefs({
      [key]: next,
      ...(next ? { notificationsEnabled: true } : {}),
    });
    toast(`${label} ${next ? "enabled" : "disabled"}.`, "info");
  };

  const pushDisplay = resolvePushStatusDisplay({
    supported: pushState.supported,
    permission: pushState.permission,
    subscribed: pushState.subscribed && prefs.browserPushEnabled !== false,
  });
  const isBrowserPushOn = notificationsOn && pushDisplay.key === "granted";

  const handleToggleBrowserPush = async () => {
    if (pushState.loading) return;
    setPushState((s) => ({ ...s, loading: true }));
    try {
      if (isBrowserPushOn) {
        const res = await disableDesktopWebPush();
        setPushState((s) => ({ ...s, ...res, loading: false }));
        toast("Browser push notifications disabled.", "info");
      } else {
        const res = await enableDesktopWebPush();
        if (res.ok) {
          setPushState((s) => ({
            ...s,
            supported: true,
            permission: "granted",
            subscribed: true,
            loading: false,
          }));
          if (!notificationsOn) setPrefs({ notificationsEnabled: true });
          toast("Browser push enabled for Hub Announcements.");
        } else {
          const inspected = await inspectPushState();
          setPushState((s) => ({ ...s, ...inspected, loading: false }));
          if (res.reason === "denied") {
            toast("Browser notification permission is denied. Enable it in browser settings.", "error");
          } else if (res.reason === "unsupported") {
            toast("Browser push notifications are not supported in this browser.", "error");
          } else {
            toast("Notification permission was not granted.", "info");
          }
        }
      }
    } catch (err) {
      const inspected = await inspectPushState();
      setPushState((s) => ({ ...s, ...inspected, loading: false }));
      toast(err?.message || "Could not update browser push settings.", "error");
    }
  };

  const riderShortcuts = useMemo(
    () => [
      ["Go to Home", "Open your rider home screen", ["G", "D"]],
      ["Scan QR Code", "Open QR scanner for delivery", ["G", "V"]],
      ["Go to My Deliveries", "Manage active deliveries", ["G", "L"]],
      ["Go to Messages", "Open direct chat with coordinator", ["G", "M"]],
      ["Go to Notifications", "View all bell alerts", ["G", "N"]],
      ["Go to Activity Log", "Inspect recent rider activity", ["G", "A"]],
      ["Go to Settings", "Open account and app settings", ["G", "S"]],
      ["Open Help / FAQs", "View guides and FAQ", ["?"]],
      ["Close Dialog / Modal", "Dismiss open dialogs", ["ESC"]],
    ],
    []
  );

  const cardCls =
    "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel";

  const fieldCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-[14.5px] font-medium text-[#0f172a] outline-none transition focus:border-brand focus:bg-white focus:ring-3 focus:ring-brand/15 dark:border-night-line dark:bg-night-head dark:text-white dark:focus:bg-night-head";

  return (
    <>
      <div className="min-h-[calc(100dvh-124px)] w-full bg-[#f7f8fb] pb-6 dark:bg-night-bg">
        {/* Sticky Mobile Sub-Header: Back Arrow Left + Centered Title */}
        <div className="sticky top-14 z-30 flex h-[52px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md dark:border-night-line dark:bg-night-panel/95">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0f172a] transition active:scale-95 hover:bg-slate-100 dark:text-white dark:hover:bg-night-head"
          >
            <i className="fa-solid fa-arrow-left text-[17px]" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-[16.5px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            {SECTION_TITLES[section] || "Settings"}
          </h1>
          <span className="h-10 w-10 shrink-0" aria-hidden="true" />
        </div>

        {/* =================================================================
            MAIN SETTINGS INDEX MENU
        ================================================================= */}
        {section === "" && (
          <div className="mx-auto max-w-xl space-y-5 px-4 pt-4">
            <div className={`${cardCls} divide-y divide-slate-100 dark:divide-night-line`}>
              {[
                {
                  key: "account",
                  icon: "fa-regular fa-user",
                  title: "Account Settings",
                  subtitle: "Update account details & password",
                },
                {
                  key: "notifications",
                  icon: "fa-regular fa-bell",
                  title: "Notification Preferences",
                  subtitle: "Manage channels, categories & sound",
                },
                {
                  key: "appearance",
                  icon: "fa-solid fa-palette",
                  title: "Appearance & Display",
                  subtitle: "Theme, text size & display options",
                },
                {
                  key: "accessibility",
                  icon: "fa-solid fa-universal-access",
                  title: "Accessibility",
                  subtitle: "Keyboard shortcuts, contrast & focus",
                },
              ].map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => openSection(row.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/80 dark:hover:bg-night-head/70"
                >
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-brand">
                      <i className={`${row.icon} text-[16px]`} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-[14.5px] font-bold text-[#0f172a] dark:text-white">
                        {row.title}
                      </strong>
                      <small className="block truncate text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                        {row.subtitle}
                      </small>
                    </span>
                  </span>
                  <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-slate-400" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-200/80 bg-[#fff2ef] px-4 py-3.5 text-[15px] font-bold text-[#c23a3a] transition active:scale-[0.99] hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300"
            >
              <i className="fa-solid fa-right-from-bracket text-[15px]" />
              <span>Log Out</span>
            </button>
          </div>
        )}

        {/* =================================================================
            1. ACCOUNT SETTINGS (EDIT PROFILE + CHANGE PASSWORD)
        ================================================================= */}
        {section === "account" && (
          <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
            <form onSubmit={handleUpdateAccount} noValidate className={`${cardCls} p-4 sm:p-5`}>
              {/* Avatar + Change Photo Row */}
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="relative shrink-0">
                  <div className="rounded-full p-0.5 ring-2 ring-brand/25">
                    <UserAvatar className="h-[74px] w-[74px] text-[26px]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingPhoto}
                    aria-label="Change profile photo"
                    className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#0f172a] text-white shadow-sm transition active:scale-95 hover:bg-brand dark:border-night-panel"
                  >
                    <i className="fa-solid fa-camera text-[10px]" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full border border-brand bg-white px-4 py-2 text-[13px] font-bold text-brand shadow-2xs transition active:scale-95 hover:bg-brand hover:text-white disabled:opacity-60 dark:bg-night-head"
                  >
                    {uploadingPhoto ? "Uploading…" : "Change Photo"}
                  </button>
                  {profile.avatar && (
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={handleRemovePhoto}
                      className="text-[12px] font-semibold text-slate-500 hover:text-red-600 dark:text-[#b8b0a8]"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChangePhoto}
                  className="hidden"
                />
              </div>

              {/* Editable Permitted Fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="rider-acc-name" className="mb-1.5 block text-[12.5px] font-bold text-slate-500 dark:text-[#b8b0a8]">
                    Full Name
                  </label>
                  <input
                    id="rider-acc-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((er) => ({ ...er, name: undefined, form: undefined }));
                      setSavedNotice("");
                    }}
                    placeholder="Enter your full name"
                    className={fieldCls}
                  />
                  {errors.name && <p className="mt-1 text-[12px] font-semibold text-[#d94747]">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="rider-acc-email" className="mb-1.5 block text-[12.5px] font-bold text-slate-500 dark:text-[#b8b0a8]">
                    Email Address
                  </label>
                  <input
                    id="rider-acc-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((er) => ({ ...er, email: undefined, form: undefined }));
                      setSavedNotice("");
                    }}
                    placeholder="rider@email.com"
                    className={fieldCls}
                  />
                  {errors.email && <p className="mt-1 text-[12px] font-semibold text-[#d94747]">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="rider-acc-phone" className="mb-1.5 block text-[12.5px] font-bold text-slate-500 dark:text-[#b8b0a8]">
                    Contact Number
                  </label>
                  <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 focus-within:border-brand focus-within:bg-white focus-within:ring-3 focus-within:ring-brand/15 dark:border-night-line dark:bg-night-head">
                    <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-100/90 px-3 py-2.5 text-[14px] font-bold text-slate-600 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]">
                      +63
                    </span>
                    <input
                      id="rider-acc-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={PHILIPPINE_LOCAL_MAX_LENGTH}
                      value={localPhone}
                      onChange={(e) => {
                        setLocalPhone(sanitizeLocalMobileDigits(e.target.value));
                        setErrors((er) => ({ ...er, phone: undefined, form: undefined }));
                        setSavedNotice("");
                      }}
                      placeholder="9123456789"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[14.5px] font-medium text-[#0f172a] outline-none dark:text-white"
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-[12px] font-semibold text-[#d94747]">{errors.phone}</p>}
                </div>
              </div>

              {errors.form && (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-[#c23a3a] dark:bg-red-950/30 dark:text-red-300">
                  <i className="fa-solid fa-circle-exclamation mr-1.5" />
                  {errors.form}
                </p>
              )}

              {savedNotice && (
                <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <i className="fa-solid fa-circle-check mr-1.5" />
                  {savedNotice}
                </p>
              )}

              <button
                type="submit"
                disabled={savingAccount}
                className="mt-5 w-full rounded-xl bg-brand py-3 text-[14.5px] font-extrabold text-white shadow-[0_6px_18px_rgba(238,77,45,0.28)] transition active:scale-[0.99] hover:bg-brand-dark disabled:opacity-60"
              >
                {savingAccount ? "Updating Account…" : "Update Account"}
              </button>
            </form>

            {/* Protected Coordinator-Managed Details (Read-Only) */}
            <div className={`${cardCls} p-4`}>
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                <i className="fa-solid fa-lock text-[11px]" />
                <span>Coordinator-Managed Details</span>
              </div>
              <div className="divide-y divide-slate-100 text-[13.5px] dark:divide-night-line">
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500 dark:text-[#b8b0a8]">Rider ID</span>
                  <strong className="font-mono text-[#0f172a] dark:text-white">{riderIdDisplay}</strong>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500 dark:text-[#b8b0a8]">Role</span>
                  <strong className="text-[#0f172a] dark:text-white">Rider</strong>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500 dark:text-[#b8b0a8]">Assigned Agency</span>
                  <strong className="text-right text-[#0f172a] dark:text-white">
                    {profile.agency || "Unassigned"}
                  </strong>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-slate-400 dark:text-[#9c948d]">
                Rider ID, role, and assigned agency are managed by your Hub Coordinator and cannot be edited here.
              </p>
            </div>

            {/* Password & Security Card (Preserves existing ChangePasswordForm) */}
            <div className={`${cardCls} p-4`}>
              <button
                type="button"
                onClick={() => setPasswordOpen((v) => !v)}
                aria-expanded={passwordOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-night-head">
                    <i className="fa-solid fa-key text-[14px]" />
                  </span>
                  <span>
                    <strong className="block text-[14.5px] font-bold text-[#0f172a] dark:text-white">
                      Change Password
                    </strong>
                    <small className="block text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                      Update your account login password
                    </small>
                  </span>
                </span>
                <i
                  className={`fa-solid fa-chevron-down text-[12px] text-slate-400 transition-transform ${
                    passwordOpen ? "rotate-180 text-brand" : ""
                  }`}
                />
              </button>

              {passwordOpen && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-night-line">
                  <ChangePasswordForm />
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================
            2. NOTIFICATION PREFERENCES (PRESERVES ALL EXISTING PREFS)
        ================================================================= */}
        {section === "notifications" && (
          <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
            {/* Header & Master Toggle Card */}
            <div className={`${cardCls} flex items-center justify-between gap-3 p-4`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-night-head">
                  <i className="fa-regular fa-bell text-[18px]" />
                </span>
                <div className="min-w-0">
                  <strong className="block text-[15px] font-extrabold text-[#0f172a] dark:text-white">
                    Notifications
                  </strong>
                  <span className="block text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                    Manage how you receive LOGISYNC updates.
                  </span>
                </div>
              </div>
              <Toggle
                checked={notificationsOn}
                label="Enable all notifications"
                onClick={toggleMasterNotifications}
              />
            </div>

            <div className={`space-y-4 transition-opacity ${notificationsOn ? "opacity-100" : "opacity-55"}`}>
              {/* 1. Notification Channels */}
              <div>
                <h2 className="mb-2 px-1 text-[13px] font-extrabold text-[#0f172a] dark:text-[#f1eeeb]">
                  1. Notification Channels
                </h2>
                <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                  {[
                    [
                      "inAppNotifications",
                      "fa-regular fa-bell",
                      "In-App Notifications",
                      "Controls alerts shown in the notification bell while keeping history.",
                    ],
                    [
                      "inAppPopups",
                      "fa-solid fa-mobile-screen-button",
                      "In-App Popup Alerts",
                      "Show floating banner alerts while actively using LOGISYNC.",
                    ],
                  ].map(([key, icon, label, hint]) => {
                    const checked = notificationsOn && prefs[key] !== false;
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                            <i className={`${icon} text-[13px]`} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                              {label}
                            </strong>
                            <span className="block text-[11.5px] leading-snug text-slate-500 dark:text-[#b8b0a8]">
                              {hint}
                            </span>
                          </div>
                        </div>
                        <Toggle
                          checked={checked}
                          disabled={!notificationsOn}
                          label={label}
                          onClick={() => togglePref(key, label)}
                        />
                      </div>
                    );
                  })}

                  {/* Browser Push Notifications — Exclusive to Hub Announcements */}
                  <div className="py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                          <i className="fa-solid fa-bullhorn text-[13px]" />
                        </span>
                        <div className="min-w-0">
                          <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                            Browser Push Notifications
                          </strong>
                          <span className="block text-[11.5px] leading-snug text-slate-500 dark:text-[#b8b0a8]">
                            Receive push alerts exclusively when a Coordinator publishes a Hub Announcement.
                          </span>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                              Announcements only
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                pushDisplay.key === "granted"
                                  ? "bg-[#eaf8ef] text-[#1f7a47] dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : pushDisplay.key === "denied"
                                    ? "bg-[#fff0f0] text-[#c23a3a] dark:bg-red-950/50 dark:text-red-300"
                                    : "bg-slate-100 text-slate-500 dark:bg-night-head dark:text-[#b8b0a8]"
                              }`}
                            >
                              {pushDisplay.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Toggle
                        checked={isBrowserPushOn}
                        disabled={!notificationsOn || pushState.loading || pushDisplay.key === "unsupported"}
                        label="Browser Push Notifications"
                        onClick={handleToggleBrowserPush}
                      />
                    </div>

                    {pushDisplay.key === "denied" && (
                      <p className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                        Notification permission is blocked in your browser. Allow notifications in site settings and refresh.
                      </p>
                    )}
                    {pushDisplay.key === "unsupported" && (
                      <p className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500 dark:border-night-line dark:bg-night-head dark:text-[#b8b0a8]">
                        Browser push requires a supported browser with Service Worker and Notification support over HTTPS or localhost.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Notification Categories */}
              <div>
                <h2 className="mb-2 px-1 text-[13px] font-extrabold text-[#0f172a] dark:text-[#f1eeeb]">
                  2. Notification Categories
                </h2>
                <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                  {[
                    [
                      "notifyParcel",
                      "fa-solid fa-box",
                      "Parcel & Delivery Updates",
                      "Assignments, transit updates, deliveries, and return-to-hub notices.",
                    ],
                    [
                      "notifyVerification",
                      "fa-solid fa-video",
                      "Verification & Video Status",
                      "Parcel clearance and dispatch verification readiness.",
                    ],
                    [
                      "notifyMessages",
                      "fa-regular fa-comment-dots",
                      "Messages & Complaints",
                      "Direct messages from coordinator and request updates.",
                    ],
                    [
                      "notifyAnnouncements",
                      "fa-solid fa-triangle-exclamation",
                      "Hub Announcements",
                      "Important operational advisories posted by coordinators.",
                    ],
                  ].map(([key, icon, label, hint]) => {
                    const checked = notificationsOn && prefs[key] !== false;
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                            <i className={`${icon} text-[13px]`} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                              {label}
                            </strong>
                            <span className="block text-[11.5px] leading-snug text-slate-500 dark:text-[#b8b0a8]">
                              {hint}
                            </span>
                          </div>
                        </div>
                        <Toggle
                          checked={checked}
                          disabled={!notificationsOn}
                          label={label}
                          onClick={() => togglePref(key, label)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Sound Preferences */}
              <div>
                <h2 className="mb-2 px-1 text-[13px] font-extrabold text-[#0f172a] dark:text-[#f1eeeb]">
                  3. Sound Preferences
                </h2>
                <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                  <div className="py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                          Alert Volume
                        </strong>
                        <span className="text-[11.5px] text-slate-500 dark:text-[#b8b0a8]">
                          Sound loudness for messages and hub announcements.
                        </span>
                      </div>
                      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-extrabold text-brand">
                        {prefs.soundVolume ?? 80}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!notificationsOn}
                      value={prefs.soundVolume ?? 80}
                      aria-label="Alert volume"
                      onChange={(e) => setPrefs({ soundVolume: Number(e.target.value) })}
                      onMouseUp={(e) => notificationsOn && previewTone("messages", Number(e.target.value))}
                      onTouchEnd={(e) => notificationsOn && previewTone("messages", Number(e.target.value))}
                      className="h-2 w-full cursor-pointer accent-brand"
                    />
                  </div>

                  {[
                    ["soundMessages", "notifyMessages", "messages", "Messages & Complaints"],
                    ["soundAnnouncements", "notifyAnnouncements", "announcements", "Hub Announcements"],
                  ].map(([soundKey, catKey, toneKey, label]) => {
                    const categoryActive = notificationsOn && prefs[catKey] !== false;
                    const checked = categoryActive && prefs.sound !== false && prefs[soundKey] !== false;
                    return (
                      <div key={soundKey} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                            {label}
                          </strong>
                          <button
                            type="button"
                            disabled={!categoryActive}
                            onClick={() => previewTone(toneKey)}
                            className="mt-0.5 text-[12px] font-semibold text-brand hover:underline disabled:opacity-50"
                          >
                            Preview Sound
                          </button>
                        </div>
                        <Toggle
                          checked={checked}
                          disabled={!categoryActive}
                          label={`${label} sound`}
                          onClick={() => {
                            const next = !checked;
                            setPrefs({
                              [soundKey]: next,
                              ...(next ? { sound: true, notificationsEnabled: true } : {}),
                            });
                            if (next) previewTone(toneKey);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast("Notification preferences saved.")}
              className="w-full rounded-xl bg-brand py-3 text-[14.5px] font-extrabold text-white shadow-[0_6px_18px_rgba(238,77,45,0.28)] transition active:scale-[0.99] hover:bg-brand-dark"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* =================================================================
            3. APPEARANCE & DISPLAY
        ================================================================= */}
        {section === "appearance" && (
          <div className="mx-auto max-w-xl space-y-5 px-4 pt-4">
            {/* Theme Preferences */}
            <div>
              <h2 className="mb-2 px-1 text-[12px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#b8b0a8]">
                Theme Mode
              </h2>
              <div
                role="radiogroup"
                aria-label="Theme Mode"
                className={`${cardCls} divide-y divide-slate-100 dark:divide-night-line`}
              >
                {[
                  {
                    key: "light",
                    label: "Light Mode",
                    hint: "Bright, clean daytime display.",
                    icon: "fa-sun",
                    badgeCls: "bg-amber-50 text-amber-500 border-amber-200",
                  },
                  {
                    key: "dark",
                    label: "Dark Mode",
                    hint: "Low-glare dark display for night routes.",
                    icon: "fa-moon",
                    badgeCls: "bg-[#0f172a] text-white border-slate-700",
                  },
                  {
                    key: "system",
                    label: "System Default",
                    hint: "Follow your device's light or dark setting.",
                    icon: "fa-arrows-rotate",
                    badgeCls: "bg-slate-100 text-[#0f172a] border-slate-300",
                  },
                ].map((opt) => {
                  const active = themeMode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setPrefs({ themeMode: opt.key });
                        toast(`${opt.label} applied.`, "info");
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 dark:active:bg-night-head"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[14px] ${opt.badgeCls}`}
                        >
                          <i className={`fa-solid ${opt.icon}`} />
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-[14px] font-bold text-[#0f172a] dark:text-white">
                            {opt.label}
                          </strong>
                          <small className="block text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                            {opt.hint}
                          </small>
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          active
                            ? "border-brand bg-brand text-white"
                            : "border-slate-300 bg-white dark:border-night-line dark:bg-night-head"
                        }`}
                      >
                        {active && <i className="fa-solid fa-check text-[10px]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text Size */}
            <div>
              <h2 className="mb-2 px-1 text-[12px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#b8b0a8]">
                Text Size
              </h2>
              <div className={`${cardCls} p-4`}>
                <p className="mb-3 text-[12.5px] text-slate-500 dark:text-[#b8b0a8]">
                  Adjust display font scale across the Rider portal.
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-night-head">
                  {TEXT_SIZES.map(([key, label]) => {
                    const active = prefs.fontSize === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPrefs({ fontSize: key });
                          toast(`Text size set to ${label}.`, "info");
                        }}
                        className={`rounded-lg py-2 text-[13px] font-bold transition ${
                          active
                            ? "bg-brand text-white shadow-xs"
                            : "text-slate-600 hover:text-brand dark:text-[#d1c9c2]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Display Toggles: Reduced Motion & Always Underline Links */}
            <div>
              <h2 className="mb-2 px-1 text-[12px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#b8b0a8]">
                Display Options
              </h2>
              <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                {[
                  [
                    "reducedMotion",
                    "Reduced Motion",
                    "Minimize animations and transition effects across screens.",
                  ],
                  [
                    "underlineLinks",
                    "Always Underline Links",
                    "Underline interactive text links for easier recognition.",
                  ],
                ].map(([key, label, hint]) => {
                  const checked = Boolean(prefs[key]);
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <strong className="block text-[14px] font-bold text-[#0f172a] dark:text-white">
                          {label}
                        </strong>
                        <span className="block text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                          {hint}
                        </span>
                      </div>
                      <Toggle
                        checked={checked}
                        label={label}
                        onClick={() => {
                          const next = !checked;
                          setPrefs({ [key]: next });
                          toast(`${label} ${next ? "enabled" : "disabled"}.`, "info");
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            4. ACCESSIBILITY
        ================================================================= */}
        {section === "accessibility" && (
          <div className="mx-auto max-w-xl space-y-5 px-4 pt-4">
            {/* Contrast & Focus Controls */}
            <div>
              <h2 className="mb-2 px-1 text-[12px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#b8b0a8]">
                Contrast &amp; Focus
              </h2>
              <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                {[
                  [
                    "highContrast",
                    "High Contrast Mode",
                    "Increase text, border, and button contrast for readability.",
                  ],
                  [
                    "enhancedFocus",
                    "Enhanced Focus Indicators",
                    "Show a prominent orange focus ring on focused controls.",
                  ],
                ].map(([key, label, hint]) => {
                  const checked = Boolean(prefs[key]);
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <strong className="block text-[14px] font-bold text-[#0f172a] dark:text-white">
                          {label}
                        </strong>
                        <span className="block text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                          {hint}
                        </span>
                      </div>
                      <Toggle
                        checked={checked}
                        label={label}
                        onClick={() => {
                          const next = !checked;
                          setPrefs({ [key]: next });
                          toast(`${label} ${next ? "enabled" : "disabled"}.`, "info");
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div>
              <h2 className="mb-1 px-1 text-[12px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#b8b0a8]">
                Keyboard Shortcuts
              </h2>
              <p className="mb-2.5 px-1 text-[12px] text-slate-500 dark:text-[#b8b0a8]">
                Navigate faster when using an external keyboard. Shortcuts pause while typing.
              </p>
              <div className={`${cardCls} divide-y divide-slate-100 px-4 dark:divide-night-line`}>
                {riderShortcuts.map(([action, hint, keys]) => (
                  <div key={action} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <strong className="block text-[13.5px] font-bold text-[#0f172a] dark:text-white">
                        {action}
                      </strong>
                      <span className="block text-[11.5px] text-slate-500 dark:text-[#b8b0a8]">
                        {hint}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0f172a] dark:border-night-line dark:bg-night-head dark:text-white"
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

        {/* =================================================================
            5. PRIVACY POLICY
        ================================================================= */}
        {section === "privacy" && (
          <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-[12.5px] text-slate-500 dark:text-[#b8b0a8]">
                How LOGISYNC handles account, parcel, and delivery data.
              </p>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold text-brand">
                v{POLICY_VERSION} · {EFFECTIVE_DATE}
              </span>
            </div>

            <div className="space-y-2.5">
              {REPUBLIC_ACTS.map((act) => (
                <div key={act.code} className={`${cardCls} p-4`}>
                  <div className="mb-1 flex items-center gap-2 text-[12px] font-extrabold text-brand">
                    <i className={`fa-solid ${act.icon}`} />
                    <span>{act.code}</span>
                  </div>
                  <strong className="block text-[13.5px] text-[#0f172a] dark:text-white">{act.title}</strong>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-[#b8b0a8]">{act.summary}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {PRIVACY_SECTIONS.map((sec) => (
                <div key={sec.id} className={`${cardCls} p-4`}>
                  <h3 className="mb-1.5 text-[14px] font-bold text-[#0f172a] dark:text-white">{sec.title}</h3>
                  {sec.paragraphs?.map((p, idx) => (
                    <p key={idx} className="mb-2 text-[12.5px] leading-relaxed text-slate-600 last:mb-0 dark:text-[#d1c9c2]">
                      {p}
                    </p>
                  ))}
                  {sec.bullets && (
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-slate-600 dark:text-[#d1c9c2]">
                      {sec.bullets.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================
            6. ABOUT LOGISYNC
        ================================================================= */}
        {section === "about" && (
          <div className="mx-auto flex min-h-[calc(100dvh-180px)] max-w-xl flex-col justify-between px-4 pt-6">
            <div className={`${cardCls} relative overflow-hidden p-6 text-center`}>
              <div className="mx-auto flex items-center justify-center gap-3">
                <img
                  src={SPX_LOGO_DATA_URL}
                  alt="SPX Express"
                  draggable={false}
                  className="h-7 w-auto object-contain"
                />
                <span className="h-5 w-[1.5px] bg-slate-200 dark:bg-night-line" aria-hidden="true" />
                <span className="text-[24px] font-black tracking-tight text-[#0f172a] dark:text-white">
                  LogiSync
                </span>
              </div>

              <p className="mt-3 text-[14px] font-bold text-[#0f172a] dark:text-[#f1eeeb]">
                Smarter Logistics. Better Tomorrow.
              </p>

              <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-slate-500 dark:text-[#b8b0a8]">
                LOGISYNC is a parcel verification, QR tracking, and delivery coordination platform built to connect riders, sellers, and hub coordinators seamlessly.
              </p>

              <div className="mt-5 rounded-xl bg-slate-100/90 px-4 py-3 text-[13.5px] font-bold text-[#0f172a] dark:bg-night-head dark:text-white">
                Version 1.0.0
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-left text-[12px] dark:border-night-line">
                <div>
                  <dt className="text-slate-400">Project</dt>
                  <dd className="font-bold text-[#0f172a] dark:text-white">{COPYRIGHT_OWNER} · LOGISYNC</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Policy Version</dt>
                  <dd className="font-bold text-[#0f172a] dark:text-white">v{POLICY_VERSION} ({EFFECTIVE_DATE})</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Active Portal</dt>
                  <dd className="font-bold text-[#0f172a] dark:text-white">Rider Portal</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Service Hub</dt>
                  <dd className="font-bold text-[#0f172a] dark:text-white">SPX Express Partner</dd>
                </div>
              </dl>

              {/* Bottom orange & navy wave accent */}
              <div className="pointer-events-none -mx-6 -mb-6 mt-6 leading-none" aria-hidden="true">
                <svg viewBox="0 0 390 64" preserveAspectRatio="none" className="block h-14 w-full">
                  <path d="M0,18 C120,56 260,8 390,32 L390,64 L0,64 Z" fill="#ff6818" opacity="0.22" />
                  <path d="M0,28 C115,62 275,24 390,10 L390,64 L0,64 Z" fill="#ee4d2d" />
                  <path d="M270,64 C315,44 355,34 390,26 L390,64 Z" fill="#0f172a" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
