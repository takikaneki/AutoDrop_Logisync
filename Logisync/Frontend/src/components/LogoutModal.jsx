import { useNavigate } from "react-router-dom";
import { logoutUser } from "../api.js";

export default function LogoutModal({ open, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        className="w-[380px] max-w-full rounded-2xl border-[1.5px] border-brand/35 bg-white p-7 text-center shadow-[0_20px_50px_rgba(0,0,0,.18)] animate-popup dark:border-brand/30 dark:bg-[#2c2724] dark:text-[#f5f1ed]"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand ring-4 ring-brand/10 dark:bg-night-head">
          <i className="fa-solid fa-right-from-bracket text-[19px]" />
        </div>
        <h3 id="logout-modal-title" className="text-[18px] font-extrabold text-[#1e293b] dark:text-[#f5f1ed]">
          Log out of LogiSync?
        </h3>
        <p className="mt-1.5 mb-6 text-[13px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
          You&apos;ll be signed out of your current portal session. You can log back in anytime.
        </p>
        <div className="flex items-center justify-center gap-2.5">
          <button
            type="button"
            className="flex-1 rounded-xl border border-[#cbd5e1] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#475569] transition hover:bg-[#f8fafc] dark:border-night-line dark:bg-night-head dark:text-[#e2dad3] dark:hover:bg-[#3d3732]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white shadow-xs transition hover:bg-brand-dark"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
