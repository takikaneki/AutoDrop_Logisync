import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRole, getUser, logoutUser } from "../api.js";
import {
  clearLocalDraftOnly,
  hasUnsyncedOfflineDraft,
  syncPendingDraftToServer,
} from "../utils/parcelDraftStore.js";
import Icon from "./Icon.jsx";

export default function LogoutModal({ open, onClose }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!open) return null;

  const currentUser = getUser();
  const isSeller = String(currentUser?.role || getRole() || "").toLowerCase() === "seller";
  const sellerId = currentUser?.user_id;
  const hasOfflineDraft = isSeller && hasUnsyncedOfflineDraft(sellerId);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (isSeller && sellerId) {
        // If online and a local draft is unsynced, try syncing it to the Seller's server draft first
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          await syncPendingDraftToServer(sellerId).catch(() => {});
        }
        // Clear account-specific local browser draft so customer data does not linger on shared devices
        await clearLocalDraftOnly(sellerId).catch(() => {});
      }
      await logoutUser();
      navigate("/login", { replace: true, state: { fromLogout: true } });
    } finally {
      setLoggingOut(false);
    }
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
          <Icon name="log-out" className="text-[19px]" />
        </div>
        <h3 id="logout-modal-title" className="text-[18px] font-extrabold text-[#1e293b] dark:text-[#f5f1ed]">
          Log out of LogiSync?
        </h3>
        <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
          You&apos;ll be signed out of your current portal session. You can log back in anytime.
        </p>
        {hasOfflineDraft && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-[12px] leading-relaxed text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong className="flex items-center gap-1.5 font-bold">
              <Icon name="triangle-alert" className="text-amber-600 shrink-0" />
              <span>Unfinished Offline Parcel Draft</span>
            </strong>
            <p className="mt-1">
              You have an unfinished Create Parcel draft saved offline on this device that has not synced to the server yet. Logging out while offline will clear local browser draft data and your unsynced changes may be lost.
            </p>
          </div>
        )}
        <div className="flex items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={loggingOut}
            className="flex-1 rounded-xl border border-[#cbd5e1] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#475569] transition hover:bg-[#f8fafc] disabled:opacity-60 dark:border-night-line dark:bg-night-head dark:text-[#e2dad3] dark:hover:bg-[#3d3732]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loggingOut}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-60"
            onClick={handleLogout}
          >
            {loggingOut ? "Logging out…" : "Log Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
