import { useEffect } from "react";
import Icon from "../Icon.jsx";
import { FilterSelect } from "../SearchFilterBar.jsx";

export default function CallUserModal({
  active,
  coordinators = null,
  onSelectCoordinator = null,
  onClose,
  title = null,
  subtitle = null,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const rawPhone = active?.phone ? String(active.phone).trim() : "";
  const telDigits = rawPhone.replace(/[^\d+]/g, "");
  const hasValidPhone = Boolean(rawPhone && telDigits.replace(/\D/g, "").length >= 7);

  const formattedRole = active?.role
    ? active.role.charAt(0).toUpperCase() + active.role.slice(1)
    : "Coordinator";

  const displayName = active?.name || "Coordinator";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-modal-title"
        className="w-[400px] max-w-full rounded-2xl border-[1.5px] border-brand/35 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,.18)] animate-popup dark:border-brand/30 dark:bg-[#2c2724] dark:text-[#f5f1ed]"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand ring-4 ring-brand/10 dark:bg-night-head">
            <Icon name="phone" className="text-lg" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Icon name="x" className="text-base" />
          </button>
        </div>

        <div className="mt-3">
          <h3 id="call-modal-title" className="text-[17px] font-extrabold text-[#1e293b] dark:text-[#f5f1ed]">
            {title || `Call ${displayName}`}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand dark:bg-night-head">
              {formattedRole}
            </span>
            {subtitle && (
              <span className="text-xs text-slate-400 dark:text-slate-400">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* If multiple coordinators exist, allow switching */}
        {coordinators && coordinators.length > 1 && onSelectCoordinator && (
          <div className="mt-3">
            <label htmlFor="coordinator-select" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Select Coordinator
            </label>
            <FilterSelect
              id="coordinator-select"
              value={String(active?.user_id || "")}
              onChange={(e) => {
                const found = coordinators.find((c) => String(c.user_id) === e.target.value);
                if (found) onSelectCoordinator(found);
              }}
              icon="user"
              fullWidth
              inline
              ariaLabel="Select Coordinator"
            >
              {coordinators.map((c) => (
                <option key={c.user_id} value={String(c.user_id)}>
                  {c.name} {c.phone ? `(${c.phone})` : "(No phone)"}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}

        {hasValidPhone ? (
          <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-700/60 dark:bg-slate-800/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Registered Phone Number
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <Icon name="phone" className="text-xs text-brand" />
              <span>{rawPhone}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#64748b] dark:text-[#b8b0a8]">
              Clicking <strong>Go to Phone</strong> will open your device&apos;s phone/dialer application with this number populated.
            </p>
          </div>
        ) : (
          <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-center justify-center gap-2 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              <Icon name="circle-alert" className="text-sm text-amber-600 dark:text-amber-400" />
              <span>
                {!active
                  ? "No coordinator is currently available."
                  : "No registered phone number available."}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-[#64748b] dark:text-[#b8b0a8]">
              {!active
                ? "There are no active coordinator accounts found in the system."
                : `This ${formattedRole.toLowerCase()} has no registered phone number available on their account profile.`}
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            className="flex-1 rounded-xl border border-[#cbd5e1] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#475569] transition hover:bg-[#f8fafc] dark:border-night-line dark:bg-night-head dark:text-[#e2dad3] dark:hover:bg-[#3d3732]"
            onClick={onClose}
          >
            Cancel
          </button>
          {hasValidPhone ? (
            <a
              href={`tel:${telDigits}`}
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-white shadow-xs transition hover:bg-brand-dark"
            >
              <Icon name="phone" className="text-xs" />
              <span>Go to Phone</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
            >
              <Icon name="phone" className="text-xs" />
              <span>Go to Phone</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

