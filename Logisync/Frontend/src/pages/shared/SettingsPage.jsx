import { useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import LogoutModal from "../../components/LogoutModal.jsx";
import UserAvatar from "../../components/Avatar.jsx";
import { DetailList, PanelTitle } from "../../components/portal.jsx";
import { btnDanger, panel } from "../../components/styles.js";
import { getUser } from "../../api.js";
import { setPrefs, toggleDark, usePrefs } from "../../store/prefs.js";
import ChangePasswordForm from "../../components/ChangePasswordForm.jsx";

const SIZES = [["sm", "Small"], ["md", "Medium"], ["lg", "Large"]];

// Profile + itsura + logout para sa Seller at Rider. Walang token o password hash na ipinapakita.
export default function SettingsPage() {
  const user = getUser();
  const { dark, fontSize } = usePrefs();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const formattedUserId =
    user?.user_id !== undefined && user?.user_id !== null && String(user.user_id).trim() !== ""
      ? `#${String(user.user_id).padStart(4, "0")}`
      : null;

  return (
    <>
      <Topbar title="Settings" />

      {/* DESKTOP WEB VIEW: Left-aligned expanded horizontal 4-Card Layout */}
      <div className="hidden min-[821px]:block">
        <div className="w-[95%] max-w-[1360px] space-y-5 text-left">
          {/* A. Account Profile Card */}
          <section className="w-full rounded-2xl border border-[#e5e8ee] bg-white px-7 py-6 shadow-xs dark:border-night-line dark:bg-night-panel">
            <h2 className="mb-4 text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Account Profile
            </h2>
            <div className="flex items-center gap-4">
              <UserAvatar className="h-14 w-14 shrink-0 text-[22px]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-[17px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    {user?.name || "User"}
                  </strong>
                  {formattedUserId && (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-bold text-slate-500 dark:border-night-line dark:bg-night-head dark:text-[#b8b0a8]">
                      {formattedUserId}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold capitalize text-brand dark:bg-night-head">
                    {user?.role || "Member"}
                  </span>
                  {user?.email && (
                    <span className="truncate text-[13.5px] text-[#64748b] dark:text-[#b8b0a8]">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* B. Security & Password Card */}
          <section className="w-full rounded-2xl border border-[#e5e8ee] bg-white px-7 py-6 shadow-xs dark:border-night-line dark:bg-night-panel">
            <h2 className="mb-4 text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Security &amp; Password
            </h2>
            <ChangePasswordForm desktopSplit />
          </section>

          {/* C. Appearance & Display Card */}
          <section className="w-full rounded-2xl border border-[#e5e8ee] bg-white px-7 py-6 shadow-xs dark:border-night-line dark:bg-night-panel">
            <h2 className="mb-4 text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Appearance &amp; Display
            </h2>
            <div className="divide-y divide-[#edf0f4] dark:divide-night-line">
              {/* Row 1 - Dark Mode */}
              <div className="flex items-center justify-between gap-4 pb-4">
                <div>
                  <strong className="block text-[14px] font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                    Dark mode
                  </strong>
                  <span className="text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                    Easier on the eyes at night.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dark}
                  aria-label="Dark mode"
                  onClick={toggleDark}
                  className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
                    dark ? "bg-brand" : "bg-[#cbd5e1] dark:bg-night-line"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                      dark ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Row 2 - Text Size */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <div>
                  <strong className="block text-[14px] font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                    Text size
                  </strong>
                  <span className="text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                    Adjust display size.
                  </span>
                </div>
                <div className="inline-flex rounded-xl border border-[#e5e8ee] bg-[#f8fafc] p-1 dark:border-night-line dark:bg-night-head">
                  {SIZES.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPrefs({ fontSize: key })}
                      aria-pressed={fontSize === key}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                        fontSize === key
                          ? "bg-brand text-white shadow-xs"
                          : "text-[#555] hover:text-brand dark:text-[#d1c9c2]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* D. Account Session Card */}
          <section className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#e5e8ee] bg-white px-7 py-5 shadow-xs dark:border-night-line dark:bg-night-panel">
            <div>
              <h2 className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                Account Session
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[#64748b] dark:text-[#b8b0a8]">
                Sign out of your current LogiSync session.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#d94747]/60 bg-white px-4 py-2 text-[13px] font-bold text-[#d94747] transition hover:border-[#d94747] hover:bg-[#fff0f0] dark:bg-night-head dark:hover:bg-[#d94747]/15"
            >
              <i className="fa-solid fa-right-from-bracket" /> Logout
            </button>
          </section>
        </div>
      </div>

      {/* MOBILE VIEW: Preserved Unchanged */}
      <div className="min-[821px]:hidden">
        <div className="grid grid-cols-2 items-start gap-6 max-[1000px]:grid-cols-1">
          <section className={`${panel} p-[30px] max-[600px]:p-5`}>
            <PanelTitle icon="fa-user">Profile</PanelTitle>
            <div className="mb-8 flex items-center gap-5">
              <UserAvatar className="h-[80px] w-[80px] shrink-0 text-[30px]" />
              <div className="min-w-0">
                <strong className="mb-1.5 block truncate text-[20px]">{user?.name}</strong>
                <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-[13px] font-bold capitalize text-brand dark:bg-night-head">{user?.role}</span>
              </div>
            </div>
            <DetailList cols={2} rows={[["Name", user?.name], ["Email", user?.email], ["Role", user?.role], ["User ID", user?.user_id]]} />
          </section>

          <div className="space-y-6">
            <section className={`${panel} p-[30px] max-[600px]:p-5`}>
              <PanelTitle icon="fa-lock">Change Password</PanelTitle>
              <ChangePasswordForm />
            </section>

            <section className={`${panel} p-[30px] max-[600px]:p-5`}>
              <PanelTitle icon="fa-palette">Appearance</PanelTitle>

              <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-[#edf0f4] pb-5 dark:border-night-line">
                <span>
                  <strong className="mb-1 block text-[15px]">Dark mode</strong>
                  <span className="text-[13px] text-[#999]">Easier on the eyes at night.</span>
                </span>
                <input type="checkbox" checked={dark} onChange={toggleDark} className="h-6 w-6 shrink-0 accent-[#ff6818]" />
              </label>

              <div className="pt-5">
                <strong className="block text-[15px]">Text size</strong>
                <div className="mt-4 flex flex-wrap gap-3">
                  {SIZES.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPrefs({ fontSize: key })}
                      aria-pressed={fontSize === key}
                      className={`rounded-lg border px-5 py-3 text-[14px] font-semibold transition ${
                        fontSize === key
                          ? "border-brand bg-brand text-white"
                          : "border-[#e5e5e5] bg-white text-[#555] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#d1c9c2]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <button onClick={() => setLogoutOpen(true)} className={`${btnDanger} !px-5 !py-3 !text-[14px]`}>
              <i className="fa-solid fa-right-from-bracket" /> Logout
            </button>
          </div>
        </div>
      </div>

      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
