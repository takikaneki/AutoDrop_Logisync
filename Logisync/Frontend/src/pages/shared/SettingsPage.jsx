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

  return (
    <>
      <Topbar title="Settings" />

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
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
