import { useEffect } from "react";
import { btnDanger, btnGhost, btnPrimary } from "./styles.js";
// Maliliit na reusable UI pieces: Avatar, StatusBadge, Modal

const avatarTones = {
  orange: "bg-[#fff0e7] text-[#ff6818]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  pink: "bg-[#fff0f5] text-[#c75b83]",
  red: "bg-[#fff0f0] text-[#d94747]",
};

export function Avatar({ initials, tone = "orange", className = "w-8 h-8 text-[10px]" }) {
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-bold ${avatarTones[tone]} ${className}`}
    >
      {initials}
    </div>
  );
}

const badgeTones = {
  "In Transit": "bg-[#fff0e7] text-[#e9651c]",
  Delivered: "bg-[#eaf8ef] text-[#29945a]",
  "Failed Delivery": "bg-[#fff0f0] text-[#d94747]",
  Processing: "bg-[#ede9fe] text-[#7c3aed]",
  Pending: "bg-[#fef3c7] text-[#d97706]",
  Verified: "bg-[#dcfce7] text-[#15803d]",
  Flagged: "bg-[#fff0f0] text-[#c94747]",
  "Returned to Seller": "bg-[#edf4ff] text-[#4b78b5]",
};

export function StatusBadge({ status, icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
        badgeTones[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {icon && <i className={`fa-solid ${icon}`} />}
      {status}
    </span>
  );
}

export function Modal({ open, onClose, children, z = "z-[1000]", className = "" }) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center p-5 bg-[rgba(25,50,79,.35)] backdrop-blur-[3px]`}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`relative bg-white rounded-[20px] shadow-[0_18px_60px_rgba(25,50,79,.2)] ${className}`}>
        {children}
      </div>
    </div>
  );
}

// ---- Shared pieces para sa mga bagong page ----

export function EmptyState({ icon = "fa-box-open", title = "Nothing here yet", text = "" }) {
  return (
    <div className="py-14 text-center text-[#999]">
      <i className={`fa-solid ${icon} text-[30px] mb-3 block opacity-60`} />
      <strong className="block text-[15px] text-[#666] dark:text-[#d1c9c2]">{title}</strong>
      {text && <p className="text-[13px] mt-1">{text}</p>}
    </div>
  );
}

// Skeleton rows habang naglo-load (mock delay; magiging totoong loading kapag API na)
export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-4 border-t border-[#f1f1f1] dark:border-night-line">
              <div className="h-3.5 rounded bg-[#eee] animate-pulse dark:bg-night-line" style={{ width: `${55 + ((r + c) % 4) * 11}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <Modal open={open} onClose={onCancel} z="z-[4000]" className="w-full max-w-[400px] p-7 text-center dark:bg-night-panel">
      <div className={`w-[46px] h-[46px] mx-auto mb-3.5 rounded-full flex items-center justify-center text-[20px] ${danger ? "bg-[#fff0f0] text-[#d94747]" : "bg-[#fff0e5] text-brand"}`}>
        <i className={`fa-solid ${danger ? "fa-triangle-exclamation" : "fa-circle-question"}`} />
      </div>
      <h3 className="text-[17px] font-bold mb-2">{title}</h3>
      {text && <p className="text-[13px] text-[#888] mb-5">{text}</p>}
      <div className="flex justify-center gap-2.5 mt-5">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={danger ? btnDanger : btnPrimary} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
