import { useEffect, useMemo, useRef, useState } from "react";
import UserAvatar from "../Avatar.jsx";
import LogoutModal from "../LogoutModal.jsx";
import ChangePasswordForm from "../ChangePasswordForm.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls } from "../styles.js";
import { setPrefs, toggleDark, usePrefs } from "../../store/prefs.js";
import { setProfile, useProfile } from "../../store/profile.js";
import { toast } from "../../store/toast.js";
import { getUser } from "../../api.js";
import { previewTone } from "../../utils/sound.js";
import { riderTypeOf } from "../layout/navConfig.js";
import {
  disableDesktopWebPush,
  enableDesktopWebPush,
  inspectPushState,
  resolvePushStatusDisplay,
} from "../../utils/webPush.js";
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
  const themeMode = prefs.themeMode || (prefs.dark ? "dark" : "light");

  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("account-info");
  const [revealEmail, setRevealEmail] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pushState, setPushState] = useState(() => ({
    supported: true,
    permission: typeof Notification !== "undefined" ? Notification.permission : "default",
    subscribed: false,
    loading: false,
  }));

  useEffect(() => {
    let alive = true;
    inspectPushState().then((s) => {
      if (alive) setPushState((prev) => ({ ...prev, ...s }));
    });
    return () => {
      alive = false;
    };
  }, [user?.user_id]);

  // Inline profile edit state
  const [name, setName] = useState(profile.name === "Guest" ? "" : profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || user?.phone || user?.contact_number || "");
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const accountRef = useRef(null);
  const passwordRef = useRef(null);
  const notificationsRef = useRef(null);
  const appearanceRef = useRef(null);
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
  const isSearching = Boolean(q);
  const isAccountActive =
    activeNav === "account-info" || activeNav === "password" || activeNav === "status";

  const showAccount = isSearching
    ? "account info username email phone profile status verified".includes(q)
    : activeNav === "account-info" || activeNav === "status";
  const showSecurity = isSearching
    ? "password security change password".includes(q)
    : activeNav === "password";
  const showNotifications = isSearching
    ? "notifications channels in-app popup browser push permission sound volume preview parcel verification messages complaints announcements".includes(
        q
      )
    : activeNav === "notifications";
  const showAppearance = isSearching
    ? "appearance display dark light system default device theme text size small medium large".includes(q)
    : activeNav === "appearance";
  const showAccessibility = isSearching
    ? "accessibility keyboard shortcuts keybinds navigation".includes(q)
    : activeNav === "accessibility";

  const activeTitle = isSearching
    ? "Search Results"
    : {
        "account-info": "Account Info",
        password: "Password & Security",
        status: "Account Status",
        notifications: "Notifications",
        appearance: "Appearance & Display",
        accessibility: "Accessibility · Keyboard Shortcuts",
      }[activeNav] || "Settings";

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
            toast("Desktop browser push notifications are not supported in this browser.", "error");
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

  const roleKey = String(profile.role || user?.role || "coordinator").toLowerCase();
  const isLmRider = roleKey === "rider" && riderTypeOf(user) !== "FM";
  const roleShortcuts = useMemo(() => {
    if (roleKey === "seller") {
      return [
        ["Go to Dashboard", "Open your seller overview", ["G", "D"]],
        ["Go to Parcel Records", "View and search your parcels", ["G", "P"]],
        ["Create Parcel", "Open the create parcel form", ["G", "C"]],
        ["Scan QR / Upload Video", "Open packing & QR verification", ["G", "V"]],
        ["Go to Messages", "Open direct chat & announcements", ["G", "M"]],
        ["Go to Notifications", "View all bell alerts", ["G", "N"]],
        ["Go to Activity Log", "Inspect recent parcel activity", ["G", "A"]],
        ["Go to Settings", "Open account and portal preferences", ["G", "S"]],
        ["Open Help Center", "View guides and FAQ", ["?"]],
        ["Close Sidebar / Modal", "Dismiss open drawers or dialogs", ["ESC"]],
      ];
    }
    if (roleKey === "rider") {
      return [
        ["Go to Dashboard", "Open your rider overview", ["G", "D"]],
        ...(isLmRider
          ? [
              ["Go to My Parcels", "View assigned parcels", ["G", "P"]],
              ["Scan QR Code", "Open QR scanner for delivery", ["G", "V"]],
              ["Go to Deliveries", "Manage active deliveries", ["G", "L"]],
            ]
          : []),
        ["Go to Messages", "Open direct chat & announcements", ["G", "M"]],
        ["Go to Notifications", "View all bell alerts", ["G", "N"]],
        ["Go to Activity Log", "Inspect recent rider logs", ["G", "A"]],
        ["Go to Settings", "Open account and portal preferences", ["G", "S"]],
        ["Open Help Center", "View guides and FAQ", ["?"]],
        ["Close Sidebar / Modal", "Dismiss open drawers or dialogs", ["ESC"]],
      ];
    }
    return [
      ["Go to Dashboard", "Open coordinator hub overview", ["G", "D"]],
      ["Go to Parcel Records", "View and search all parcels", ["G", "P"]],
      ["Report / Filter Parcels", "Jump directly to parcel report view", ["G", "R"]],
      ["Go to Verification", "Open packing & QR verification", ["G", "V"]],
      ["Go to Messages", "Open direct chat & announcements", ["G", "M"]],
      ["Go to Notifications", "View all bell alerts", ["G", "N"]],
      ["Go to Activity Log", "Inspect recent system & parcel logs", ["G", "A"]],
      ["Go to Settings", "Open account and portal preferences", ["G", "S"]],
      ["Open Help Center", "View guides and FAQ", ["?"]],
      ["Close Sidebar / Modal", "Dismiss open drawers or dialogs", ["ESC"]],
    ];
  }, [roleKey, isLmRider]);

  return (
    <>
      <div className="grid grid-cols-[270px_1fr] items-stretch overflow-hidden rounded-2xl border-[1.5px] border-brand/45 border-t-[3px] border-t-brand bg-white shadow-xs dark:border-brand/35 dark:border-t-brand dark:bg-night-panel max-[920px]:grid-cols-1 min-[921px]:h-[calc(100vh-148px)] min-[921px]:min-h-[520px] min-[921px]:max-h-[720px]">
        {/* LEFT SETTINGS SIDEBAR (Darker shaded pane like Discord) */}
        <aside className="flex min-h-0 flex-col border-r border-brand-line bg-[#f1f5f9] p-4 dark:border-night-line dark:bg-[#1d1a17] max-[920px]:border-r-0 max-[920px]:border-b">
          {/* User Header */}
          <div className="flex shrink-0 items-center gap-3 pb-4 border-b border-brand-line dark:border-night-line">
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
          <div className="relative my-3.5 shrink-0">
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
          <nav className="flex-1 space-y-1 overflow-y-auto pr-1 text-[13.5px]" aria-label="Settings sections">
            <button
              type="button"
              onClick={() => jumpTo("account-info", accountRef)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left font-semibold transition ${
                isAccountActive
                  ? "bg-brand-soft/60 text-brand dark:bg-night-head"
                  : "text-[#334155] hover:bg-brand-softer hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <i className="fa-solid fa-user text-[13px]" />
                <span>Account</span>
              </span>
              <i className={`fa-solid fa-chevron-${isAccountActive ? "down" : "right"} text-[10px] opacity-70`} />
            </button>

            {(isAccountActive || isSearching) && (
              <div className="ml-3 space-y-0.5 border-l border-[#e2e8f0] pl-2.5 dark:border-night-line">
                <button
                  type="button"
                  onClick={() => jumpTo("account-info", accountRef)}
                  className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition ${
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
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition ${
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
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition ${
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
            )}

            <button
              type="button"
              onClick={() => jumpTo("notifications", notificationsRef)}
              className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
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
              onClick={() => jumpTo("appearance", appearanceRef)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold transition ${
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
          <div className="mt-4 shrink-0 border-t border-brand-line pt-3 dark:border-night-line">
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

        {/* RIGHT SETTINGS CONTENT PANEL (Internal scroll inside unified container) */}
        <section className="flex min-h-0 flex-col overflow-hidden bg-white dark:bg-night-panel">
          <div className="flex shrink-0 items-center justify-between border-b border-brand-line bg-white px-7 py-3.5 dark:border-night-line dark:bg-night-panel max-[600px]:px-4">
            <h2 className="text-[16px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
              {activeTitle}
            </h2>
            {isSearching && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[12px] font-semibold text-brand hover:underline"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-7 max-[600px]:p-4">
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
            <div ref={passwordRef} className={`${isSearching ? "mt-6 border-t border-brand-line pt-6 dark:border-night-line" : ""} scroll-mt-4`}>
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

          {/* 3. NOTIFICATIONS */}
          {showNotifications && (
            <div ref={notificationsRef} className={`${isSearching ? "mt-6 border-t border-brand-line pt-6 dark:border-night-line" : ""} scroll-mt-4`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[18px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                    Notifications
                  </h3>
                  <p className="mt-0.5 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                    Manage how you receive LOGISYNC updates.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 pt-1">
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

              <div className={`space-y-6 transition-opacity ${notificationsOn ? "opacity-100" : "opacity-55"}`}>
                {/* A. Notification Channels */}
                <div>
                  <h4 className="mb-2.5 text-[14px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                    1. Notification Channels
                  </h4>
                  <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/25 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                    {[
                      [
                        "inAppNotifications",
                        "In-App Notifications",
                        "Controls alerts shown in the LOGISYNC notification bell while preserving notification history.",
                      ],
                      [
                        "inAppPopups",
                        "In-App Popup Alerts",
                        "Show floating banner alerts while you are actively using LOGISYNC.",
                      ],
                    ].map(([key, label, hint]) => {
                      const checked = notificationsOn && prefs[key] !== false;
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 py-3.5">
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                              {label}
                            </strong>
                            <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{hint}</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={label}
                            disabled={!notificationsOn}
                            onClick={() => togglePref(key, label)}
                            className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
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

                    {/* Browser Push Notifications (Exclusively for Hub Announcements) */}
                    <div className="py-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                              Browser Push Notifications
                            </strong>
                            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand">
                              Announcements only
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                                pushDisplay.key === "granted"
                                  ? "bg-[#eaf8ef] text-[#1f7a47] dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : pushDisplay.key === "denied"
                                    ? "bg-[#fff0f0] text-[#c23a3a] dark:bg-red-950/50 dark:text-red-300"
                                    : "bg-[#f1f5f9] text-[#64748b] dark:bg-night-panel dark:text-[#b8b0a8]"
                              }`}
                            >
                              {pushDisplay.label}
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                            Receive desktop browser push alerts exclusively when a Coordinator publishes a Hub Announcement.
                          </span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isBrowserPushOn}
                          aria-label="Browser Push Notifications"
                          disabled={
                            !notificationsOn ||
                            pushState.loading ||
                            pushDisplay.key === "unsupported"
                          }
                          onClick={handleToggleBrowserPush}
                          className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isBrowserPushOn ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                          }`}
                        >
                          <span
                            className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                              isBrowserPushOn ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {pushDisplay.key === "denied" && (
                        <p className="mt-2.5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[11.5px] text-[#9a3412] dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                          Browser permission is blocked. Click the lock or site-settings icon beside the address bar, set Notifications to <strong>Allow</strong>, and refresh this page.
                        </p>
                      )}
                      {pushDisplay.key === "unsupported" && (
                        <p className="mt-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[11.5px] text-[#64748b] dark:border-night-line dark:bg-night-panel dark:text-[#b8b0a8]">
                          Desktop Browser Push requires a supported desktop browser with Service Worker and Notification support over HTTPS or localhost.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. Notification Categories */}
                <div className="border-t border-brand-line pt-5 dark:border-night-line">
                  <h4 className="text-[14px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                    2. Notification Categories
                  </h4>
                  <p className="mt-0.5 mb-2.5 text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                    Choose which types of updates you want to receive.
                  </p>
                  <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/25 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                    {[
                      [
                        "notifyParcel",
                        "Parcel & Delivery Updates",
                        roleKey === "rider" && !isLmRider
                          ? "Seller pickup assignments and dispatch updates."
                          : "Assignments, transit updates, deliveries, and return-to-hub notices.",
                      ],
                      [
                        "notifyVerification",
                        "Verification & Video Status",
                        roleKey === "rider"
                          ? "Parcel clearance and dispatch verification readiness."
                          : "Packing video approvals, re-upload requests, and verification flags.",
                      ],
                      [
                        "notifyMessages",
                        "Messages & Complaints",
                        "Direct chat messages and complaint or request status replies.",
                      ],
                      [
                        "notifyAnnouncements",
                        "Hub Announcements",
                        "Important operational advisories posted by coordinators.",
                      ],
                    ].map(([key, label, hint]) => {
                      const checked = notificationsOn && prefs[key] !== false;
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                              {label}
                            </strong>
                            <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">{hint}</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={label}
                            disabled={!notificationsOn}
                            onClick={() => togglePref(key, label)}
                            className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
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

                {/* C. Sound Preferences */}
                <div className="border-t border-brand-line pt-5 dark:border-night-line">
                  <h4 className="text-[14px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                    3. Sound Preferences
                  </h4>
                  <p className="mt-0.5 mb-2.5 text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                    Manage sounds for selected notification categories.
                  </p>
                  <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/25 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                    <div className="py-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                            Alert Volume
                          </strong>
                          <span className="text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                            Adjust sound loudness for Messages &amp; Complaints and Hub Announcements.
                          </span>
                        </div>
                        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-bold text-brand">
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
                        <div key={soundKey} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                              {label}
                            </strong>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={!categoryActive}
                                onClick={() => previewTone(toneKey)}
                                className="text-[12px] font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Preview Sound
                              </button>
                              {!categoryActive && (
                                <span className="text-[11px] text-[#94a3b8]">
                                  (Disabled because {label} notifications are off)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={`${label} sound`}
                            disabled={!categoryActive}
                            onClick={() => {
                              const next = !checked;
                              setPrefs({ [soundKey]: next, ...(next ? { sound: true, notificationsEnabled: true } : {}) });
                              if (next) previewTone(toneKey);
                            }}
                            className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
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

          {/* 4. APPEARANCE & DISPLAY */}
          {showAppearance && (
            <div ref={appearanceRef} className={`${isSearching ? "mt-6 border-t border-brand-line pt-6 dark:border-night-line" : ""} scroll-mt-4`}>
              <h3 className="mb-1 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Appearance &amp; Display
              </h3>
              <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Choose your preferred theme and text size across portals.
              </p>

              {/* Theme Preferences (Radio Buttons) */}
              <div className="mb-5">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  Theme Preferences
                </span>
                <div
                  role="radiogroup"
                  aria-label="Theme Preferences"
                  className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/35 dark:divide-night-line dark:border-night-line dark:bg-night-head/40"
                >
                  {[
                    {
                      key: "light",
                      label: "Light",
                      hint: "Bright, clean daytime workspace.",
                      icon: "fa-sun",
                    },
                    {
                      key: "dark",
                      label: "Dark",
                      hint: "Low-glare dark workspace for night use.",
                      icon: "fa-moon",
                    },
                    {
                      key: "system",
                      label: "System Default",
                      hint: "Automatically follow your device's light or dark mode.",
                      icon: "fa-arrows-rotate",
                    },
                  ].map((item) => {
                    const active = themeMode === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setPrefs({ themeMode: item.key });
                          toast(`${item.label} theme applied.`, "info");
                        }}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-brand-soft/30 dark:hover:bg-night-head/70"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[13px] ${
                              item.key === "dark"
                                ? "border-[#48413c] bg-[#292522] text-white"
                                : item.key === "system"
                                  ? "border-[#94a3b8] bg-gradient-to-br from-white via-[#cbd5e1] to-[#1e293b] text-[#1e293b]"
                                  : "border-[#cbd5e1] bg-white text-[#f59e0b]"
                            }`}
                          >
                            <i className={`fa-solid ${item.icon}`} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                              {item.label}
                            </strong>
                            <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                              {item.hint}
                            </span>
                          </div>
                        </div>

                        {/* Radio Circle Indicator */}
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-[#cbd5e1] bg-white dark:border-night-line dark:bg-night-panel"
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-softer/35 px-4 py-3.5 dark:border-night-line dark:bg-night-head/40">
                <div>
                  <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                    Text Size
                  </strong>
                  <span className="text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                    Adjust display font scale across portals.
                  </span>
                </div>
                <div className="inline-flex rounded-xl border border-[#cbd5e1] bg-white p-1 dark:border-night-line dark:bg-night-panel">
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

          {/* 5. ACCESSIBILITY (Keyboard Shortcuts only) */}
          {showAccessibility && (
            <div ref={accessibilityRef} className={`${isSearching ? "mt-6 border-t border-brand-line pt-6 dark:border-night-line" : ""} scroll-mt-4`}>
              <h3 className="mb-1 text-[16.5px] font-extrabold text-[#1e293b] dark:text-[#f1eeeb]">
                Keyboard Shortcuts
              </h3>
              <p className="mb-4 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Navigate quickly across LogiSync portals using keyboard keybinds.
              </p>
              <div className="divide-y divide-[#edf0f4] rounded-xl border border-brand-line bg-brand-softer/35 px-4 dark:divide-night-line dark:border-night-line dark:bg-night-head/40">
                {roleShortcuts.map(([action, hint, keys]) => (
                  <div key={action} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <strong className="block text-[13.5px] font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
                        {action}
                      </strong>
                      <span className="block text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                        {hint}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1 font-mono text-[11.5px] font-bold text-[#1e293b] shadow-2xs dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showAccount &&
            !showSecurity &&
            !showNotifications &&
            !showAppearance &&
            !showAccessibility && (
            <p className="py-10 text-center text-[13.5px] text-[#64748b]">
              No settings match &ldquo;{search}&rdquo;.
            </p>
          )}
          </div>
        </section>
      </div>

      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}

