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
      {icon && <i className={`fa-solid ${icon}`} />}
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
  const name = String(icon || "");
  if (name.includes("bell") || name.includes("envelope")) {
    return (
      <svg viewBox="0 0 120 96" className="mx-auto mb-3 h-24 w-28" fill="none" aria-hidden="true">
        <ellipse cx="60" cy="84" rx="38" ry="6" fill="#fff0e7" />
        <path d="M28 52h64l-6 26H34l-6-26z" fill="#fff8f3" stroke="#1e293b" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M28 52l14-14h36l14 14" stroke="#1e293b" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M60 22c-9 0-15 6.5-15 15v9l-5 6h40l-5-6v-9c0-8.5-6-15-15-15z" fill="#ff6818" stroke="#1e293b" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="84" cy="30" r="10" fill="#ffffff" stroke="#ff6818" strokeWidth="2" />
        <path d="M79.5 30l3 3 6-6" stroke="#ff6818" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 25h8l-8 9h8M16 17h6l-6 7h6" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name.includes("file") || name.includes("clipboard") || name.includes("headset") || name.includes("comment") || name.includes("triangle") || name.includes("bullhorn")) {
    return (
      <svg viewBox="0 0 120 96" className="mx-auto mb-3 h-24 w-28" fill="none" aria-hidden="true">
        <ellipse cx="60" cy="84" rx="36" ry="6" fill="#fff0e7" />
        <rect x="34" y="18" width="44" height="58" rx="6" fill="#ffffff" stroke="#1e293b" strokeWidth="2.2" />
        <path d="M43 32h26M43 42h20M43 52h14" stroke="#ff6818" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="72" cy="56" r="13" fill="#fff8f3" stroke="#1e293b" strokeWidth="2.2" />
        <path d="M81 65l10 10" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <path d="M68 54h7l-7 7h7" stroke="#ff6818" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 96" className="mx-auto mb-3 h-24 w-28" fill="none" aria-hidden="true">
      <ellipse cx="60" cy="84" rx="38" ry="6" fill="#fff0e7" />
      <rect x="32" y="34" width="50" height="42" rx="7" fill="#fff8f3" stroke="#1e293b" strokeWidth="2.2" />
      <path d="M32 46h50M57 34v42" stroke="#ff6818" strokeWidth="2.2" />
      <circle cx="84" cy="30" r="10" fill="#ff6818" />
      <path d="M80 30l3 3 5.5-5.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ icon = "fa-box-open", title = "Nothing here yet", text = "" }) {
  return (
    <div className="flex min-h-[420px] max-[600px]:min-h-[300px] flex-col items-center justify-center px-4 py-14 text-center text-[#999]">
      <EmptyFigure icon={icon} />
      <strong className="block text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{title}</strong>
      {text && <p className="text-[13px] mt-1 text-[#64748b] dark:text-[#b8b0a8]">{text}</p>}
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
