import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import UserAvatar from "../components/Avatar.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel } from "../components/styles.js";
import { setPrefs, usePrefs } from "../store/prefs.js";
import { setProfile, useProfile } from "../store/profile.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import ChangePasswordForm from "../components/ChangePasswordForm.jsx";

const tabs = [
  ["profile", "Profile", "fa-regular fa-user"],
  ["password", "Password", "fa-solid fa-lock"],
  ["notifications", "Notifications", "fa-regular fa-bell"],
  ["appearance", "Appearance", "fa-solid fa-palette"],
  ["permissions", "Roles & Permissions", "fa-solid fa-shield-halved"],
];

// Liliitan ang picture para kasya sa browser storage
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

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-4 py-3.5 text-left border-b border-[#f3f3f3] last:border-0 dark:border-night-line">
      <span><strong className="block text-[14px]">{label}</strong>{hint && <small className="text-[12px] text-[#999]">{hint}</small>}</span>
      <span className={`relative w-[42px] h-[22px] shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-[#d5d0cb]"}`}>
        <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function ProfileTab() {
  const p = useProfile();
  const [name, setName] = useState(p.name === "Guest" ? "" : p.name);
  const [email, setEmail] = useState(p.email);
  const [phone, setPhone] = useState(p.phone);
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const save = (e) => {
    e.preventDefault();
    const err = {};
    if (!name.trim()) err.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) err.email = "Please enter a valid email address.";
    if (phone && !/^[0-9+\-\s()]{7,}$/.test(phone)) err.phone = "Please enter a valid phone number.";
    setErrors(err);
    if (Object.keys(err).length) return;
    // TODO: PATCH /api/auth/me
    setProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    logAction({ category: "Settings", action: "Updated profile", target: name.trim() });
    toast("Profile saved.");
  };

  const upload = async (e) => {
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

  return (
    <form onSubmit={save} noValidate>
      <div className="flex items-center gap-5 mb-7 flex-wrap">
        <UserAvatar className="w-[84px] h-[84px] text-[30px]" />
        <div>
          <div className="flex gap-2.5 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}><i className="fa-solid fa-camera" /> Change photo</button>
            {p.avatar && <button type="button" onClick={() => { setProfile({ avatar: "" }); toast("Photo removed."); }} className={btnGhost}>Remove</button>}
          </div>
          <p className="mt-2 text-[12px] text-[#999]">JPG or PNG. It is resized automatically.</p>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 max-[700px]:grid-cols-1">
        <div>
          <label className={labelCls} htmlFor="p-name">Full name</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          {errors.name && <p className="mt-1 text-[12px] text-[#d94747]">{errors.name}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="p-role">Role</label>
          <input id="p-role" value={p.role} disabled className={`${inputCls} opacity-60`} />
        </div>
        <div>
          <label className={labelCls} htmlFor="p-email">Email</label>
          <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          {errors.email && <p className="mt-1 text-[12px] text-[#d94747]">{errors.email}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="p-phone">Phone</label>
          <input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 000 0000" className={inputCls} />
          {errors.phone && <p className="mt-1 text-[12px] text-[#d94747]">{errors.phone}</p>}
        </div>
      </div>
      <button type="submit" className={`${btnPrimary} mt-6`}><i className="fa-solid fa-floppy-disk" /> Save changes</button>
    </form>
  );
}

function NotificationsTab() {
  const p = usePrefs();
  const set = (k) => (v) => { setPrefs({ [k]: v }); toast("Preference saved.", "info"); };
  return (
    <div className="max-w-[560px]">
      <h3 className="text-[14px] font-bold uppercase tracking-wide text-[#999] mb-1">How you get notified</h3>
      <Toggle checked={p.sound} onChange={set("sound")} label="Alert sound" hint="Play a sound when an announcement is sent." />
      <Toggle checked={p.emailAlerts} onChange={set("emailAlerts")} label="Email alerts" hint="Also send important alerts to your email." />
      <h3 className="text-[14px] font-bold uppercase tracking-wide text-[#999] mt-7 mb-1">What you get notified about</h3>
      <Toggle checked={p.notifyParcel} onChange={set("notifyParcel")} label="Parcel updates" />
      <Toggle checked={p.notifyVerification} onChange={set("notifyVerification")} label="Verification alerts" />
      <Toggle checked={p.notifyRider} onChange={set("notifyRider")} label="Rider concerns" />
      <Toggle checked={p.notifySeller} onChange={set("notifySeller")} label="Seller messages" />
    </div>
  );
}

function AppearanceTab() {
  const p = usePrefs();
  const seg = (active) => `flex-1 px-4 py-2.5 rounded-lg text-[14px] font-semibold border transition ${active ? "bg-brand border-brand text-white" : "bg-white border-[#e5e5e5] text-[#666] hover:border-brand hover:text-brand dark:bg-night-head dark:border-night-line dark:text-[#d1c9c2]"}`;
  const group = (title, hint, children) => (
    <div className="mb-7">
      <strong className="block text-[14px] mb-1">{title}</strong>
      <small className="block text-[12px] text-[#999] mb-3">{hint}</small>
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
  return (
    <div className="max-w-[520px]">
      {group("Theme", "Light or dark colors.", <>
        <button className={seg(!p.dark)} onClick={() => setPrefs({ dark: false })}><i className="fa-solid fa-sun mr-2" />Light</button>
        <button className={seg(p.dark)} onClick={() => setPrefs({ dark: true })}><i className="fa-solid fa-moon mr-2" />Dark</button>
      </>)}
      {group("Language", "Changes menu and page titles. Other text stays in English for now.", <>
        <button className={seg(p.lang === "en")} onClick={() => setPrefs({ lang: "en" })}>English</button>
        <button className={seg(p.lang === "fil")} onClick={() => setPrefs({ lang: "fil" })}>Filipino</button>
      </>)}
      {group("Text size", "Makes the whole page smaller or larger.", <>
        {[["sm", "Small"], ["md", "Default"], ["lg", "Large"]].map(([k, l]) => <button key={k} className={seg(p.fontSize === k)} onClick={() => setPrefs({ fontSize: k })}>{l}</button>)}
      </>)}
    </div>
  );
}

const modules = ["Dashboard", "Parcels", "Reports", "Verification", "Riders", "Sellers", "Messages", "Complaints", "Announcements", "Analytics", "Audit Log", "Settings"];
// 2 = full, 1 = limited/own records, 0 = no access
const roles = {
  Coordinator: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  Seller: [1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
  Rider: [1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
};
function PermissionsTab() {
  const me = useProfile().role;
  const cell = (v) => v === 2 ? <i className="fa-solid fa-circle-check text-[#29945a]" title="Full access" /> : v === 1 ? <i className="fa-solid fa-circle-half-stroke text-[#e99a00]" title="Own records only" /> : <i className="fa-solid fa-circle-xmark text-[#ccc]" title="No access" />;
  return (
    <div>
      <p className="text-[14px] text-[#777] mb-4 dark:text-[#d1c9c2]">Your role: <strong className="text-brand">{me}</strong>. This table shows which modules each role can use.</p>
      <div className="overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
        <table className="w-full min-w-[480px] border-collapse text-[14px]">
          <thead className="bg-[#fafafa] dark:bg-night-head"><tr><th className="px-4 py-3 text-left text-[12px] uppercase text-[#999]">Module</th>{Object.keys(roles).map((r) => <th key={r} className={`px-4 py-3 text-center text-[12px] uppercase ${r === me ? "text-brand" : "text-[#999]"}`}>{r}</th>)}</tr></thead>
          <tbody>
            {modules.map((m, i) => (
              <tr key={m} className="border-t border-[#f1f1f1] dark:border-night-line">
                <td className="px-4 py-3">{m}</td>
                {Object.values(roles).map((v, j) => <td key={j} className="px-4 py-3 text-center">{cell(v[i])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-[#999]"><i className="fa-solid fa-circle-check text-[#29945a]" /> Full access &nbsp; <i className="fa-solid fa-circle-half-stroke text-[#e99a00]" /> Own records only &nbsp; <i className="fa-solid fa-circle-xmark text-[#ccc]" /> No access</p>
    </div>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((t) => t[0] === params.get("tab")) ? params.get("tab") : "profile";

  return (
    <>
      <Topbar title="Settings" subtitle="Manage your profile, security and how LogiSync looks and notifies you." />
      <div className="grid grid-cols-[240px_1fr] gap-6 max-[900px]:grid-cols-1">
        <nav className={`${panel} p-3 h-fit flex flex-col gap-1 max-[900px]:flex-row max-[900px]:overflow-x-auto`} aria-label="Settings sections">
          {tabs.map(([k, l, ic]) => (
            <button key={k} onClick={() => setParams({ tab: k })} aria-current={tab === k} className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-[14px] text-left whitespace-nowrap transition ${tab === k ? "bg-brand-soft text-brand font-semibold dark:bg-night-line" : "text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"}`}>
              <i className={`${ic} w-4 text-center`} /> {l}
            </button>
          ))}
        </nav>
        <section className={`${panel} p-8 max-[600px]:p-5`}>
          <h2 className="text-[19px] font-bold mb-6">{tabs.find((t) => t[0] === tab)[1]}</h2>
          {tab === "profile" && <ProfileTab />}
          {tab === "password" && <ChangePasswordForm />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "permissions" && <PermissionsTab />}
        </section>
      </div>
    </>
  );
}
