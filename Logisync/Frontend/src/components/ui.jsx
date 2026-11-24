import { useEffect } from "react";
import { btnDanger, btnGhost, btnPrimary } from "./styles.js";
import Icon from "./Icon.jsx";
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
  Rescheduled: "bg-[#fff4d8] text-[#c98200]",
  "Return to Hub": "bg-[#f2ecff] text-[#7c3aed]",
  Processing: "bg-[#ede9fe] text-[#7c3aed]",
  Pending: "bg-[#fef3c7] text-[#d97706]",
  Verified: "bg-[#dcfce7] text-[#15803d]",
  Flagged: "bg-[#fff0f0] text-[#c94747]",
  "Delivery Hold": "bg-[#fef3c7] text-[#b45309]",
};

export function CodBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#fff0e5] text-[#ea580c] border border-[#ffcca8] tracking-wide ${className}`}
      title="Cash on Delivery"
    >
      COD
    </span>
  );
}

export function StatusBadge({ status, icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
        badgeTones[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

export function Modal({ open, onClose, children, z = "z-[1000]", className = "" }) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center overflow-y-auto p-3 sm:p-5 bg-[rgba(25,50,79,.35)] backdrop-blur-[3px]`}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`relative my-auto max-h-[90dvh] max-w-[calc(100vw-24px)] overflow-y-auto bg-white rounded-[20px] shadow-[0_18px_60px_rgba(25,50,79,.2)] max-[480px]:!p-4 ${className}`}>
        {children}
      </div>
    </div>
  );
}

// ---- Shared pieces para sa mga bagong page ----

function EmptyFigure({ icon }) {
  const name = typeof icon === "string" && icon.trim() ? icon.trim() : "package-open";

  return (
    <div
      aria-hidden="true"
      className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-400 dark:border-night-line dark:bg-night-head dark:text-slate-400"
    >
      <Icon name={name} className="h-7 w-7" strokeWidth={1.65} />
    </div>
  );
}

export function EmptyState({ icon = "package-open", title = "Nothing here yet", text = "" }) {
  return (
    <div className="flex min-h-[420px] max-[600px]:min-h-[300px] flex-col items-center justify-center px-4 py-14 text-center text-[#999]">
      <EmptyFigure icon={icon} />
      <strong className="block text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{title}</strong>
      {text && <p className="text-[13px] mt-1 text-[#64748b] dark:text-[#b8b0a8]">{text}</p>}
    </div>
  );
}

// Shimmer skeleton rows habang naglo-load ang table
export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <tbody aria-busy="true" aria-label="Loading table rows">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-4 border-t border-[#f1f1f1] dark:border-night-line">
              <div
                aria-hidden="true"
                className="logisync-skeleton h-3.5 rounded-md"
                style={{ width: `${55 + ((r + c) % 4) * 11}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  return (
    <Modal open={open} onClose={() => !busy && onCancel?.()} z="z-[4000]" className="w-full max-w-[420px] p-7 text-center dark:bg-night-panel">
      <div className={`w-[46px] h-[46px] mx-auto mb-3.5 rounded-full flex items-center justify-center text-[20px] ${danger ? "bg-[#fff0f0] text-[#d94747]" : "bg-[#fff0e5] text-brand"}`}>
        <Icon name={danger ? "triangle-alert" : "circle-help"} className="h-5 w-5" />
      </div>
      <h3 className="text-[17px] font-bold mb-2">{title}</h3>
      {text && <p className="text-[13px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8] mb-5">{text}</p>}
      <div className="flex justify-center gap-2.5 mt-5">
        <button type="button" disabled={busy} className={`${btnGhost} disabled:opacity-50`} onClick={onCancel}>Cancel</button>
        <button type="button" disabled={busy} className={`${danger ? btnDanger : btnPrimary} disabled:opacity-50`} onClick={onConfirm}>
          {busy ? "Processing…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
